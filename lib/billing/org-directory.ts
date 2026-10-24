// The organisation directory: groups (departments), disabling members, adding people whose accounts the organisation creates, and
// resetting the password of those people. Rules only: everything goes through stores so they are tested without a database.
// Same safety rule as org-actions: the caller's OWN membership is loaded first; without one the answer is "not_found".
import type { Specialty } from "./config"
import { grantsAccess, effectiveStatus } from "./lifecycle"
import { isEmail, normalizeEmail } from "./invitations"
import type { Actor, Failure, Outcome, OrgStore, Settings } from "./org-actions"
import { assignableSpecialties, can, canManageMember, invitableRoles, type OrgRole } from "./roles"

const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message })

export const MAX_GROUPS = 50
export const MAX_IMPORT_ROWS = 50
export interface GroupRecord { id: string; name: string; members: number }

export interface DirectoryStore {
  listGroups(orgId: string): Promise<GroupRecord[]>
  createGroup(orgId: string, name: string): Promise<{ ok: true; id: string } | { ok: false; reason: "duplicate" }>
  renameGroup(orgId: string, groupId: string, name: string): Promise<"ok" | "missing" | "duplicate">
  deleteGroup(orgId: string, groupId: string): Promise<boolean>
  setMemberGroup(orgId: string, userId: string, groupId: string | null): Promise<boolean>
  setMemberDisabled(orgId: string, userId: string, disabled: boolean): Promise<boolean>
  /** MUST be atomic: checks free seats and duplicates under a lock, then adds a member flagged as organisation-managed. */
  provisionMember(i: { orgId: string; userId: string; role: OrgRole; allSpecialties: boolean; specialties: Specialty[]; groupId: string | null }): Promise<{ ok: true } | { ok: false; reason: "no_capacity" | "already_member" }>
}
export interface AccountService {
  create(email: string, fullName: string): Promise<{ ok: true; userId: string } | { ok: false; reason: "exists" | "error" }>
  remove(userId: string): Promise<void>
}

export function cleanGroupName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const name = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim()
  return name.length >= 1 && name.length <= 60 ? name : null
}

async function authorise(org: OrgStore, actor: Actor, orgId: string) {
  const [o, me] = await Promise.all([org.getOrg(orgId), org.getMember(orgId, actor.userId)])
  if (!o || !me || me.disabled) return null
  return { org: o, me }
}

export async function createGroup(org: OrgStore, dir: DirectoryStore, actor: Actor, orgId: string, rawName: unknown): Promise<Outcome<{ id: string }>> {
  const ctx = await authorise(org, actor, orgId)
  if (!ctx) return fail("not_found", "Organisation not found.")
  if (!can(ctx.me.role, "directory.manage")) return fail("forbidden", "You cannot manage groups.")
  const name = cleanGroupName(rawName)
  if (!name) return fail("invalid", "Give the group a name (up to 60 characters).")
  if ((await dir.listGroups(orgId)).length >= MAX_GROUPS) return fail("conflict", `An organisation can have up to ${MAX_GROUPS} groups.`)
  const r = await dir.createGroup(orgId, name)
  if (!r.ok) return fail("conflict", "A group with that name already exists.")
  await org.audit({ orgId, actorUserId: actor.userId, action: "group.created", detail: { name } })
  return { ok: true, id: r.id }
}

export async function renameGroup(org: OrgStore, dir: DirectoryStore, actor: Actor, orgId: string, groupId: string, rawName: unknown): Promise<Outcome<object>> {
  const ctx = await authorise(org, actor, orgId)
  if (!ctx) return fail("not_found", "Organisation not found.")
  if (!can(ctx.me.role, "directory.manage")) return fail("forbidden", "You cannot manage groups.")
  const name = cleanGroupName(rawName)
  if (!name) return fail("invalid", "Give the group a name (up to 60 characters).")
  const r = await dir.renameGroup(orgId, groupId, name)
  if (r === "missing") return fail("not_found", "Group not found.")
  if (r === "duplicate") return fail("conflict", "A group with that name already exists.")
  await org.audit({ orgId, actorUserId: actor.userId, action: "group.renamed", detail: { groupId, name } })
  return { ok: true }
}

export async function deleteGroup(org: OrgStore, dir: DirectoryStore, actor: Actor, orgId: string, groupId: string): Promise<Outcome<object>> {
  const ctx = await authorise(org, actor, orgId)
  if (!ctx) return fail("not_found", "Organisation not found.")
  if (!can(ctx.me.role, "directory.manage")) return fail("forbidden", "You cannot manage groups.")
  if (!(await dir.deleteGroup(orgId, groupId))) return fail("not_found", "Group not found.")
  await org.audit({ orgId, actorUserId: actor.userId, action: "group.deleted", detail: { groupId } })
  return { ok: true } // its members stay in the organisation, with no group
}

async function manageable(org: OrgStore, actor: Actor, orgId: string, targetUserId: string) {
  const ctx = await authorise(org, actor, orgId)
  if (!ctx) return fail("not_found", "Organisation not found.")
  if (!can(ctx.me.role, "directory.manage")) return fail("forbidden", "You cannot manage members.")
  const target = await org.getMember(orgId, targetUserId)
  if (!target) return fail("not_found", "Member not found.")
  if (!canManageMember(ctx.me.role, target.role)) return fail("forbidden", "You cannot manage this member.")
  return { ctx, target }
}

export async function setMemberGroup(org: OrgStore, dir: DirectoryStore, actor: Actor, orgId: string, targetUserId: string, groupId: string | null): Promise<Outcome<object>> {
  const m = await manageable(org, actor, orgId, targetUserId)
  if ("ok" in m) return m
  if (groupId !== null && !(await dir.listGroups(orgId)).some((g) => g.id === groupId)) return fail("not_found", "Group not found.")
  await dir.setMemberGroup(orgId, targetUserId, groupId)
  await org.audit({ orgId, actorUserId: actor.userId, action: "member.group_changed", detail: { targetUserId, groupId } })
  return { ok: true }
}

/** Disabled members lose the access the organisation gives them, and cannot manage it, but keep their seat. They can be enabled again. */
export async function setMemberDisabled(org: OrgStore, dir: DirectoryStore, actor: Actor, orgId: string, targetUserId: string, disabled: boolean): Promise<Outcome<object>> {
  if (targetUserId === actor.userId) return fail("forbidden", "You cannot disable yourself.")
  const m = await manageable(org, actor, orgId, targetUserId)
  if ("ok" in m) return m
  await dir.setMemberDisabled(orgId, targetUserId, disabled)
  await org.audit({ orgId, actorUserId: actor.userId, action: disabled ? "member.disabled" : "member.enabled", detail: { targetUserId } })
  return { ok: true }
}

/** Only accounts the organisation itself created ("managed") can have their password reset by it; anyone else's account is theirs alone. */
export async function authoriseMemberPasswordReset(org: OrgStore, actor: Actor, orgId: string, targetUserId: string): Promise<Outcome<{ email: string }>> {
  const m = await manageable(org, actor, orgId, targetUserId)
  if ("ok" in m) return m
  if (m.target.managed !== true) return fail("forbidden", "This person created their own account, so only they can reset its password. They can use “Forgot password?” on the sign-in page.")
  if (!m.target.email) return fail("not_found", "This account has no email address.")
  await org.audit({ orgId, actorUserId: actor.userId, action: "member.password_reset", detail: { targetUserId } })
  return { ok: true, email: m.target.email }
}

// ---- adding people (single or a spreadsheet) -------------------------------------------------------------------------------
export interface PersonRow { name: string; email: string; role?: string; group?: string }
export type PersonStatus = "created" | "has_account" | "no_capacity" | "invalid" | "duplicate" | "error"
export interface PersonResult { email: string; name: string; status: PersonStatus; userId?: string; message?: string }

/** Spreadsheet text with a header row (name, email, role, group; any order). Commas, semicolons or tabs; quotes allowed. */
export function parsePeopleCsv(raw: string): { rows: PersonRow[]; error?: string } {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "")
  if (lines.length < 2) return { rows: [], error: "Add a header row (name, email) and at least one person." }
  const delim = [",", ";", "\t"].reduce((best, d) => (lines[0].split(d).length > lines[0].split(best).length ? d : best), ",")
  const split = (line: string) => {
    const out: string[] = []
    let cur = ""
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q } else if (c === delim && !q) { out.push(cur.trim()); cur = "" } else cur += c
    }
    out.push(cur.trim())
    return out
  }
  const head = split(lines[0]).map((h) => h.toLowerCase())
  const col = (names: string[]) => head.findIndex((h) => names.includes(h))
  const iName = col(["name", "full name", "fullname"])
  const iEmail = col(["email", "email address", "e-mail"])
  const iRole = col(["role"])
  const iGroup = col(["group", "department", "team"])
  if (iName < 0 || iEmail < 0) return { rows: [], error: "The first row must have the columns name and email (role and group are optional)." }
  const rows = lines.slice(1).map((l) => {
    const c = split(l)
    return { name: c[iName] ?? "", email: c[iEmail] ?? "", ...(iRole >= 0 ? { role: c[iRole] } : {}), ...(iGroup >= 0 ? { group: c[iGroup] } : {}) }
  })
  return { rows }
}

export async function addPeople(
  org: OrgStore, dir: DirectoryStore, accounts: AccountService, actor: Actor, orgId: string,
  input: { rows: PersonRow[]; allSpecialties?: boolean; specialties?: unknown; defaultGroupId?: string | null }, s: Settings,
): Promise<Outcome<{ results: PersonResult[]; created: Array<{ userId: string; email: string; name: string }> }>> {
  const ctx = await authorise(org, actor, orgId)
  if (!ctx) return fail("not_found", "Organisation not found.")
  const { org: o, me } = ctx
  if (!can(me.role, "directory.manage")) return fail("forbidden", "You cannot add people.")
  if (o.suspended) return fail("forbidden", "This organisation is suspended.")
  if (!o.plan || !grantsAccess(effectiveStatus(o.plan, s.now, s.graceDays))) return fail("subscription_inactive", "The organisation needs an active subscription before adding people.")
  if (input.rows.length === 0) return fail("invalid", "Add at least one person.")
  if (input.rows.length > MAX_IMPORT_ROWS) return fail("invalid", `Add at most ${MAX_IMPORT_ROWS} people at a time.`)

  const allowed = assignableSpecialties(o.plan)
  const all = input.allSpecialties !== false // by default a new person can use everything the plan covers
  const specialties: Specialty[] = []
  if (!all) {
    const cleaned = Array.isArray(input.specialties) ? (input.specialties as unknown[]).filter((x): x is Specialty => typeof x === "string" && (allowed as string[]).includes(x)) : []
    if (cleaned.length === 0) return fail("invalid", "Choose at least one specialty for the new people.")
    specialties.push(...cleaned)
  }

  let groups = await dir.listGroups(orgId)
  const groupIdFor = async (name: string | undefined): Promise<string | null> => {
    const n = name ? cleanGroupName(name) : null
    if (!n) return input.defaultGroupId ?? null
    const found = groups.find((g) => g.name.toLowerCase() === n.toLowerCase())
    if (found) return found.id
    if (groups.length >= MAX_GROUPS) return input.defaultGroupId ?? null
    const made = await dir.createGroup(orgId, n)
    if (made.ok) { groups = [...groups, { id: made.id, name: n, members: 0 }]; return made.id }
    groups = await dir.listGroups(orgId)
    return groups.find((g) => g.name.toLowerCase() === n.toLowerCase())?.id ?? null
  }

  const results: PersonResult[] = []
  const created: Array<{ userId: string; email: string; name: string }> = []
  const seen = new Set<string>()
  for (const row of input.rows) {
    const email = normalizeEmail(String(row.email ?? ""))
    const name = String(row.name ?? "").replace(/\s+/g, " ").trim()
    if (!isEmail(email) || name.length < 2 || name.length > 100) { results.push({ email, name, status: "invalid", message: "Needs a name (2 to 100 characters) and a valid email." }); continue }
    if (seen.has(email)) { results.push({ email, name, status: "duplicate", message: "Listed more than once." }); continue }
    seen.add(email)
    const role = (row.role ? String(row.role).trim().toLowerCase() : "staff") as OrgRole
    if (!invitableRoles(me.role).includes(role)) { results.push({ email, name, status: "invalid", message: `You cannot add someone as “${row.role}”.` }); continue }
    const acc = await accounts.create(email, name)
    if (!acc.ok) {
      results.push(acc.reason === "exists"
        ? { email, name, status: "has_account", message: "Already has a Clinexia account. Invite them instead, so they can accept." }
        : { email, name, status: "error", message: "The account could not be created." })
      continue
    }
    const added = await dir.provisionMember({ orgId, userId: acc.userId, role, allSpecialties: all, specialties, groupId: await groupIdFor(row.group) })
    if (!added.ok) {
      await accounts.remove(acc.userId).catch(() => undefined) // do not leave an account behind that belongs to nobody
      results.push({ email, name, status: added.reason === "no_capacity" ? "no_capacity" : "error", message: added.reason === "no_capacity" ? "No free seats." : "Already a member." })
      continue
    }
    results.push({ email, name, status: "created", userId: acc.userId })
    created.push({ userId: acc.userId, email, name })
  }
  await org.audit({ orgId, actorUserId: actor.userId, action: "members.provisioned", detail: { created: created.length, attempted: input.rows.length } })
  return { ok: true, results, created }
}
