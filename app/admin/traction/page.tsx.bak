import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { loadDashboard, resolveRange } from "@/lib/traction/admin-data"
import { AdminNav, Card, ExportLink, Section, SimpleTable, num, pct } from "@/components/admin/traction-ui"
import { HorizontalBars, MonthlyTrends } from "@/components/admin/traction-charts"

export const dynamic = "force-dynamic"

const RAW_EXPORTS: [string, string][] = [
  ["daily_rollups", "Daily rollups"],
  ["tool_usage_daily", "Tool usage (daily)"],
  ["search_console_daily", "Search Console (daily)"],
  ["apk_downloads_snapshots", "APK download snapshots"],
  ["pwa_installs_daily", "PWA installs (daily)"],
  ["revenue_entries", "Revenue entries"],
]

export default async function TractionPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const range = resolveRange(await searchParams)

  let data: Awaited<ReturnType<typeof loadDashboard>> | null = null
  let error: string | null = null
  try {
    data = await loadDashboard(range)
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load traction data. Did you run supabase/traction.sql?"
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <AdminNav current="overview" />
        <h1 className="text-3xl font-bold tracking-tight">Traction metrics</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Read-only. Anonymous, first-party usage plus external sources; nothing here identifies a person. Days use the Africa/Lagos calendar.
        </p>

        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">From<input type="date" name="from" defaultValue={range.from} className="ml-2 rounded-md border bg-background px-2 py-1.5" /></label>
          <label className="text-sm">To<input type="date" name="to" defaultValue={range.to} className="ml-2 rounded-md border bg-background px-2 py-1.5" /></label>
          <button className="rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">Apply</button>
        </form>

        {error ? <div role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}

        {data ? (
          <>
            <Section title="Road to 1,000 users">
              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-muted-foreground">Different people who have used Clinexia (all time, anonymous)</p>
                  <p className="text-2xl font-bold tabular-nums">{num(data.cards.totalUsers)} <span className="text-base font-normal text-muted-foreground">of 1,000</span></p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={1000} aria-valuenow={Math.min(data.cards.totalUsers, 1000)}>
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (data.cards.totalUsers / 1000) * 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.cards.totalUsers >= 1000 ? "Goal reached." : `${num(1000 - data.cards.totalUsers)} to go.`} Counts distinct anonymous ids, so one person on two devices counts twice, and a cleared browser counts again.
                </p>
              </div>
            </Section>

            <Section title="Overview">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card label="MAU (last 30 days)" value={num(data.cards.mau)} />
                <Card label="WAU (last 7 days)" value={num(data.cards.wau)} />
                <Card label="DAU (today)" value={num(data.cards.dau)} />
                <Card label="Returning users (30 days)" value={pct(data.cards.returningPct)} hint="Seen on 2+ different days" />
                <Card label="Total tool uses" value={num(data.cards.totalToolUses)} />
                <Card label="APK downloads (total)" value={num(data.cards.apk.total)} hint={`Last 30 days: ${num(data.cards.apk.last30)} · GitHub only`} />
                <Card label="PWA installs" value={num(data.cards.installsTotal)} hint={`Last 30 days: ${num(data.cards.installs30)} · undercounts (no Safari/iOS)`} />
                <Card label="Search clicks (28 days)" value={num(data.cards.gscClicks28)} hint={data.cards.gscWindow ? `${data.cards.gscWindow.from} → ${data.cards.gscWindow.to}` : "No Search Console data yet"} />
                <Card label="Search impressions (28 days)" value={num(data.cards.gscImpressions28)} />
                <Card label="Retention D1" value={pct(data.cards.retention.d1.rate)} hint={`${num(data.cards.retention.d1.retained)} of ${num(data.cards.retention.d1.cohort)}`} />
                <Card label="Retention D7" value={pct(data.cards.retention.d7.rate)} hint={`${num(data.cards.retention.d7.retained)} of ${num(data.cards.retention.d7.cohort)}`} />
                <Card label="Retention D30" value={pct(data.cards.retention.d30.rate)} hint={`${num(data.cards.retention.d30.retained)} of ${num(data.cards.retention.d30.cohort)}`} />
              </div>
            </Section>

            <Section title="Monthly trends" action={<ExportLink table="monthly" from={range.from} to={range.to} />}>
              <MonthlyTrends data={data.monthly} />
            </Section>

            <Section title="Top 20 tools" action={<ExportLink table="top_tools" from={range.from} to={range.to} />}>
              <div className="rounded-xl border bg-background p-4">
                {data.topTools.length ? <HorizontalBars data={data.topTools} labelKey="name" valueKey="uses" /> : <p className="text-sm text-muted-foreground">No tool usage in this range.</p>}
              </div>
            </Section>

            <Section title="Platform split" action={<ExportLink table="platform_split" from={range.from} to={range.to} />}>
              <SimpleTable
                columns={[{ key: "platform", label: "Platform" }, { key: "activeUserDays", label: "Active user-days", align: "right", format: num }, { key: "toolUses", label: "Tool uses", align: "right", format: num }]}
                rows={data.platformSplit}
              />
            </Section>

            <div className="grid gap-6 lg:grid-cols-2">
              <Section title="Top search queries" action={<ExportLink table="top_queries" from={range.from} to={range.to} />}>
                <SimpleTable columns={[{ key: "label", label: "Query" }, { key: "clicks", label: "Clicks", align: "right", format: num }, { key: "impressions", label: "Impr.", align: "right", format: num }, { key: "position", label: "Pos.", align: "right", format: (v) => Number(v).toFixed(1) }]} rows={data.topQueries} />
              </Section>
              <Section title="Top search pages" action={<ExportLink table="top_pages" from={range.from} to={range.to} />}>
                <SimpleTable columns={[{ key: "label", label: "Page" }, { key: "clicks", label: "Clicks", align: "right", format: num }, { key: "impressions", label: "Impr.", align: "right", format: num }, { key: "position", label: "Pos.", align: "right", format: (v) => Number(v).toFixed(1) }]} rows={data.topPages} />
              </Section>
            </div>

            <Section title="Data coverage" action={<ExportLink table="coverage" />}>
              <div className="overflow-x-auto rounded-xl border bg-background">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr><th className="px-3 py-2">Metric</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Covers</th><th className="px-3 py-2">Last sync</th><th className="px-3 py-2">Notes</th></tr>
                  </thead>
                  <tbody>
                    {data.coverage.map((c) => (
                      <tr key={c.metric} className="border-b align-top last:border-0">
                        <td className="px-3 py-2 font-medium">{c.metric}</td>
                        <td className="px-3 py-2">{c.source}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{c.range ? `${c.range.from} → ${c.range.to}` : "No data yet (starts when first recorded)"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{c.syncedAt ? new Date(c.syncedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "–"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        ) : null}

        <Section title="Export raw tables (CSV, uses the date range above)">
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border bg-background p-4 text-sm">
            {RAW_EXPORTS.map(([table, label]) => (
              <span key={table} className="flex items-center gap-2">{label} <ExportLink table={table} from={range.from} to={range.to} /></span>
            ))}
          </div>
        </Section>
      </div>
    </main>
  )
}
