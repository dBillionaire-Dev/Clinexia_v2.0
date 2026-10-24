"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/billing/client"
import { SPECIALTIES, SPECIALTY_LABELS, type Specialty } from "@/lib/billing/config"
import { formatMoney, type Quote } from "@/lib/billing/pricing"
import { useAccountSession } from "@/lib/billing/use-account-session"

type Plan = "specialty" | "all_access"

/** Shows the exact server-computed price for the choice, then starts checkout. Prices are never calculated in the browser. */
export function PlanPicker({ kind, orgId, minSeats = 1, onFree }: { kind: "individual" | "enterprise"; orgId?: string; minSeats?: number; onFree?: () => void }) {
  const [plan, setPlan] = useState<Plan>("specialty")
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [seats, setSeats] = useState(Math.max(1, minSeats))
  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState("")
  const [paying, setPaying] = useState(false)
  const session = useAccountSession()

  useEffect(() => {
    if (plan === "specialty" && specialties.length === 0) {
      setQuote(null)
      setError("")
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const r = await api<{ quote: Quote }>("/api/billing/quote", { kind, plan, specialties, seats, orgId })
      if (cancelled) return
      if (r.ok) { setQuote(r.data.quote); setError("") } else { setQuote(null); setError(r.error) }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [kind, plan, specialties, seats, orgId])

  const toggle = (s: Specialty) => setSpecialties((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  async function pay() {
    setPaying(true)
    setError("")
    const r = await api<{ authorizationUrl: string }>("/api/billing/checkout", { kind, plan, specialties, seats, orgId })
    if (r.ok) window.location.href = r.data.authorizationUrl
    else { setError(r.error); setPaying(false) }
  }

  if (!session.payments) return null // payments are hidden until the administrator introduces them

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Plan" className="grid gap-2 sm:grid-cols-2">
        {([["specialty", "Specialty premium", "Pick the specialties you need."], ["all_access", "All-access premium", "Every premium specialty."]] as const).map(([value, title, hint]) => (
          <button key={value} type="button" role="radio" aria-checked={plan === value} onClick={() => setPlan(value)}
            className={`rounded-lg border p-3 text-left transition-colors ${plan === value ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
            <span className="block text-sm font-medium">{title}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>

      {plan === "specialty" && (
        <div role="group" aria-label="Specialties" className="flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => (
            <button key={s} type="button" aria-pressed={specialties.includes(s)} onClick={() => toggle(s)}
              className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${specialties.includes(s) ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
              {SPECIALTY_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {kind === "enterprise" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Seats (one per staff member)</span>
          <input type="number" min={minSeats} step={1} value={seats} onChange={(e) => setSeats(Math.max(minSeats, Math.floor(Number(e.target.value) || 1)))}
            className="w-32 rounded-md border bg-background px-3 py-2 text-sm" />
        </label>
      )}

      <div className="rounded-lg border p-4 text-sm" aria-live="polite">
        {!quote && !error && <p className="text-muted-foreground">{plan === "specialty" ? "Choose at least one specialty to see the price." : "Calculating…"}</p>}
        {error && <p className="text-destructive">{error}</p>}
        {quote && (
          <div className="space-y-1.5">
            {quote.lines.map((l) => (
              <div key={l.label} className="flex justify-between gap-4"><span>{l.label}</span><span>{formatMoney(l.amountMinor, quote.currency)}</span></div>
            ))}
            {quote.discount.applied && (
              <div className="flex justify-between gap-4 text-green-700 dark:text-green-400"><span>Managed organisation discount ({quote.discount.bps / 100}%)</span><span>−{formatMoney(quote.discount.amountMinor, quote.currency)}</span></div>
            )}
            <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold"><span>Total per month ({quote.currency})</span><span>{formatMoney(quote.totalMinor, quote.currency)}</span></div>
            {kind === "enterprise" && <p className="text-xs text-muted-foreground">Enterprise prices are per seat for {quote.seats} seat{quote.seats === 1 ? "" : "s"}. {quote.discount.reason}</p>}
            {quote.allAccessIsCheaper && <p className="text-xs text-muted-foreground">All-access costs the same or less than this selection.</p>}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Each payment covers one month and does not renew by itself. Changing to a different plan starts a new month from today; unused time on the old plan is not credited.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={pay} disabled={!quote || paying}>{paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening payment…</> : "Continue to payment"}</Button>
        {onFree && <Button variant="outline" onClick={onFree}>Stay on the free plan</Button>}
      </div>
    </div>
  )
}
