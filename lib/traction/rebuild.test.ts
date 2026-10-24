import { describe, expect, it } from "vitest"
import { rebuildRollups } from "./rebuild.mjs"

const NOW = Date.parse("2026-11-10T12:00:00Z")

function fakeRest(tables: Record<string, any[]>, opts: { failOn?: string } = {}) {
  const calls: { select: string[]; upsert: Record<string, any[]>; logs: any[]; queries: Record<string, string> } = { select: [], upsert: {}, logs: [], queries: {} }
  return {
    calls,
    rest: {
      async selectAll(table: string, query: string) { calls.select.push(table); calls.queries[table] = query; if (opts.failOn === table) throw new Error(`boom ${table}`); return tables[table] ?? [] },
      async upsert(table: string, rows: any[]) { calls.upsert[table] = rows },
      async logRun(job: string, status: string, detail: string) { calls.logs.push({ job, status, detail }) },
    },
  }
}

const tables = () => ({
  calculation_events: [
    { id: 1, anonymous_id: "a", calculator_id: "dilution", calculator_name: "Dilution", occurred_at: "2026-11-10T08:00:00Z", source: "web" },
    { id: 2, anonymous_id: "b", calculator_id: "dilution", calculator_name: "Dilution", occurred_at: "2026-11-09T08:00:00Z", source: "pwa" },
  ],
  traction_activity_days: [
    { day: "2026-11-09", anonymous_id: "b", platform: "pwa" },
    { day: "2026-11-10", anonymous_id: "a", platform: "web" },
    { day: "2026-11-10", anonymous_id: "b", platform: "pwa" },
  ],
  visitor_days: [],
  pwa_install_events: [{ anonymous_id: "a", installed_at: "2026-11-10T09:00:00Z" }, { anonymous_id: "b", installed_at: "2026-10-01T09:00:00Z" }],
})

describe("rebuilding the traction numbers", () => {
  it("a recent-days refresh writes today's installs, users and tool uses, and logs the run", async () => {
    const f = fakeRest(tables())
    const detail = await rebuildRollups(f.rest, { sinceDays: 3, now: NOW })
    expect(detail).toContain("install days")
    expect(f.calls.upsert.pwa_installs_daily).toEqual([{ date: "2026-11-10", installs: 1 }]) // the October install is older than the window
    const all = f.calls.upsert.daily_rollups.filter((r) => r.platform === "all")
    expect(all.find((r) => r.date === "2026-11-10")).toMatchObject({ active_users: 2, new_users: 1, tool_uses: 1 })
    expect(f.calls.upsert.tool_usage_daily.length).toBeGreaterThan(0)
    expect(f.calls.logs[0]).toMatchObject({ job: "rebuild-rollups", status: "ok" })
  })
  it("only reads recent events for a short refresh, and everything for a full rebuild", async () => {
    const short = fakeRest(tables()); await rebuildRollups(short.rest, { sinceDays: 3, now: NOW })
    expect(short.calls.queries.calculation_events).toContain("occurred_at=gte.2026-11-06T00:00:00Z")
    const full = fakeRest(tables()); await rebuildRollups(full.rest, { sinceDays: null, now: NOW })
    expect(full.calls.queries.calculation_events).not.toContain("occurred_at=gte")
    expect(full.calls.upsert.pwa_installs_daily.map((r) => r.date).sort()).toEqual(["2026-10-01", "2026-11-10"])
  })
  it("a failure is logged and still thrown", async () => {
    const f = fakeRest(tables(), { failOn: "visitor_days" })
    await expect(rebuildRollups(f.rest, { sinceDays: 3, now: NOW })).rejects.toThrow("boom visitor_days")
    expect(f.calls.logs[0]).toMatchObject({ status: "error" })
  })
})
