// Links anonymous devices to accounts (server only). See supabase/billing-link.sql.
import { db, uuid } from "./db"
import { accountNameFor, isDeviceId } from "./history"

async function nameFor(userId: string, email: string): Promise<string> {
  try {
    const [p] = await db.select("billing_profiles", `select=full_name&user_id=eq.${uuid(userId)}`)
    return accountNameFor(p?.full_name, email)
  } catch {
    return accountNameFor(null, email)
  }
}

/** Best effort: a failure here must never stop someone signing in or registering. Returns whether the link was recorded. */
export async function linkDevice(userId: string, email: string, anonymousId: unknown, knownName?: string): Promise<boolean> {
  if (!isDeviceId(anonymousId)) return false
  try {
    await db.rpc("billing_link_device", { p_anonymous_id: anonymousId.toLowerCase(), p_user: uuid(userId), p_name: knownName ?? (await nameFor(userId, email)) })
    return true
  } catch (error) {
    console.error("Clinexia device link failed:", error instanceof Error ? error.message : "unknown")
    return false
  }
}

export async function unlinkDevice(userId: string, anonymousId: string): Promise<boolean> {
  if (!isDeviceId(anonymousId)) return false
  return (await db.remove("billing_device_links", `user_id=eq.${uuid(userId)}&anonymous_id=eq.${anonymousId.toLowerCase()}`)).length > 0
}

/** The account's devices and what was calculated on them, newest first. Includes everything done before the person registered. */
export async function loadDeviceHistory(userId: string) {
  const links = await db.select("billing_device_links", `select=anonymous_id,linked_at&user_id=eq.${uuid(userId)}&order=linked_at.asc&limit=20`)
  const ids = links.map((l) => String(l.anonymous_id)).filter(isDeviceId)
  if (ids.length === 0) return { devices: [], events: [] }
  const list = ids.map((i) => `"${i}"`).join(",")
  const [devices, events] = await Promise.all([
    db.select("convertlab_devices", `select=anonymous_id,display_name,first_seen_at,last_seen_at,last_calculation_at,source,app_version&anonymous_id=in.(${list})`),
    db.select("calculation_events", `select=calculator_id,calculator_name,category,occurred_at,source,anonymous_id&anonymous_id=in.(${list})&order=occurred_at.desc&limit=1000`),
  ])
  return {
    devices: devices.map((d) => ({
      anonymousId: d.anonymous_id as string, displayName: d.display_name as string, firstSeenAt: d.first_seen_at as string | null, lastSeenAt: d.last_seen_at as string | null,
      lastCalculationAt: (d.last_calculation_at ?? null) as string | null, source: d.source as string, appVersion: d.app_version as string,
      linkedAt: (links.find((l) => l.anonymous_id === d.anonymous_id)?.linked_at ?? null) as string | null,
    })),
    events,
  }
}

/** Links devices already known to belong to an account and gives them the account's name. Safe to repeat. */
export async function backfillDeviceLinks(): Promise<{ linksAdded: number; renamed: number }> {
  const r = await db.rpc<{ links_added: number; renamed: number }>("billing_backfill_device_links", {})
  return { linksAdded: r?.links_added ?? 0, renamed: r?.renamed ?? 0 }
}

/** Before an account is deleted: take its name off the device records. Best effort. */
export async function forgetUserDevices(userId: string): Promise<void> {
  try { await db.rpc("billing_forget_user_devices", { p_user: uuid(userId) }) } catch (error) { console.error("Clinexia forget devices failed:", error instanceof Error ? error.message : "unknown") }
}
