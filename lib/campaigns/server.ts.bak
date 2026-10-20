// Storage for campaigns (Supabase REST, service role). Server only.
import { db, uuid, type Row } from "../billing/db"
import { PLATFORMS, isLive, type Campaign, type CampaignFields, type Question } from "./model"

const toCampaign = (r: Row): Campaign => ({
  id: r.id, version: r.version, title: r.title, kind: r.kind, presentation: r.presentation, heading: r.heading, body: r.body ?? "", ctaLabel: r.cta_label ?? "", ctaUrl: r.cta_url ?? "",
  questions: (Array.isArray(r.questions) ? r.questions : []) as Question[], audience: r.audience, platforms: Array.isArray(r.platforms) && r.platforms.length ? r.platforms : [...PLATFORMS], frequency: r.frequency, repeatDays: r.repeat_days, allowLater: r.allow_later === true,
  laterHours: r.later_hours, durationSeconds: r.duration_seconds ?? null, dismissible: r.dismissible === true, startsAt: r.starts_at ?? null, endsAt: r.ends_at ?? null, status: r.status,
})

const toRow = (f: CampaignFields): Row => ({
  title: f.title, kind: f.kind, presentation: f.presentation, heading: f.heading, body: f.body, cta_label: f.ctaLabel, cta_url: f.ctaUrl, questions: f.questions, audience: f.audience, platforms: f.platforms,
  frequency: f.frequency, repeat_days: f.repeatDays, allow_later: f.allowLater, later_hours: f.laterHours, duration_seconds: f.durationSeconds, dismissible: f.dismissible,
  starts_at: f.startsAt, ends_at: f.endsAt, status: f.status, updated_at: new Date().toISOString(),
})

/** What the app asks for on every visit: switched on, started, not ended. Scheduled campaigns appear by themselves when their time comes. */
export async function listLiveCampaigns(now = Date.now()): Promise<Campaign[]> {
  const rows = await db.select("app_campaigns", "select=*&status=eq.active&order=starts_at.desc.nullslast&limit=50")
  return rows.map(toCampaign).filter((c) => isLive(c, now))
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const [r] = await db.select("app_campaigns", `select=*&id=eq.${uuid(id)}`)
  return r ? toCampaign(r) : null
}

export async function listCampaignsWithCounts(): Promise<Array<Campaign & { responses: number }>> {
  const [rows, counts] = await Promise.all([db.select("app_campaigns", "select=*&order=created_at.desc&limit=200"), db.select("app_campaign_responses", "select=campaign_id&limit=50000")])
  return rows.map((r) => ({ ...toCampaign(r), responses: counts.filter((c) => c.campaign_id === r.id).length }))
}

export async function createCampaign(f: CampaignFields): Promise<Campaign> {
  const r = await db.insert("app_campaigns", toRow(f))
  return toCampaign(r!)
}

export async function updateCampaign(id: string, f: CampaignFields): Promise<Campaign | null> {
  const [r] = await db.update("app_campaigns", `id=eq.${uuid(id)}`, toRow(f))
  return r ? toCampaign(r) : null
}

export async function setCampaignStatus(id: string, status: "draft" | "active" | "paused"): Promise<boolean> {
  return (await db.update("app_campaigns", `id=eq.${uuid(id)}`, { status, updated_at: new Date().toISOString() })).length > 0
}

/** Raises the version so everyone, including people who already answered or dismissed it, sees the campaign again. */
export async function showAgain(id: string): Promise<boolean> {
  const c = await getCampaign(id)
  if (!c) return false
  return (await db.update("app_campaigns", `id=eq.${uuid(id)}`, { version: c.version + 1, updated_at: new Date().toISOString() })).length > 0
}

export async function deleteCampaign(id: string): Promise<boolean> {
  return (await db.remove("app_campaigns", `id=eq.${uuid(id)}`)).length > 0
}

/** One answer per person per version. A signed-in person's answer is found again from any device (website, phone). */
export async function saveCampaignResponse(c: Campaign, anonymousId: string, platform: string | null, answers: Row, userId?: string | null): Promise<void> {
  const base = `campaign_id=eq.${uuid(c.id)}&campaign_version=eq.${c.version}`
  const byDevice = `${base}&anonymous_id=eq.${encodeURIComponent(anonymousId)}`
  if (userId) {
    const uid = uuid(userId)
    if ((await db.update("app_campaign_responses", `${base}&user_id=eq.${uid}`, { answers, platform, anonymous_id: anonymousId })).length) return
    if ((await db.update("app_campaign_responses", byDevice, { answers, platform, user_id: uid })).length) return // this device answered before signing in
    await db.insert("app_campaign_responses", { campaign_id: c.id, campaign_version: c.version, anonymous_id: anonymousId, user_id: uid, platform, answers })
    return
  }
  if ((await db.update("app_campaign_responses", byDevice, { answers, platform })).length === 0) {
    await db.insert("app_campaign_responses", { campaign_id: c.id, campaign_version: c.version, anonymous_id: anonymousId, platform, answers })
  }
}

export interface CampaignRef { id: string; version: number }

/** Campaigns this person (any of their devices) or this device has already answered. */
export async function listAnswered(userId: string | null, anonymousId: string | null): Promise<CampaignRef[]> {
  const parts: string[] = []
  if (userId) parts.push(`user_id.eq.${uuid(userId)}`)
  if (anonymousId && /^[A-Za-z0-9_-]{8,80}$/.test(anonymousId)) parts.push(`anonymous_id.eq.${anonymousId}`)
  if (parts.length === 0) return []
  const rows = await db.select("app_campaign_responses", `select=campaign_id,campaign_version&or=(${parts.join(",")})&limit=500`)
  return rows.map((r) => ({ id: r.campaign_id as string, version: r.campaign_version as number }))
}

/** "Remind me later" follows the signed-in person, so a form parked on the phone is waiting on the website too. */
export async function listParked(userId: string): Promise<CampaignRef[]> {
  const rows = await db.select("app_campaign_parked", `select=campaign_id,campaign_version&user_id=eq.${uuid(userId)}&limit=50`)
  return rows.map((r) => ({ id: r.campaign_id as string, version: r.campaign_version as number }))
}

export async function setParked(userId: string, campaignId: string, version: number, parked: boolean): Promise<void> {
  const where = `user_id=eq.${uuid(userId)}&campaign_id=eq.${uuid(campaignId)}`
  if (!parked) { await db.remove("app_campaign_parked", where); return }
  const changed = await db.update("app_campaign_parked", where, { campaign_version: version })
  if (changed.length === 0) await db.insert("app_campaign_parked", { user_id: userId, campaign_id: campaignId, campaign_version: version })
}

export async function listCampaignResponses(id: string) {
  const rows = await db.select("app_campaign_responses", `select=*&campaign_id=eq.${uuid(id)}&order=created_at.desc&limit=2000`)
  return rows.map((r) => ({ id: r.id as string, version: r.campaign_version as number, platform: (r.platform ?? null) as string | null, createdAt: r.created_at as string, answers: r.answers as Row }))
}

export async function deleteCampaignResponse(id: string): Promise<boolean> {
  return (await db.remove("app_campaign_responses", `id=eq.${uuid(id)}`)).length > 0
}
