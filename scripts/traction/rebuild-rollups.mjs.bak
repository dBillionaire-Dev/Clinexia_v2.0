#!/usr/bin/env node
// Rebuilds daily_rollups, tool_usage_daily and pwa_installs_daily from the raw first-party data.
// Idempotent: results are upserted by primary key, so it is safe to re-run at any time.
//   node --env-file=.env.local scripts/traction/rebuild-rollups.mjs            # full backfill from every stored event
//   node --env-file=.env.local scripts/traction/rebuild-rollups.mjs --since-days 45   # only write the last 45 days
import { restFromEnv } from "../../lib/traction/rest.mjs"
import { lagosDay, addDays } from "../../lib/traction/dates.mjs"
import { PLATFORMS, computeDailyRollups, computeToolUsage } from "../../lib/traction/rollups.mjs"

const argIndex = process.argv.indexOf("--since-days")
const sinceDays = argIndex > -1 ? Number(process.argv[argIndex + 1]) : null
if (argIndex > -1 && !(sinceDays > 0)) throw new Error("--since-days needs a positive number")

const normalize = (p) => (PLATFORMS.includes(p) ? p : "web")
const rest = restFromEnv()
const today = lagosDay(Date.now())
const writeFrom = sinceDays ? addDays(today, -sinceDays) : "0000-00-00"

try {
  console.log("Reading production calculation events…")
  const events = await rest.selectAll(
    "calculation_events",
    "select=id,anonymous_id,calculator_id,calculator_name,occurred_at,source&environment=eq.production&order=id",
  )
  console.log(`  ${events.length} events`)
  const activityRows = await rest.selectAll("traction_activity_days", "select=day,anonymous_id,platform&order=day,anonymous_id,platform")
  const visitorDays = await rest.selectAll("visitor_days", "select=day,anonymous_id,platform,sessions&order=day,anonymous_id,platform")

  const activity = activityRows.map((r) => ({ day: r.day, anonymousId: r.anonymous_id, platform: normalize(r.platform) }))
  const toolEvents = events.map((e) => ({
    day: lagosDay(e.occurred_at),
    toolId: e.calculator_id,
    toolName: e.calculator_name,
    platform: normalize(e.source),
  }))

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
  await rest.logRun("rebuild-rollups", "ok", detail)
  console.log(`Done: ${detail}`)
} catch (error) {
  console.error("rebuild-rollups failed:", error.message)
  try { await rest.logRun("rebuild-rollups", "error", error.message) } catch {}
  process.exit(1)
}
