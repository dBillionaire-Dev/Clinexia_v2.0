// Rebuilds daily_rollups, tool_usage_daily and pwa_installs_daily from the raw first-party data. Idempotent (upserts by primary key).
// Used by the nightly job (scripts/traction/rebuild-rollups.mjs) and by the admin traction page, which refreshes the last few days
// itself when they are stale, so new installs and usage show up without waiting for the nightly job.
import { addDays, lagosDay } from "./dates.mjs"
import { PLATFORMS, computeDailyRollups, computeToolUsage } from "./rollups.mjs"

const normalize = (p) => (PLATFORMS.includes(p) ? p : "web")

/**
 * sinceDays = null rebuilds everything; a number rebuilds only that many recent days. Returns a one-line summary.
 * @param {any} rest
 * @param {{ sinceDays?: number | null, now?: number, job?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function rebuildRollups(rest, { sinceDays = null, now = Date.now(), job = "rebuild-rollups" } = {}) {
  const today = lagosDay(now)
  const writeFrom = sinceDays ? addDays(today, -sinceDays) : "0000-00-00"
  // Lagos days start an hour before UTC days, so read events from a day earlier than the first day written.
  const eventsSince = sinceDays ? `&occurred_at=gte.${addDays(writeFrom, -1)}T00:00:00Z` : ""
  try {
    const events = await rest.selectAll(
      "calculation_events",
      `select=id,anonymous_id,calculator_id,calculator_name,occurred_at,source&environment=eq.production${eventsSince}&order=id`,
    )
    const activityRows = await rest.selectAll("traction_activity_days", "select=day,anonymous_id,platform&order=day,anonymous_id,platform")
    const visitorDays = await rest.selectAll("visitor_days", "select=day,anonymous_id,platform,sessions&order=day,anonymous_id,platform")

    const activity = activityRows.map((r) => ({ day: r.day, anonymousId: r.anonymous_id, platform: normalize(r.platform) }))
    const toolEvents = events.map((e) => ({ day: lagosDay(e.occurred_at), toolId: e.calculator_id, toolName: e.calculator_name, platform: normalize(e.source) }))

    const rollups = computeDailyRollups({
      activity,
      visitorDays: visitorDays.map((r) => ({ day: r.day, anonymousId: r.anonymous_id, platform: normalize(r.platform), sessions: r.sessions })),
      toolEvents,
    }).filter((r) => r.date >= writeFrom)
    const tools = computeToolUsage(toolEvents).filter((r) => r.date >= writeFrom)

    const installs = await rest.selectAll("pwa_install_events", "select=anonymous_id,installed_at&order=anonymous_id")
    const perDay = new Map()
    for (const i of installs) {
      const d = lagosDay(i.installed_at)
      perDay.set(d, (perDay.get(d) ?? 0) + 1)
    }
    const installRows = [...perDay].map(([date, n]) => ({ date, installs: n })).filter((r) => r.date >= writeFrom)

    await rest.upsert("daily_rollups", rollups, "date,platform")
    await rest.upsert("tool_usage_daily", tools, "date,tool_id")
    await rest.upsert("pwa_installs_daily", installRows, "date")
    const detail = `${rollups.length} rollup rows, ${tools.length} tool rows, ${installRows.length} install days`
    await rest.logRun(job, "ok", detail)
    return detail
  } catch (error) {
    try { await rest.logRun(job, "error", error.message) } catch { /* the original error is what matters */ }
    throw error
  }
}
