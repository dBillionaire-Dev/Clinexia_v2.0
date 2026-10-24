import { db, uuid } from "../billing/db"
import type { PushAudience } from "./validate"

export async function upsertDevice(token: string, anonymousId: string | null, userId: string | null, platform: string) {
  const row = { anonymous_id: anonymousId, user_id: userId, platform, last_seen: new Date().toISOString() }
  const changed = await db.update("push_devices", `token=eq.${encodeURIComponent(token)}`, row)
  if (changed.length === 0) await db.insert("push_devices", { token, ...row })
}

/** Signed-in phones are those that registered while a person was signed in; the rest are guests. */
export async function listTokens(audience: PushAudience, limit = 5000): Promise<string[]> {
  const filter = audience === "signed_in" ? "&user_id=not.is.null" : audience === "guests" ? "&user_id=is.null" : ""
  const rows = await db.select("push_devices", `select=token${filter}&order=last_seen.desc&limit=${limit}`)
  return rows.map((r) => r.token as string)
}

/** The phones this person is signed in on. */
export async function listTokensForUser(userId: string, limit = 50): Promise<string[]> {
  const rows = await db.select("push_devices", `select=token&user_id=eq.${uuid(userId)}&order=last_seen.desc&limit=${limit}`)
  return rows.map((r) => r.token as string)
}

export async function createUserMessage(m: { title: string; body: string; userId: string }): Promise<string> {
  const row = await db.insert("push_messages", { title: m.title, body: m.body, url: "", audience: "user", user_id: uuid(m.userId) })
  return String(row!.id)
}

export async function removeTokens(tokens: string[]) {
  for (let i = 0; i < tokens.length; i += 50) {
    const batch = tokens.slice(i, i + 50).map((t) => `"${t}"`).join(",")
    await db.remove("push_devices", `token=in.(${batch})`)
  }
}

export async function deviceCounts() {
  const rows = await db.select("push_devices", "select=user_id&limit=50000")
  const signedIn = rows.filter((r) => r.user_id).length
  return { total: rows.length, signedIn, guests: rows.length - signedIn }
}

export async function createMessage(m: { title: string; body: string; url: string; audience: PushAudience }): Promise<string> {
  const row = await db.insert("push_messages", { title: m.title, body: m.body, url: m.url, audience: m.audience })
  return String(row!.id)
}

export async function finishMessage(id: string, c: { sent: number; failed: number; removed: number }) {
  await db.update("push_messages", `id=eq.${uuid(id)}`, { sent_count: c.sent, failed_count: c.failed, removed_count: c.removed })
}

/** Messages an app should show on open (so a notification that was missed or swiped away is not lost): the last week, for this person's audience. */
export async function listRecentMessages(signedIn: boolean, days = 7, limit = 5, userId?: string) {
  const since = encodeURIComponent(new Date(Date.now() - days * 86_400_000).toISOString())
  const audiences = signedIn ? "everyone,signed_in" : "everyone,guests"
  const shared = await db.select("push_messages", `select=id,title,body,url,created_at&audience=in.(${audiences})&created_at=gte.${since}&order=created_at.desc&limit=${limit}`)
  // Private messages from the admin: only ever returned to the person they were written for.
  const mine = userId ? await db.select("push_messages", `select=id,title,body,url,created_at&audience=eq.user&user_id=eq.${uuid(userId)}&created_at=gte.${since}&order=created_at.desc&limit=10`).catch(() => []) : []
  const shape = (r: any, priv: boolean) => ({ id: String(r.id), title: r.title as string, body: r.body as string, url: (r.url ?? "") as string, createdAt: r.created_at as string, ...(priv ? { private: true } : {}) })
  return [...shared.map((r) => shape(r, false)), ...mine.map((r) => shape(r, true))].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export async function listMessages() {
  const rows = await db.select("push_messages", "select=*&audience=neq.user&order=created_at.desc&limit=30")
  return rows.map((r) => ({ id: uuid(r.id), title: r.title as string, body: r.body as string, url: r.url as string, audience: r.audience as string, sent: r.sent_count as number, failed: r.failed_count as number, removed: r.removed_count as number, createdAt: r.created_at as string }))
}
