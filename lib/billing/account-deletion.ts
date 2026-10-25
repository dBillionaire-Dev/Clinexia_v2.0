// "Delete my account". A soft delete: to the person it is gone at once (signed out everywhere, cannot use anything), but nothing is
// erased. For 7 days signing in offers to restore it. After that it is final: the sign-in email is renamed so the person can register
// again with the same address, and the original address is kept in billing_user_status.deleted_email. All data stays in the database.
import { getAuthUser, retireAuthUser, unretireAuthUser } from "./admin-users"
import { db, uuid } from "./db"
import { forgetUserDevices } from "./devices"
import { canDeleteUser } from "./admin-rules"
import { recordAudit } from "./store"

export const DELETION_GRACE_DAYS = 7
const DAY = 86_400_000

export type DeletionPhase = "none" | "pending" | "final"
export interface DeletionFields { deletedAt?: string | null; deletionFinalAt?: string | null }

/** Where an account is in the deletion process, and until when it can still be restored. Pure. */
export function deletionPhase(s: DeletionFields, now: number): { phase: DeletionPhase; restoreUntil: string | null } {
  const at = s.deletedAt ? Date.parse(s.deletedAt) : NaN
  if (!Number.isFinite(at)) return { phase: "none", restoreUntil: null }
  const until = at + DELETION_GRACE_DAYS * DAY
  if (s.deletionFinalAt || now >= until) return { phase: "final", restoreUntil: null }
  return { phase: "pending", restoreUntil: new Date(until).toISOString() }
}

/** The address a finalised account is renamed to: unique, and never deliverable. */
export const retiredEmail = (userId: string) => `deleted-${userId}@deleted.invalid`

async function writeStatus(userId: string, patch: Record<string, unknown>) {
  const id = uuid(userId)
  const row = { ...patch, updated_at: new Date().toISOString() }
  const changed = await db.update("billing_user_status", `user_id=eq.${id}`, row)
  if (changed.length === 0) await db.insert("billing_user_status", { user_id: id, status: "active", ...row })
}

/** Reasons the person cannot delete their account yet. */
export async function deletionBlocker(userId: string): Promise<string | null> {
  const owned = await db.select("billing_organisations", `select=id&owner_user_id=eq.${uuid(userId)}`)
  const v = canDeleteUser({ ownedOrganisations: owned.length })
  return v.ok ? null : `You own ${owned.length === 1 ? "an organisation" : "organisations"}. Contact Clinexia support to close or hand over ${owned.length === 1 ? "it" : "them"} first.`
}

/** Starts the deletion. The caller has already checked the password and ended the person's sessions. */
export async function markDeleted(userId: string): Promise<{ restoreUntil: string }> {
  const now = new Date()
  await writeStatus(userId, { deleted_at: now.toISOString(), deletion_final_at: null })
  await forgetUserDevices(userId).catch(() => undefined) // no more notifications to their phones
  await recordAudit({ actorKind: "user", actorUserId: userId, action: "account.deletion_requested", detail: {} })
  return { restoreUntil: new Date(now.getTime() + DELETION_GRACE_DAYS * DAY).toISOString() }
}

/** The person signed in during the 7 days and chose to keep the account. */
export async function restoreAccount(userId: string, by: "user" | "platform_admin" = "user"): Promise<void> {
  await writeStatus(userId, { deleted_at: null, deletion_final_at: null })
  await recordAudit({ actorKind: by, actorUserId: userId, action: "account.deletion_cancelled", detail: {} })
}

/** Administrator: brings back an account, even a finalised one (its original email is put back when nobody else has taken it). */
export async function adminRestore(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db.select("billing_user_status", `select=deleted_at,deletion_final_at,deleted_email&user_id=eq.${uuid(userId)}`)
  if (!row?.deleted_at) return { ok: false, error: "This account is not deleted." }
  if (row.deletion_final_at && row.deleted_email) {
    try { await unretireAuthUser(userId, row.deleted_email) } catch { return { ok: false, error: "The original email address is already used by another account, so this one cannot be restored." } }
  }
  await restoreAccount(userId, "platform_admin")
  return { ok: true }
}

/** Daily job: accounts deleted more than 7 days ago become final. Never throws for one bad account. Returns how many were finalised. */
export async function finalizeDeletions(now = Date.now(), limit = 50): Promise<number> {
  const before = encodeURIComponent(new Date(now - DELETION_GRACE_DAYS * DAY).toISOString())
  let rows: any[] = []
  try {
    rows = await db.select("billing_user_status", `select=user_id&deleted_at=lt.${before}&deletion_final_at=is.null&limit=${limit}`)
  } catch { return 0 } // billing-account-deletion.sql not run yet
  let done = 0
  for (const r of rows) {
    const id = String(r.user_id)
    try {
      const auth = await getAuthUser(id)
      await retireAuthUser(id, retiredEmail(id)) // frees the address for a new registration; also blocks any sign-in
      await db.remove("billing_memberships", `user_id=eq.${uuid(id)}`) // frees their seats
      await writeStatus(id, { deletion_final_at: new Date(now).toISOString(), deleted_email: auth?.email ?? null })
      await recordAudit({ actorKind: "system", actorUserId: id, action: "account.deletion_final", detail: {} })
      done++
    } catch (error) {
      console.error("Clinexia: could not finalise a deleted account:", error instanceof Error ? error.message : "unknown")
    }
  }
  return done
}
