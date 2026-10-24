#!/usr/bin/env node
// Rebuilds daily_rollups, tool_usage_daily and pwa_installs_daily from the raw first-party data.
// Idempotent: results are upserted by primary key, so it is safe to re-run at any time.
//   node --env-file=.env.local scripts/traction/rebuild-rollups.mjs            # full backfill from every stored event
//   node --env-file=.env.local scripts/traction/rebuild-rollups.mjs --since-days 45   # only write the last 45 days
import { restFromEnv } from "../../lib/traction/rest.mjs"
import { rebuildRollups } from "../../lib/traction/rebuild.mjs"

const argIndex = process.argv.indexOf("--since-days")
const sinceDays = argIndex > -1 ? Number(process.argv[argIndex + 1]) : null
if (argIndex > -1 && !(sinceDays > 0)) throw new Error("--since-days needs a positive number")

try {
  console.log("Rebuilding rollups…")
  console.log(`Done: ${await rebuildRollups(restFromEnv(), { sinceDays })}`)
} catch (error) {
  console.error("rebuild-rollups failed:", error.message)
  process.exit(1)
}
