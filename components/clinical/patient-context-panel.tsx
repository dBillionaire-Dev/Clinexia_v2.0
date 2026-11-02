"use client"
// clinexia-upgrade:phase2 — explicit, session-only patient values.
// Nothing is saved or applied without a button press, and each value is shown with its unit and age.

import { useEffect, useMemo, useState } from "react"
import type { CalculatorDefinition } from "@/lib/calculators/types"
import { usePatientContext } from "@/lib/clinical/use-patient-context"
import { FIELD_SPECS, describeAge, type ContextKey } from "@/lib/clinical/patient-context"
import { Button } from "@/components/ui/button"

export function PatientContextPanel({ definition, values, onApply }: { definition: CalculatorDefinition; values: Record<string, string>; onApply: (next: Record<string, string>) => void }) {
  const { store, state, available, announce } = usePatientContext()
  const [useKeys, setUseKeys] = useState<Set<ContextKey>>(new Set())
  const [saveKeys, setSaveKeys] = useState<Set<ContextKey>>(new Set())
  const [message, setMessage] = useState<string | null>(null)

  const offers = useMemo(() => (store && state ? store.offersFor(definition) : []), [store, state, definition])
  const candidates = useMemo(() => (store ? store.candidatesFrom(definition, values) : []), [store, definition, values])
  const held = state ? (Object.keys(state.entries) as ContextKey[]) : []

  // Pre-tick only values that are ready and fresh. Stale values need a deliberate tick.
  useEffect(() => {
    setUseKeys(new Set(offers.filter((o) => o.status === "ready" && !o.stale).map((o) => o.key)))
  }, [offers])

  if (!available || !store || !state) return null
  if (offers.length === 0 && candidates.length === 0 && held.length === 0) return null
  const now = Date.now()
  const toggle = (set: Set<ContextKey>, setter: (s: Set<ContextKey>) => void, key: ContextKey) => {
    const next = new Set(set); next.has(key) ? next.delete(key) : next.add(key); setter(next)
  }

  return (
    <details className="rounded-md border bg-muted/20 p-3 text-sm" open={offers.some((o) => o.status === "ready")}>
      <summary className="cursor-pointer font-medium">Patient values for this session</summary>
      <div className="mt-3 space-y-4">
        <p className="text-xs text-muted-foreground">Kept only in this browser tab. No names or identifiers. Cleared by &quot;New patient&quot;, after 30 minutes idle, or when the tab closes.</p>

        {offers.length > 0 ? (
          <div className="space-y-2">
            <p className="font-medium">Use saved values in this calculator</p>
            {offers.map((o) => (
              <label key={o.key} className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 h-4 w-4" disabled={o.status !== "ready"} checked={o.status === "ready" && useKeys.has(o.key)} onChange={() => toggle(useKeys, setUseKeys, o.key)} />
                <span>
                  {o.label}: <strong>{o.entry.value}{o.entry.unit ? ` ${o.entry.unit}` : ""}</strong>
                  <span className="text-muted-foreground"> · saved {describeAge(o.entry.recordedAt, now)}</span>
                  {o.stale ? <span className="block text-amber-700 dark:text-amber-300">Older than 24 hours. Confirm it is still current before using it.</span> : null}
                  {o.reason ? <span className="block text-muted-foreground">{o.reason}</span> : null}
                </span>
              </label>
            ))}
            <Button type="button" size="sm" variant="outline" disabled={useKeys.size === 0} onClick={() => {
              const next: Record<string, string> = {}
              for (const o of offers) if (o.status === "ready" && useKeys.has(o.key)) next[o.inputId] = o.entry.value
              onApply(next); setMessage("Values applied. Check them, then calculate.")
            }}>Use selected values</Button>
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <div className="space-y-2">
            <p className="font-medium">Save values from this form for the next calculator</p>
            {candidates.map((c) => (
              <label key={c.key} className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={saveKeys.has(c.key)} onChange={() => toggle(saveKeys, setSaveKeys, c.key)} />
                <span>{FIELD_SPECS[c.key].label}: <strong>{c.value}{c.unit ? ` ${c.unit}` : ""}</strong></span>
              </label>
            ))}
            <Button type="button" size="sm" variant="outline" disabled={saveKeys.size === 0} onClick={() => {
              const problems: string[] = []
              for (const c of candidates) if (saveKeys.has(c.key)) { const r = store.save(c.key, c.value); if (!r.ok) problems.push(r.message) }
              announce(); setSaveKeys(new Set()); setMessage(problems.length ? problems.join(" ") : "Saved for this session.")
            }}>Save selected</Button>
          </div>
        ) : null}

        {held.length > 0 ? (
          <div className="space-y-2">
            <p className="font-medium">Held now</p>
            <ul className="space-y-1">
              {held.map((k) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span>{FIELD_SPECS[k].label}: {state.entries[k]!.value}{state.entries[k]!.unit ? ` ${state.entries[k]!.unit}` : ""}</span>
                  <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${FIELD_SPECS[k].label}`} onClick={() => { store.remove(k); announce() }}>Remove</Button>
                </li>
              ))}
            </ul>
            <Button type="button" size="sm" variant="destructive" onClick={() => { store.clearAll(); announce(); setMessage("Cleared. Ready for a new patient.") }}>New patient (clear all)</Button>
          </div>
        ) : null}

        {message ? <p role="status" className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </details>
  )
}
