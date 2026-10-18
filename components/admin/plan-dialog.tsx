"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SPECIALTIES, SPECIALTY_LABELS, type Specialty } from "@/lib/billing/config"

export type PlanChoice = { plan: "free" | "specialty" | "all_access"; specialties: Specialty[]; months: number }

const PLANS = [
  ["free", "Free", "No premium access."],
  ["specialty", "Specialty premium", "Only the specialties you tick."],
  ["all_access", "All-access premium", "Every premium specialty."],
] as const

/** Lets an administrator set someone's plan directly (no payment taken). */
export function PlanDialog({ email, current, onSave, onClose }: { email: string; current: string; onSave: (c: PlanChoice) => Promise<void>; onClose: () => void }) {
  const [plan, setPlan] = useState<PlanChoice["plan"]>("specialty")
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [months, setMonths] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const toggle = (s: Specialty) => setSpecialties((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  const invalid = plan === "specialty" && specialties.length === 0

  async function save() {
    if (invalid) return setError("Choose at least one specialty.")
    setBusy(true); setError("")
    try { await onSave({ plan, specialties, months }) } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change plan for {email}</DialogTitle>
          <DialogDescription>Current plan: {current}. This takes effect straight away and does not charge them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Plan" className="grid gap-2">
            {PLANS.map(([value, title, hint]) => (
              <button key={value} type="button" role="radio" aria-checked={plan === value} onClick={() => setPlan(value)} className={`rounded-lg border p-3 text-left ${plan === value ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                <span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
          {plan === "specialty" && (
            <div role="group" aria-label="Specialties" className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => (
                <button key={s} type="button" aria-pressed={specialties.includes(s)} onClick={() => toggle(s)} className={`rounded-full border px-3 py-1.5 text-sm ${specialties.includes(s) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{SPECIALTY_LABELS[s]}</button>
              ))}
            </div>
          )}
          {plan !== "free" && (
            <label className="flex items-center gap-3 text-sm">
              <span className="font-medium">Lasts for</span>
              <select className="rounded-md border bg-background px-2 py-1.5" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {[1, 2, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} month{m === 1 ? "" : "s"}</option>)}
              </select>
            </label>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || invalid} variant={plan === "free" ? "destructive" : "default"}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : plan === "free" ? "Remove premium" : "Save plan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
