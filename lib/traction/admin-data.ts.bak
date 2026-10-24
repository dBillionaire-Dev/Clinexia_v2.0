import { createRest } from "./rest.mjs"
import { addDays, addMonths, lagosDay, monthKey } from "./dates.mjs"
import { summarizeDownloads, computeDailyDeltas } from "./github.mjs"
import { computeActiveWindows, computeRetention, computeReturningPercent } from "./rollups.mjs"

export type Row = Record<string, any>

export function rest() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
  return createRest({ url, key })
}

export interface Range { from: string; to: string }

export function resolveRange(params: { from?: string; to?: string }): Range {
  const today = lagosDay(Date.now())
  const valid = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const to = valid(params.to) ?? today
  const from = valid(params.from) ?? addMonths(to.slice(0, 7) + "-01", -11)
  return from <= to ? { from, to } : { from: to, to: from }
}

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from.slice(0, 7) + "-01"
  while (cur.slice(0, 7) <= to.slice(0, 7)) {
    out.push(cur.slice(0, 7))
    cur = addMonths(cur, 1)
  }
  return out
}

const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0)

export async function loadDashboard(range: Range) {
  const db = rest()
  const today = lagosDay(Date.now())

  const [rollups, tools, installs, snapshots, gsc, jobs, monthlyActive, activityRows] = await Promise.all([
    db.selectAll("daily_rollups", `select=date,platform,active_users,new_users,returning_users,sessions,tool_uses&order=date,platform`),
    db.selectAll("tool_usage_daily", `select=date,tool_id,tool_name,uses&date=gte.${range.from}&date=lte.${range.to}&order=date,tool_id`),
    db.selectAll("pwa_installs_daily", "select=date,installs&order=date"),
    db.selectAll("apk_downloads_snapshots", "select=*&order=release_tag,asset_name,snapshot_date"),
    db.selectAll("search_console_daily", `select=date,query,page,clicks,impressions,position&date=gte.${range.from}&date=lte.${range.to}&order=date,row_hash`),
    db.selectAll("traction_job_runs", "select=*"),
    db.rpc("traction_monthly_active", { p_from: range.from.slice(0, 7) + "-01" }),
    db.selectAll("traction_activity_days", "select=day,anonymous_id,platform&order=day,anonymous_id,platform"),
  ])

  const totalUsers = Number((await db.rpc("traction_distinct_active", { p_from: "2000-01-01", p_to: today })) ?? 0)
  const activity = activityRows.map((r: Row) => ({ day: r.day, anonymousId: r.anonymous_id, platform: r.platform }))
  const windows = computeActiveWindows(activity, today)
  const returningPct = computeReturningPercent(activity, addDays(today, -29), today)
  const retention = computeRetention(activity, today)

  const allRollups = rollups.filter((r: Row) => r.platform === "all")
  const inRange = (d: string) => d >= range.from && d <= range.to
  const rangeRollups = allRollups.filter((r: Row) => inRange(r.date))

  // Monthly series
  const months = monthsBetween(range.from, range.to)
  const mauByMonth = new Map<string, number>((monthlyActive ?? []).map((r: Row) => [String(r.month).slice(0, 7), Number(r.mau)]))
  const deltas = computeDailyDeltas(snapshots)
  const gscMonthly = new Map<string, { clicks: number; impressions: number }>()
  for (const r of gsc) {
    const m = monthKey(r.date)
    const cur = gscMonthly.get(m) ?? { clicks: 0, impressions: 0 }
    cur.clicks += r.clicks
    cur.impressions += r.impressions
    gscMonthly.set(m, cur)
  }
  const monthly = months.map((m) => {
    const days = allRollups.filter((r: Row) => monthKey(r.date) === m)
    const sessionDays = days.filter((r: Row) => r.sessions !== null)
    return {
      month: m,
      mau: mauByMonth.get(m) ?? 0,
      newUsers: sum(days, "new_users"),
      toolUses: sum(days, "tool_uses"),
      sessions: sessionDays.length ? sum(sessionDays, "sessions") : null,
      apkDownloads: sum(deltas.filter((d: Row) => monthKey(d.date) === m), "delta"),
      pwaInstalls: sum(installs.filter((r: Row) => monthKey(r.date) === m), "installs"),
      gscClicks: gscMonthly.get(m)?.clicks ?? 0,
      gscImpressions: gscMonthly.get(m)?.impressions ?? 0,
    }
  })

  // Top tools
  const toolTotals = new Map<string, { toolId: string; name: string; uses: number }>()
  for (const r of tools) {
    const cur = toolTotals.get(r.tool_id) ?? { toolId: r.tool_id, name: r.tool_name ?? r.tool_id, uses: 0 }
    cur.uses += r.uses
    toolTotals.set(r.tool_id, cur)
  }
  const topTools = [...toolTotals.values()].sort((a, b) => b.uses - a.uses).slice(0, 20)

  // Platform split
  const platformSplit = ["web", "pwa", "android", "windows"].map((platform) => {
    const rows = rollups.filter((r: Row) => r.platform === platform && inRange(r.date))
    return { platform, activeUserDays: sum(rows, "active_users"), toolUses: sum(rows, "tool_uses") }
  })

  // Search Console aggregates
  const agg = (key: "query" | "page") => {
    const map = new Map<string, { label: string; clicks: number; impressions: number; posWeighted: number }>()
    for (const r of gsc) {
      const cur = map.get(r[key]) ?? { label: r[key], clicks: 0, impressions: 0, posWeighted: 0 }
      cur.clicks += r.clicks
      cur.impressions += r.impressions
      cur.posWeighted += r.position * r.impressions
      map.set(r[key], cur)
    }
    return [...map.values()]
      .map((v) => ({ label: v.label, clicks: v.clicks, impressions: v.impressions, position: v.impressions ? v.posWeighted / v.impressions : 0 }))
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 20)
  }
  const gscLatest = gsc.length ? gsc[gsc.length - 1].date : null
  const gscFrom = gscLatest ? addDays(gscLatest, -27) : null
  const gsc28 = gscFrom ? gsc.filter((r: Row) => r.date >= gscFrom) : []

  // APK
  const apk = summarizeDownloads(snapshots, today)

  // Coverage
  const range_ = (rows: Row[], key: string) => {
    if (!rows.length) return null
    let min = rows[0][key] as string
    let max = min
    for (const r of rows) {
      if (r[key] < min) min = r[key]
      if (r[key] > max) max = r[key]
    }
    return { from: min, to: max }
  }
  const sessionRows = allRollups.filter((r: Row) => r.sessions !== null)
  const jobAt = (job: string) => jobs.find((j: Row) => j.job === job)?.ran_at ?? null
  const coverage = [
    { metric: "Active users, new / returning, tool uses", source: "First-party (own events)", range: range_(allRollups, "date"), note: "Active = a production calculation or a heartbeat that day. Before heartbeats were stored, only users who ran a calculation are counted; devices that never came back after analytics shipped are invisible.", syncedAt: jobAt("rebuild-rollups") },
    { metric: "Sessions", source: "First-party (heartbeats)", range: range_(sessionRows, "date"), note: sessionRows.length ? "Recorded from the first date shown; earlier days are blank, not zero." : "Not recorded yet: starts the day the new heartbeat code is deployed.", syncedAt: jobAt("rebuild-rollups") },
    { metric: "Retention (D1 / D7 / D30)", source: "First-party (derived)", range: range_(allRollups, "date"), note: "Computed from the anonymous visitor id. A reinstall or cleared storage creates a new id, so retention is a lower bound.", syncedAt: null },
    { metric: "APK downloads (GitHub)", source: "External (GitHub Releases API)", range: range_(snapshots, "snapshot_date"), note: apk.trackedSince ? `Downloads before ${apk.trackedSince} are a single cumulative baseline per release (exact dates unknown). Only GitHub downloads are counted.` : "No snapshots yet.", syncedAt: jobAt("sync-github") },
    { metric: "PWA installs", source: "First-party (appinstalled event)", range: range_(installs, "date"), note: "Undercounts: Safari/iOS never fires appinstalled. Recording starts when this feature is deployed.", syncedAt: jobAt("rebuild-rollups") },
    { metric: "Search Console", source: "External (Google Search Console API)", range: range_(gsc, "date"), note: "Maximum history the API allows (~16 months). Anonymized queries are omitted by Google, so query totals sit below site totals.", syncedAt: jobAt("sync-search-console") },
  ]

  return {
    today,
    cards: {
      totalUsers,
      dau: windows.dau, wau: windows.wau, mau: windows.mau, returningPct,
      totalToolUses: sum(allRollups, "tool_uses"),
      apk,
      installsTotal: sum(installs, "installs"),
      installs30: sum(installs.filter((r: Row) => r.date >= addDays(today, -29)), "installs"),
      gscClicks28: sum(gsc28, "clicks"),
      gscImpressions28: sum(gsc28, "impressions"),
      gscWindow: gscFrom && gscLatest ? { from: gscFrom, to: gscLatest } : null,
      retention,
    },
    monthly, topTools, platformSplit,
    topQueries: agg("query"), topPages: agg("page"),
    coverage,
    rangeTotals: { toolUses: sum(rangeRollups, "tool_uses") },
  }
}

export async function loadRevenue() {
  const rows = await rest().selectAll("revenue_entries", "select=*&order=date.desc,created_at.desc")
  const bySource: Record<string, number> = { ads: 0, sponsorship: 0, other: 0 }
  for (const r of rows) bySource[r.source] = (bySource[r.source] ?? 0) + Number(r.amount_usd)
  return { rows, total: Object.values(bySource).reduce((a, b) => a + b, 0), bySource }
}

export async function addRevenue(entry: { date: string; source: string; amount: number; notes: string }) {
  await rest().insert("revenue_entries", {
    date: entry.date, source: entry.source, amount_usd: entry.amount, notes: entry.notes || null, entered_manually: true,
  })
}
