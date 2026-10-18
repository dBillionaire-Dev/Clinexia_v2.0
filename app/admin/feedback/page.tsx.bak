import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { deleteFeedback, getFeedbackConfig, listFeedback, saveFeedbackSettings } from "@/lib/feedback/server"
import { BACKGROUND, labelOf, MED_ROLES, NON_MED_ROLES, OFFICE_TYPES, PAY_INTEREST, PAY_WHO, PRICE_INDIVIDUAL, PRICE_TEAM, USE_CONTEXT } from "@/lib/feedback/questions"
import { summarize, type Tally } from "@/lib/feedback/summary"
import { AdminNav, Card, Section, num, pct } from "@/components/admin/traction-ui"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
}

async function toggleEnabled(formData: FormData) {
  "use server"
  await requireAdmin()
  await saveFeedbackSettings({ enabled: formData.get("enabled") === "true" })
  revalidatePath("/admin/feedback")
}

async function updateTiming(formData: FormData) {
  "use server"
  await requireAdmin()
  const hours = Math.min(8760, Math.max(1, Math.floor(Number(formData.get("hours")) || 1)),)
  const max = Math.min(50, Math.max(0, Math.floor(Number(formData.get("max")) || 0)),)
  await saveFeedbackSettings({ remind_after_hours: hours, max_reminders: max,})
  revalidatePath("/admin/feedback")
}

async function askEveryoneAgain() {
  "use server"
  await requireAdmin()
  const current = await getFeedbackConfig()
  await saveFeedbackSettings({ survey_version: current.version + 1, enabled: true })
  revalidatePath("/admin/feedback")
  redirect("/admin/feedback")
}

async function removeResponse(formData: FormData) {
  "use server"
  await requireAdmin()
  await deleteFeedback(String(formData.get("id") ?? ""))
  revalidatePath("/admin/feedback")
}

function Bars({ title, items }: { title: string; items: Tally[] }) {
  const shown = items.filter((i) => i.count > 0)
  return (
    <div className="rounded-xl border bg-background p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {shown.length ? (
        <ul className="space-y-2">
          {shown.map((i) => (
            <li key={i.value} className="text-sm">
              <div className="flex justify-between gap-2"><span className="truncate">{i.label}</span><span className="tabular-nums text-muted-foreground">{i.count} · {pct(i.share)}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, i.share * 100)}%` }} /></div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No answers yet.</p>
      )}
    </div>
  )
}

// Amounts are in Naira (the price bands in lib/feedback/questions.ts). Averages are estimates from band midpoints.
const ngn = (n: number | null) => (n === null ? "–" : `₦${Math.round(n).toLocaleString("en-NG")}`)

export default async function FeedbackAdminPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  await requireAdmin()
  const params = await searchParams
  const config = await getFeedbackConfig()
  const selected = params.version === "all" ? null : Number.isInteger(Number(params.version)) && params.version ? Number(params.version) : config.version

  let rows: Awaited<ReturnType<typeof listFeedback>> = []
  let error: string | null = null
  try {
    rows = await listFeedback(selected)
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load feedback. Did you run supabase/feedback.sql?"
  }
  const s = summarize(rows)
  const texts = rows.filter((r) => r.improve || r.missing || r.other).slice(0, 60)
  const field = "rounded-md border bg-background px-2 py-1.5 text-sm"
  const btn = "rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <AdminNav current="feedback" />
        <h1 className="text-3xl font-bold tracking-tight">User feedback</h1>
        <p className="mt-2 text-sm text-muted-foreground">Anonymous answers from the in-app popup and the /feedback page. Names, emails and IP addresses are never collected.</p>
        {error ? <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}

        <Section title="Asking users">
          <div className="grid gap-4 rounded-xl border bg-background p-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm">Status: <span className={config.enabled ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>{config.enabled ? "On" : "Paused"}</span> · Round <span className="font-semibold">{config.version}</span></p>
              <form action={toggleEnabled}>
                <input type="hidden" name="enabled" value={config.enabled ? "false" : "true"} />
                <button className={btn}>{config.enabled ? "Pause the popup" : "Turn the popup on"}</button>
              </form>
              <p className="text-xs text-muted-foreground">Starts after someone has used 3 calculations or 3 different days. Paused means nobody is asked.</p>
            </div>
            <form action={updateTiming} className="space-y-2">
              <label className="block text-sm">
                Remind again after
                <input
                  name="hours"
                  type="number"
                  min={1}
                  max={8760}
                  required
                  defaultValue={config.remindAfterHours}
                  className={`${field} ml-2 w-24`}
                />{" "}
                hours
              </label>

              <label className="block text-sm">
                Stop after
                <input
                  name="max"
                  type="number"
                  min={0}
                  max={50}
                  required
                  defaultValue={config.maxReminders}
                  className={`${field} ml-2 w-20`}
                />{" "}
                “Later” taps
              </label>

              <button className={btn}>Save timing</button>
            </form>
            <div className="space-y-2">
              <form action={askEveryoneAgain}><button className={btn}>Ask everyone again (new round)</button></form>
              <p className="text-xs text-muted-foreground">Starts round {config.version + 1}: people who already answered, or said never, are asked once more. Earlier answers are kept.</p>
            </div>
          </div>
        </Section>

        <form method="get" className="mt-8 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold">Showing</span>
          <select name="version" defaultValue={selected === null ? "all" : String(selected)} className={field}>
            {Array.from({ length: config.version }, (_, i) => config.version - i).map((v) => <option key={v} value={v}>Round {v}{v === config.version ? " (current)" : ""}</option>)}
            <option value="all">All rounds</option>
          </select>
          <button className={btn}>Apply</button>
          <a className="text-xs font-medium text-blue-600 hover:underline" href={`/api/admin/feedback/export?version=${selected ?? "all"}`} download>Export CSV</a>
        </form>

        <Section title="At a glance">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Responses" value={num(s.count)} />
            <Card label="Average rating" value={s.averageRating === null ? "–" : `${s.averageRating.toFixed(1)} / 5`} />
            <Card label="Would pay (yes or maybe)" value={pct(s.willingShare)} />
            <Card label="Typical price, per person / month" value={ngn(s.individualAverageUsd)} hint="Estimate from price-band midpoints, among people who would pay" />
            <Card label="Typical team price, 10 seats / month" value={ngn(s.teamAverageUsd)} hint="Same estimate, only those who answered it" />
          </div>
        </Section>

        <Section title="Who is answering">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Bars title="Rating" items={s.ratings.map((r) => ({ value: String(r.stars), label: `${r.stars} star${r.stars === 1 ? "" : "s"}`, count: r.count, share: r.share }))} />
            <Bars title="Healthcare or not" items={s.background} />
            <Bars title="Role" items={s.roles} />
            <Bars title="Devices (people can pick several)" items={s.devices} />
            <Bars title="Personal or work" items={s.context} />
            <Bars title="Kind of workplace" items={s.officeTypes} />
          </div>
        </Section>

        <Section title="Premium and price">
          <div className="grid gap-4 md:grid-cols-3">
            <Bars title="Would you pay?" items={s.payInterest} />
            <Bars title="Reasonable price per month (people who would pay)" items={s.individualPrices} />
            <Bars title="Reasonable team price, 10 seats / month" items={s.teamPrices} />
          </div>
        </Section>

        <Section title={`What people wrote (${texts.length} most recent with text)`}>
          {texts.length ? (
            <ul className="space-y-3">
              {texts.map((r) => (
                <li key={r.id} className="rounded-xl border bg-background p-4 text-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    <span>{labelOf([...MED_ROLES, ...NON_MED_ROLES], r.role)}</span>
                    <span>{labelOf(USE_CONTEXT, r.use_context)}{r.office_type ? `, ${labelOf(OFFICE_TYPES, r.office_type)}` : ""}</span>
                    <span>Pay: {labelOf(PAY_INTEREST, r.pay_interest)}{r.price_individual ? `, ${labelOf(PRICE_INDIVIDUAL, r.price_individual)}/mo` : ""}{r.price_team ? `, team ${labelOf(PRICE_TEAM, r.price_team)}/mo` : ""}{r.pay_who ? `, ${labelOf(PAY_WHO, r.pay_who).toLowerCase()}` : ""}</span>
                    <span>{r.platform} · {r.app_version}</span>
                  </div>
                  {r.improve ? <p><span className="text-muted-foreground">Improve: </span>{r.improve}</p> : null}
                  {r.missing ? <p><span className="text-muted-foreground">Missing: </span>{r.missing}</p> : null}
                  {r.other ? <p><span className="text-muted-foreground">Other: </span>{r.other}</p> : null}
                  <form action={removeResponse} className="mt-2">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-xs text-muted-foreground hover:text-destructive hover:underline" title="Delete this response, for example if it contains personal details">Delete</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">No written feedback yet.</p>
          )}
        </Section>
      </div>
    </main>
  )
}
