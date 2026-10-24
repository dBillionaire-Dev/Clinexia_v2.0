import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { addRevenue, loadRevenue } from "@/lib/traction/admin-data"
import { lagosDay } from "@/lib/traction/dates.mjs"
import { AdminNav, Card, ExportLink, Section, SimpleTable } from "@/components/admin/traction-ui"

export const dynamic = "force-dynamic"

async function addEntry(formData: FormData) {
  "use server"
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const date = String(formData.get("date") ?? "")
  const source = String(formData.get("source") ?? "")
  const amount = Number(formData.get("amount"))
  const notes = String(formData.get("notes") ?? "").slice(0, 500)
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) && ["ads", "sponsorship", "other"].includes(source) && Number.isFinite(amount) && amount >= 0 && amount < 1e9
  if (!valid) redirect("/admin/traction/revenue?error=1")
  await addRevenue({ date, source, amount: Math.round(amount * 100) / 100, notes })
  revalidatePath("/admin/traction/revenue")
  redirect("/admin/traction/revenue")
}

const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v))

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const params = await searchParams
  let revenue: Awaited<ReturnType<typeof loadRevenue>> | null = null
  let error: string | null = null
  try { revenue = await loadRevenue() } catch (e) { error = e instanceof Error ? e.message : "Could not load revenue." }

  const input = "rounded-md border bg-background px-2 py-1.5 text-sm"
  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <AdminNav current="revenue" />
        <h1 className="text-3xl font-bold tracking-tight">Revenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manually entered, in USD. Every row is marked as manually entered; nothing here is imported or estimated.</p>
        {params.error ? <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Check the date, source and amount, then try again.</p> : null}
        {error ? <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

        <form action={addEntry} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
          <label className="text-sm">Date<input type="date" name="date" required defaultValue={lagosDay(Date.now())} className={`${input} ml-2`} /></label>
          <label className="text-sm">Source
            <select name="source" className={`${input} ml-2`}><option value="ads">Ads</option><option value="sponsorship">Sponsorship</option><option value="other">Other</option></select>
          </label>
          <label className="text-sm">Amount (USD)<input type="number" name="amount" min="0" step="0.01" required className={`${input} ml-2 w-32`} /></label>
          <label className="min-w-[12rem] flex-1 text-sm">Notes<input type="text" name="notes" maxLength={500} className={`${input} ml-2 w-full`} /></label>
          <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Add entry</button>
        </form>

        {revenue ? (
          <>
            <Section title="Totals">
              <div className="grid gap-4 sm:grid-cols-4">
                <Card label="Total" value={usd(revenue.total)} />
                <Card label="Ads" value={usd(revenue.bySource.ads)} />
                <Card label="Sponsorship" value={usd(revenue.bySource.sponsorship)} />
                <Card label="Other" value={usd(revenue.bySource.other)} />
              </div>
            </Section>
            <Section title="Entries" action={<ExportLink table="revenue_entries" from="2000-01-01" />}>
              <SimpleTable
                columns={[{ key: "date", label: "Date" }, { key: "source", label: "Source" }, { key: "amount_usd", label: "Amount", align: "right", format: usd }, { key: "notes", label: "Notes" }, { key: "entered_manually", label: "Manual", format: (v) => (v ? "yes" : "no") }]}
                rows={revenue.rows}
              />
            </Section>
          </>
        ) : null}
      </div>
    </main>
  )
}
