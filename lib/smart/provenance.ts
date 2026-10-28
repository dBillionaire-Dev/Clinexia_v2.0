import type { CalculatorDefinition } from "@clinexia/core"
import { staleAfterDays, type MappedValue, type StaleThresholds } from "./mapping"

/**
 * How values travel from the SMART review step to the calculator page: in the URL FRAGMENT (#...), which browsers never send to a
 * server, so nothing from the record reaches Clinexia's servers or its logs. The calculator page reads the fragment, fills the
 * form, and removes the fragment from the address bar.
 *
 *   #age=54&sex=male&creatinine=1.2&from=smart&src_creatinine=2026-09-10&src_age=patient
 *
 * `src_<input>` records where each value came from: an observation date (YYYY-MM-DD) or "patient". Values are always in the
 * calculator's own unit, so no unit parameters are needed.
 */
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function buildPrefillFragment(values: MappedValue[]): string {
  const p = new URLSearchParams()
  for (const v of values) p.set(v.inputId, v.value)
  p.set("from", "smart")
  for (const v of values) p.set(`src_${v.inputId}`, v.observedAt ?? "patient")
  return p.toString()
}

export interface SmartProvenance {
  fromSmart: boolean
  /** input id -> YYYY-MM-DD, or "patient" */
  sources: Record<string, string>
}

export function parseSmartProvenance(params: URLSearchParams): SmartProvenance {
  const sources: Record<string, string> = {}
  if (params.get("from") !== "smart") return { fromSmart: false, sources }
  params.forEach((value, key) => {
    if (!key.startsWith("src_")) return
    const id = key.slice(4)
    if (ID.test(id) && (value === "patient" || DATE.test(value))) sources[id] = value
  })
  return { fromSmart: true, sources }
}

export interface NoticeLine {
  inputId: string
  label: string
  from: "patient" | "observation"
  observedAt?: string
  ageDays?: number
  stale: boolean
  staleAfterDays?: number
}

/** What the calculator page shows next to prefilled values: the observation date, how old it is, and a warning when stale. */
export function noticeLines(def: Pick<CalculatorDefinition, "inputs">, prov: SmartProvenance, applied: string[], today: Date, thresholds?: StaleThresholds): NoticeLine[] {
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const lines: NoticeLine[] = []
  for (const input of def.inputs) {
    const src = prov.sources[input.id]
    if (!src || !applied.includes(input.id)) continue
    if (src === "patient") { lines.push({ inputId: input.id, label: input.label, from: "patient", stale: false }); continue }
    const [y, m, d] = src.split("-").map(Number)
    const ageDays = Math.max(0, Math.floor((todayMs - Date.UTC(y, m - 1, d)) / 86_400_000))
    const limit = staleAfterDays(input.fhir?.loinc ?? input.loinc, thresholds)
    lines.push({ inputId: input.id, label: input.label, from: "observation", observedAt: src, ageDays, stale: ageDays > limit, staleAfterDays: limit })
  }
  return lines
}
