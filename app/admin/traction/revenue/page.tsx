import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { addRevenue, deleteRevenue, loadRevenue, updateRevenue } from "@/lib/traction/admin-data"
import { lagosDay } from "@/lib/traction/dates.mjs"
import { AdminNav, Card, ExportLink, Section } from "@/components/admin/traction-ui"
import { ConfirmButton } from "@/components/admin/confirm-button"

export const dynamic = "force-dynamic"

const SOURCES = ["ads", "sponsorship", "other"]

function readEntry(formData: FormData) {
  const date = String(formData.get("date") ?? "")
  const source = String(formData.get("source") ?? "")
  const amount = Number(formData.get("amount"))
  const notes = String(formData.get("notes") ?? "").slice(0, 500)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && SOURCES.includes(source) && Number.isFinite(amount) && amount >= 0 && amount < 1e9
  return valid ? { date, source, amount: Math.round(amount * 100) / 100, notes } : null
}

async function addEntry(formData: FormData) {
  "use server"
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const entry = readEntry(formData)
  if (!entry) redirect("/admin/traction/revenue?error=1")
  await addRevenue(entry)
  revalidatePath("/admin/traction/revenue")
  redirect("/admin/traction/revenue")
}

async function editEntry(formData: FormData) {
  "use server"
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const entry = readEntry(formData)
  if (!entry) redirect("/admin/traction/revenue?error=1")
  try { await updateRevenue(String(formData.get("id") ?? ""), entry) } catch { redirect("/admin/traction/revenue?error=1") }
  revalidatePath("/admin/traction/revenue")
  redirect("/admin/traction/revenue")
}

async function removeEntry(formData: FormData) {
  "use server"
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  try { await deleteRevenue(String(formData.get("id") ?? "")) } catch { redirect("/admin/traction/revenue?error=1") }
  revalidatePath("/admin/traction/revenue")
  redirect("/admin/traction/revenue")
}

const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v))
const ngn = (v: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(v))

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const params = await searchParams
  let revenue: Awaited<ReturnType<typeof loadRevenue>> | null = null
  let error: string | null = null
  try { revenue = await loadRevenue() } catch (e) { error = e instanceof Error ? e.message : "Could not load revenue." }

  const input = "rounded-md border bg-background px-2 py-1.5 text-sm"
  const sub = revenue?.subscriptions ?? null
  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <AdminNav current="revenue" />
        <h1 className="text-3xl font-bold tracking-tight">Revenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">Subscription money is counted automatically from paid orders and cannot be edited here. Other income (ads, sponsorship, other) is entered by hand, in USD, and each entry can be edited or deleted.</p>
        {params.error ? <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Check the date, source and amount, then try again.</p> : null}
        {error ? <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

        {revenue ? (
          <>
            <Section title="Subscriptions (automatic)">
              {sub ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Card label="Naira payments" value={ngn(sub.totals.NGN)} />
                    <Card label="Dollar payments" value={usd(sub.totals.USD)} />
                    <Card label="Paid orders" value={String(sub.payments)} hint="Naira and dollars are kept apart: no exchange rate is guessed" />
                  </div>
                  {sub.months.length ? (
                    <div className="mt-4 overflow-x-auto rounded-xl border bg-background">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Month</th><th className="px-3 py-2 text-right">Payments</th><th className="px-3 py-2 text-right">Naira</th><th className="px-3 py-2 text-right">Dollars</th></tr></thead>
                        <tbody>{sub.months.map((m) => <tr key={m.month} className="border-b last:border-0"><td className="px-3 py-2">{m.month}</td><td className="px-3 py-2 text-right">{m.payments}</td><td className="px-3 py-2 text-right">{ngn(m.NGN)}</td><td className="px-3 py-2 text-right">{usd(m.USD)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : <p className="mt-3 text-sm text-muted-foreground">No paid orders yet. They appear here by themselves as people pay.</p>}
                </>
              ) : <p className="text-sm text-muted-foreground">Payment data is not available yet (payments are not set up).</p>}
            </Section>

            <Section title="Other income (entered by hand)">
              <form action={addEntry} className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
                <label className="text-sm">Date<input type="date" name="date" required defaultValue={lagosDay(Date.now())} className={`${input} ml-2`} /></label>
                <label className="text-sm">Source
                  <select name="source" className={`${input} ml-2`}><option value="ads">Ads</option><option value="sponsorship">Sponsorship</option><option value="other">Other</option></select>
                </label>
                <label className="text-sm">Amount (USD)<input type="number" name="amount" min="0" step="0.01" required className={`${input} ml-2 w-32`} /></label>
                <label className="min-w-[12rem] flex-1 text-sm">Notes<input type="text" name="notes" maxLength={500} className={`${input} ml-2 w-full`} /></label>
                <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Add entry</button>
              </form>
              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <Card label="Total entered" value={usd(revenue.total)} />
                <Card label="Ads" value={usd(revenue.bySource.ads)} />
                <Card label="Sponsorship" value={usd(revenue.bySource.sponsorship)} />
                <Card label="Other" value={usd(revenue.bySource.other)} />
              </div>
            </Section>

            <Section title="Entries" action={<ExportLink table="revenue_entries" from="2000-01-01" />}>
              {revenue.rows.length === 0 ? <p className="text-sm text-muted-foreground">No entries yet.</p> : (
                <div className="space-y-2">
                  {revenue.rows.map((r: any) => (
                    <div key={r.id} className="rounded-xl border bg-background p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-medium">{r.date}</span><span className="capitalize">{r.source}</span><span className="font-semibold">{usd(r.amount_usd)}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.notes}</span>
                        <form action={removeEntry}><input type="hidden" name="id" value={r.id} /><ConfirmButton message="Delete this revenue entry?" className="text-destructive underline">Delete</ConfirmButton></form>
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs underline">Edit</summary>
                        <form action={editEntry} className="mt-2 flex flex-wrap items-end gap-3">
                          <input type="hidden" name="id" value={r.id} />
                          <label className="text-xs">Date<input type="date" name="date" required defaultValue={r.date} className={`${input} ml-2`} /></label>
                          <label className="text-xs">Source<select name="source" defaultValue={r.source} className={`${input} ml-2`}><option value="ads">Ads</option><option value="sponsorship">Sponsorship</option><option value="other">Other</option></select></label>
                          <label className="text-xs">Amount (USD)<input type="number" name="amount" min="0" step="0.01" required defaultValue={Number(r.amount_usd)} className={`${input} ml-2 w-28`} /></label>
                          <label className="min-w-[10rem] flex-1 text-xs">Notes<input type="text" name="notes" maxLength={500} defaultValue={r.notes ?? ""} className={`${input} ml-2 w-full`} /></label>
                          <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Save</button>
                        </form>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        ) : null}
      </div>
    </main>
  )
}
