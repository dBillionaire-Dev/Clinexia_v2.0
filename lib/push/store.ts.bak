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
export async function listRecentMessages(signedIn: boolean, days = 7, limit = 5) {
  const since = encodeURIComponent(new Date(Date.now() - days * 86_400_000).toISOString())
  const audiences = signedIn ? "everyone,signed_in" : "everyone,guests"
  const rows = await db.select("push_messages", `select=id,title,body,url,created_at&audience=in.(${audiences})&created_at=gte.${since}&order=created_at.desc&limit=${limit}`)
  return rows.map((r) => ({ id: String(r.id), title: r.title as string, body: r.body as string, url: (r.url ?? "") as string, createdAt: r.created_at as string }))
}

export async function listMessages() {
  const rows = await db.select("push_messages", "select=*&order=created_at.desc&limit=30")
  return rows.map((r) => ({ id: uuid(r.id), title: r.title as string, body: r.body as string, url: r.url as string, audience: r.audience as string, sent: r.sent_count as number, failed: r.failed_count as number, removed: r.removed_count as number, createdAt: r.created_at as string }))
}
