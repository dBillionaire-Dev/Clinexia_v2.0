// Administrator access to the sign-in accounts held by Supabase Auth (service role). Server only.
import { randomBytes } from "node:crypto"
import { uuid } from "./db"

export interface AuthUser { id: string; email: string; createdAt: string | null; lastSignInAt: string | null; confirmed: boolean }

function conn() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
  return { base: `${url.replace(/\/$/, "")}/auth/v1/admin`, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } }
}

const shape = (u: any): AuthUser => ({ id: String(u.id), email: String(u.email ?? ""), createdAt: u.created_at ?? null, lastSignInAt: u.last_sign_in_at ?? null, confirmed: Boolean(u.email_confirmed_at || u.confirmed_at) })

/** Up to 1,000 accounts (5 pages of 200). `truncated` tells the admin screen when there are more. */
export async function listAuthUsers(): Promise<{ users: AuthUser[]; truncated: boolean }> {
  const { base, headers } = conn()
  const out: AuthUser[] = []
  let truncated = false
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${base}/users?page=${page}&per_page=200`, { headers, cache: "no-store" })
    if (!res.ok) throw new Error(`Supabase list users failed (${res.status})`)
    const json = (await res.json()) as any
    const batch: any[] = Array.isArray(json) ? json : json?.users ?? []
    out.push(...batch.map(shape))
    if (batch.length < 200) return { users: out, truncated }
    if (page === 5) truncated = true
  }
  return { users: out, truncated }
}

export async function getAuthUser(id: string): Promise<AuthUser | null> {
  const { base, headers } = conn()
  const res = await fetch(`${base}/users/${uuid(id)}`, { headers, cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Supabase get user failed (${res.status})`)
  return shape(await res.json())
}

/**
 * A one-time password-reset token for this email, made by Supabase WITHOUT sending Supabase's own email, so Clinexia can send the
 * message itself (through Resend). Null when there is no such account. The token is later traded in with verifyRecovery().
 */
export async function generateRecoveryToken(email: string): Promise<{ userId: string; tokenHash: string } | null> {
  const { base, headers } = conn()
  const res = await fetch(`${base}/generate_link`, { method: "POST", headers, body: JSON.stringify({ type: "recovery", email }), cache: "no-store" })
  if (!res.ok) return null // unknown address (or Supabase refused): the caller answers the same either way
  const j = (await res.json().catch(() => null)) as any
  const tokenHash = j?.hashed_token ?? j?.properties?.hashed_token
  const userId = j?.id ?? j?.user?.id
  return typeof tokenHash === "string" && typeof userId === "string" ? { userId, tokenHash } : null
}

/** Changes some of a person's profile fields kept by Supabase (name, photo). A null value removes that field; the rest are left as they are. */
export async function setUserMetadata(id: string, patch: Record<string, string | null>): Promise<void> {
  const { base, headers } = conn()
  const url = `${base}/users/${uuid(id)}`
  const cur = await fetch(url, { headers, cache: "no-store" })
  if (!cur.ok) throw new Error(`Supabase get user failed (${cur.status})`)
  const meta = { ...(((await cur.json()) as any)?.user_metadata ?? {}) } as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) { if (v === null) delete meta[k]; else meta[k] = v }
  const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify({ user_metadata: meta }), cache: "no-store" })
  if (!res.ok) throw new Error(`Supabase update user failed (${res.status})`)
}

/** Creates a confirmed account for someone else (an organisation adding its staff). The person chooses their own password through a reset link. */
export async function createConfirmedUser(email: string, fullName: string): Promise<{ ok: true; userId: string } | { ok: false; reason: "exists" | "error" }> {
  const { base, headers } = conn()
  const password = randomBytes(24).toString("base64url") // nobody ever sees this; it is replaced when the person sets their own
  const res = await fetch(`${base}/users`, { method: "POST", headers, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }), cache: "no-store" })
  const j = (await res.json().catch(() => null)) as any
  if (res.ok && typeof j?.id === "string") return { ok: true, userId: j.id }
  const code = String(j?.error_code ?? j?.code ?? "")
  return { ok: false, reason: code === "email_exists" || code === "user_already_exists" || res.status === 422 ? "exists" : "error" }
}

export async function deleteAuthUser(id: string): Promise<void> {
  const { base, headers } = conn()
  const res = await fetch(`${base}/users/${uuid(id)}`, { method: "DELETE", headers })
  if (!res.ok && res.status !== 404) throw new Error(`Supabase delete user failed (${res.status}): ${(await res.text()).slice(0, 150)}`)
}
