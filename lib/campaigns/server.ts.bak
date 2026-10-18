// Storage for campaigns (Supabase REST, service role). Server only.
import { db, uuid, type Row } from "../billing/db"
import { isLive, type Campaign, type CampaignFields, type Question } from "./model"

const toCampaign = (r: Row): Campaign => ({
  id: r.id, version: r.version, title: r.title, kind: r.kind, presentation: r.presentation, heading: r.heading, body: r.body ?? "", ctaLabel: r.cta_label ?? "", ctaUrl: r.cta_url ?? "",
  questions: (Array.isArray(r.questions) ? r.questions : []) as Question[], audience: r.audience, frequency: r.frequency, repeatDays: r.repeat_days, allowLater: r.allow_later === true,
  laterHours: r.later_hours, durationSeconds: r.duration_seconds ?? null, dismissible: r.dismissible === true, startsAt: r.starts_at ?? null, endsAt: r.ends_at ?? null, status: r.status,
})

const toRow = (f: CampaignFields): Row => ({
  title: f.title, kind: f.kind, presentation: f.presentation, heading: f.heading, body: f.body, cta_label: f.ctaLabel, cta_url: f.ctaUrl, questions: f.questions, audience: f.audience,
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

export async function saveCampaignResponse(c: Campaign, anonymousId: string, platform: string | null, answers: Row): Promise<void> {
  const where = `campaign_id=eq.${uuid(c.id)}&campaign_version=eq.${c.version}&anonymous_id=eq.${encodeURIComponent(anonymousId)}`
  const changed = await db.update("app_campaign_responses", where, { answers, platform })
  if (changed.length === 0) await db.insert("app_campaign_responses", { campaign_id: c.id, campaign_version: c.version, anonymous_id: anonymousId, platform, answers })
}

export async function listCampaignResponses(id: string) {
  const rows = await db.select("app_campaign_responses", `select=*&campaign_id=eq.${uuid(id)}&order=created_at.desc&limit=2000`)
  return rows.map((r) => ({ id: r.id as string, version: r.campaign_version as number, platform: (r.platform ?? null) as string | null, createdAt: r.created_at as string, answers: r.answers as Row }))
}

export async function deleteCampaignResponse(id: string): Promise<boolean> {
  return (await db.remove("app_campaign_responses", `id=eq.${uuid(id)}`)).length > 0
}
