import Link from "next/link"
import { redirect } from "next/navigation"
import { clearAdminCookie, isAdminAuthenticated } from "@/lib/admin-auth"
import type { AnalyticsSnapshot } from "@/lib/analytics/types"
import { AdminUserManagementTable } from "@/components/admin-user-management"

async function getAnalytics(): Promise<AnalyticsSnapshot> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return {
      total: 0,
      today: 0,
      thisWeek: 0,
      last7Days: 0,
      last14Days: 0,
      activeUsers: 0,
      uniqueUsersToday: 0,
      uniqueUsersLast14Days: 0,
      totalUsers: 0,
      activeUsersList: [],
      allUsersList: [],
      offlineSynced: 0,
      historyBackfilled: 0,
      topCalculators: [],
      categories: [],
      sources: [],
      environments: [],
      versions: [],
      daily: [],
      lastEvent: null,
    }
  }

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/convertlab_usage_summary_v3`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  })

  if (!response.ok) throw new Error("Unable to load analytics.")

  const result = await response.json()

  // Keep the dashboard backward-compatible with analytics functions created
  // before the source/environment/version fields were added.
  return {
    total: Number(result?.total ?? 0),
    today: Number(result?.today ?? 0),
    thisWeek: Number(result?.thisWeek ?? 0),
    last7Days: Number(result?.last7Days ?? 0),
    last14Days: Number(result?.last14Days ?? 0),
    activeUsers: Number(result?.activeUsers ?? 0),
    uniqueUsersToday: Number(result?.uniqueUsersToday ?? 0),
    uniqueUsersLast14Days: Number(result?.uniqueUsersLast14Days ?? 0),
    totalUsers: Number(result?.totalUsers ?? 0),
    activeUsersList: Array.isArray(result?.activeUsersList) ? result.activeUsersList : [],
    allUsersList: Array.isArray(result?.allUsersList) ? result.allUsersList : [],
    offlineSynced: Number(result?.offlineSynced ?? 0),
    historyBackfilled: Number(result?.historyBackfilled ?? 0),
    topCalculators: Array.isArray(result?.topCalculators) ? result.topCalculators : [],
    categories: Array.isArray(result?.categories) ? result.categories : [],
    sources: Array.isArray(result?.sources) ? result.sources : [],
    environments: Array.isArray(result?.environments) ? result.environments : [],
    versions: Array.isArray(result?.versions) ? result.versions : [],
    daily: Array.isArray(result?.daily) ? result.daily : [],
    lastEvent: result?.lastEvent && typeof result.lastEvent === "object" ? result.lastEvent : null,
  }
}

async function logout() {
  "use server"
  await clearAdminCookie()
  redirect("/admin/login")
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

const NIGERIA_TIME_ZONE = "Africa/Lagos"

function localDateTime(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: NIGERIA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")

  let data: AnalyticsSnapshot
  let error = ""

  try {
    data = await getAnalytics()
  } catch {
    data = {
      total: 0,
      today: 0,
      thisWeek: 0,
      last7Days: 0,
      last14Days: 0,
      activeUsers: 0,
      uniqueUsersToday: 0,
      uniqueUsersLast14Days: 0,
      totalUsers: 0,
      activeUsersList: [],
      allUsersList: [],
      offlineSynced: 0,
      historyBackfilled: 0,
      topCalculators: [],
      categories: [],
      sources: [],
      environments: [],
      versions: [],
      daily: [],
      lastEvent: null,
    }
    error = "Analytics could not be loaded. Check your Supabase configuration."
  }

  const maxDaily = Math.max(...data.daily.map((item) => item.uses), 1)

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Analytical Console</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Anonymous calculation and device activity across the product.
            </p>
          </div>
          <form action={logout}>
            <button className="rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              Sign out
            </button>
          </form>
        </div>

        <nav className="mb-6 flex flex-wrap gap-2 text-sm">
          <Link href="/admin/traction" className="rounded-md border bg-background px-3 py-2 font-medium hover:bg-muted">Traction metrics</Link>
          <Link href="/admin/traction/report" className="rounded-md border bg-background px-3 py-2 font-medium hover:bg-muted">Buyer report</Link>
          <Link href="/admin/traction/revenue" className="rounded-md border bg-background px-3 py-2 font-medium hover:bg-muted">Revenue</Link>
          <Link href="/admin/feedback" className="rounded-md border bg-background px-3 py-2 font-medium hover:bg-muted">Feedback</Link>
          <Link href="/admin/accounts" className="rounded-md border bg-background px-3 py-2 font-medium hover:bg-muted">Accounts management</Link>
        </nav>

        {error ? (
          <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total calculations", data.total],
            ["Calculations today", data.today],
            ["Calculations · 7 days", data.last7Days],
            ["Calculations · 14 days", data.last14Days],
            ["Total users/devices", data.totalUsers],
            ["Active now", data.activeUsers],
            ["Users today", data.uniqueUsersToday],
            ["Users · 14 days", data.uniqueUsersLast14Days],
            ["Historical backlog", data.historyBackfilled],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border bg-background p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-bold">{number(Number(value))}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-background p-5 shadow-sm">
            <h2 className="font-semibold">Most used calculators</h2>
            <div className="mt-4 space-y-3">
              {data.topCalculators.length ? data.topCalculators.map((item, index) => (
                <div key={item.calculatorId} className="flex items-center gap-3">
                  <span className="w-5 text-sm text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{item.calculatorName}</span>
                      <span className="font-medium">{number(item.uses)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max((item.uses / Math.max(data.topCalculators[0]?.uses ?? 1, 1)) * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">No calculations recorded yet.</p>}
            </div>
          </div>

          <div className="rounded-xl border bg-background p-5 shadow-sm">
            <h2 className="font-semibold">Usage by category</h2>
            <div className="mt-4 space-y-3">
              {data.categories.length ? data.categories.map((item) => (
                <div key={item.category}>
                  <div className="flex justify-between text-sm">
                    <span>{item.category}</span>
                    <span className="font-medium">{number(item.uses)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max((item.uses / Math.max(data.total, 1)) * 100, 1)}%` }}
                    />
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">No categories recorded yet.</p>}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border bg-background p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold">All users / devices</h2>
              <p className="mt-1 text-xs text-muted-foreground">Every anonymous browser, PWA or Android installation ever recorded. Active means seen within the last 5 minutes.</p>
            </div>
            <span className="text-sm font-medium">{number(data.totalUsers)} total</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <AdminUserManagementTable users={data.allUsersList} />
          </div>
        </section>

        {data.lastEvent ? (
          <section className="mt-6 rounded-xl border bg-background p-5 shadow-sm">
            <h2 className="font-semibold">Last calculation received</h2>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
              <div><p className="text-muted-foreground">Calculator</p><p className="mt-1 font-medium truncate">{data.lastEvent.calculatorName}</p></div>
              <div><p className="text-muted-foreground">Source</p><p className="mt-1 font-medium capitalize">{data.lastEvent.source}</p></div>
              <div><p className="text-muted-foreground">Environment</p><p className="mt-1 font-medium">{data.lastEvent.environment}</p></div>
              <div><p className="text-muted-foreground">Version</p><p className="mt-1 font-medium">{data.lastEvent.appVersion}</p></div>
              <div><p className="text-muted-foreground">Received</p><p className="mt-1 font-medium">{localDateTime(data.lastEvent.receivedAt)}</p></div>
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border bg-background p-5 shadow-sm">
            <h2 className="font-semibold">Usage sources</h2>
            <div className="mt-4 space-y-3">
              {data.sources.length ? data.sources.map((item) => (
                <div key={item.source} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{item.source}</span>
                  <span className="font-medium">{number(item.uses)}</span>
                </div>
              )) : <p className="text-sm text-muted-foreground">No sources recorded yet.</p>}
            </div>
          </div>

          <div className="rounded-xl border bg-background p-5 shadow-sm">
            <h2 className="font-semibold">Environments</h2>
            <div className="mt-4 space-y-3">
              {data.environments.length ? data.environments.map((item) => (
                <div key={item.environment} className="flex items-center justify-between text-sm">
                  <span className="truncate">{item.environment}</span>
                  <span className="font-medium">{number(item.uses)}</span>
                </div>
              )) : <p className="text-sm text-muted-foreground">No environments recorded yet.</p>}
            </div>
          </div>

          <div className="rounded-xl border bg-background p-5 shadow-sm">
            <h2 className="font-semibold">App versions</h2>
            <div className="mt-4 space-y-3">
              {data.versions.length ? data.versions.map((item) => (
                <div key={item.appVersion} className="flex items-center justify-between text-sm">
                  <span className="truncate">{item.appVersion}</span>
                  <span className="font-medium">{number(item.uses)}</span>
                </div>
              )) : <p className="text-sm text-muted-foreground">No versions recorded yet.</p>}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border bg-background p-5 shadow-sm">
          <h2 className="font-semibold">Last 14 days</h2>
          <div className="mt-6 grid grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-2" style={{ minHeight: 180 }}>
            {data.daily.map((item) => (
              <div key={item.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                <span className="text-[10px] text-muted-foreground">{item.uses || ""}</span>
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${Math.max((item.uses / maxDaily) * 130, item.uses ? 4 : 1)}px` }}
                  title={`${item.date}: ${item.uses} calculations`}
                />
                <span className="text-[9px] text-muted-foreground">{item.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          Usage is anonymous. Each browser, PWA or Android installation receives a stable pseudonym such as User-7A31C2; it is not a real name or account identity. Active means seen within the last 5 minutes.
          Calculation inputs and results are not sent to analytics by this implementation.
        </p>
      </div>
    </main>
  )
}
