// clinexia-upgrade:phase2 — shared patient context (pure logic; no React, no direct browser access).
//
// Design rules (each is covered by tests):
//  1. Nothing enters the context unless the user presses "Save to context". Calculator inputs are never copied in.
//  2. Nothing leaves it unless the user reviews the list and presses "Use selected values".
//  3. A value is offered to an input only when the input's id, kind and unit all match exactly. There is no
//     unit conversion: a mismatch is shown as "not offered" with the reason.
//  4. Each value keeps its unit and the time it was saved. Values older than 24 hours are flagged for re-confirmation.
//  5. Storage is session-only (cleared when the tab or app session ends) and also expires after 30 minutes idle,
//     so the next person at a shared device starts clean.
//  6. "New patient" clears everything and changes the context id.
// No names, identifiers or dates of birth are collected.

import type { CalculatorDefinition, InputDefinition } from "../calculators/types"
import { parseStrictNumber } from "./input-validation"

export const CONTEXT_KEYS = ["age", "weight", "height", "sex", "creatinine"] as const
export type ContextKey = (typeof CONTEXT_KEYS)[number]

interface FieldSpec {
  label: string
  kind: "number" | "select"
  unit: string | null
  inputIds: string[]
  /** Values that are accepted into the context at all (broad plausibility, not clinical ranges). */
  plausible?: { min: number; max: number }
  allowed?: string[]
}

export const FIELD_SPECS: Record<ContextKey, FieldSpec> = {
  age: { label: "Age", kind: "number", unit: "years", inputIds: ["age", "ageYears"], plausible: { min: 0, max: 130 } },
  weight: { label: "Weight", kind: "number", unit: "kg", inputIds: ["weight", "weightKg"], plausible: { min: 0.2, max: 700 } },
  height: { label: "Height", kind: "number", unit: "cm", inputIds: ["height", "heightCm"], plausible: { min: 20, max: 280 } },
  sex: { label: "Sex (as used by the formula)", kind: "select", unit: null, inputIds: ["sex"], allowed: ["male", "female"] },
  creatinine: { label: "Serum creatinine", kind: "number", unit: "mg/dL", inputIds: ["creatinine"], plausible: { min: 0.1, max: 40 } },
}

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000
export const IDLE_EXPIRY_MS = 30 * 60 * 1000
export const STORAGE_KEY = "clinexia:patient-context:v1"

export interface ContextEntry {
  value: string
  unit: string | null
  recordedAt: string
}

export interface ContextState {
  contextId: string
  entries: Partial<Record<ContextKey, ContextEntry>>
  lastActivityAt: string
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface Offer {
  key: ContextKey
  label: string
  inputId: string
  entry: ContextEntry
  stale: boolean
  /** "ready" can be applied. Anything else is shown to the user with the reason and is not applied. */
  status: "ready" | "unit-mismatch" | "option-mismatch"
  reason?: string
}

export type SaveResult = { ok: true } | { ok: false; message: string }

function newId(random: () => number): string {
  return `ctx-${Math.floor(random() * 1e9).toString(36)}${Math.floor(random() * 1e9).toString(36)}`
}

export function createContextStore(
  storage: StorageLike,
  clock: () => number = () => Date.now(),
  random: () => number = Math.random,
) {
  const empty = (): ContextState => ({ contextId: newId(random), entries: {}, lastActivityAt: new Date(clock()).toISOString() })

  function persist(state: ContextState) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable: the context simply does not persist */
    }
  }

  function load(): ContextState {
    let state: ContextState | null = null
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (raw) state = JSON.parse(raw) as ContextState
    } catch {
      state = null
    }
    if (!state || typeof state.contextId !== "string" || typeof state.entries !== "object" || state.entries === null) return empty()
    const idleFor = clock() - new Date(state.lastActivityAt).getTime()
    if (!Number.isFinite(idleFor) || idleFor > IDLE_EXPIRY_MS) {
      const fresh = empty()
      persist(fresh)
      return fresh
    }
    return state
  }

  function touch(state: ContextState): ContextState {
    const next = { ...state, lastActivityAt: new Date(clock()).toISOString() }
    persist(next)
    return next
  }

  function save(key: ContextKey, rawValue: string): SaveResult {
    const spec = FIELD_SPECS[key]
    let value = String(rawValue).trim()
    if (spec.kind === "number") {
      const n = parseStrictNumber(value)
      if (n === null) return { ok: false, message: `${spec.label} must be a number.` }
      if (spec.plausible && (n < spec.plausible.min || n > spec.plausible.max)) {
        return { ok: false, message: `${spec.label} of ${n} ${spec.unit ?? ""} is outside the plausible range (${spec.plausible.min} to ${spec.plausible.max}). Check the value.`.replace(/\s+\./, ".") }
      }
      value = String(n)
    } else if (!spec.allowed?.includes(value)) {
      return { ok: false, message: `${spec.label} must be one of: ${spec.allowed?.join(", ")}.` }
    }
    const state = load()
    const next: ContextState = {
      ...state,
      entries: { ...state.entries, [key]: { value, unit: spec.unit, recordedAt: new Date(clock()).toISOString() } },
      lastActivityAt: new Date(clock()).toISOString(),
    }
    persist(next)
    return { ok: true }
  }

  function remove(key: ContextKey) {
    const state = load()
    const entries = { ...state.entries }
    delete entries[key]
    persist({ ...state, entries, lastActivityAt: new Date(clock()).toISOString() })
  }

  /** New patient: everything is removed and the context id changes. */
  function clearAll(): ContextState {
    const fresh = empty()
    persist(fresh)
    return fresh
  }

  function offersFor(definition: CalculatorDefinition): Offer[] {
    const state = load()
    const offers: Offer[] = []
    for (const key of CONTEXT_KEYS) {
      const entry = state.entries[key]
      if (!entry) continue
      const spec = FIELD_SPECS[key]
      const input = definition.inputs.find((i) => spec.inputIds.includes(i.id) && i.kind === spec.kind)
      if (!input) continue
      const stale = clock() - new Date(entry.recordedAt).getTime() > STALE_AFTER_MS
      const base = { key, label: spec.label, inputId: input.id, entry, stale }
      if (spec.kind === "number" && input.unit !== spec.unit) {
        offers.push({ ...base, status: "unit-mismatch", reason: `This calculator expects ${input.unit ?? "no unit"}; the saved value is in ${spec.unit}. Enter it again in the right unit.` })
      } else if (spec.kind === "select" && !(input.options ?? []).some((o) => o.value === entry.value)) {
        offers.push({ ...base, status: "option-mismatch", reason: "This calculator does not offer that option." })
      } else {
        offers.push({ ...base, status: "ready" })
      }
    }
    return offers
  }

  /** Candidates to save from what is currently typed into a calculator. Only exact id, kind and unit matches. */
  function candidatesFrom(definition: CalculatorDefinition, values: Record<string, string>): Array<{ key: ContextKey; label: string; value: string; unit: string | null }> {
    const out: Array<{ key: ContextKey; label: string; value: string; unit: string | null }> = []
    for (const key of CONTEXT_KEYS) {
      const spec = FIELD_SPECS[key]
      const input: InputDefinition | undefined = definition.inputs.find((i) => spec.inputIds.includes(i.id) && i.kind === spec.kind)
      const value = input ? (values[input.id] ?? "").trim() : ""
      if (!input || value === "") continue
      if (spec.kind === "number" && input.unit !== spec.unit) continue
      out.push({ key, label: spec.label, value, unit: spec.unit })
    }
    return out
  }

  return { load, touch, save, remove, clearAll, offersFor, candidatesFrom }
}

export type ContextStore = ReturnType<typeof createContextStore>

export function describeAge(recordedAt: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(recordedAt).getTime()) / 60000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return hours < 48 ? `${hours} h ago` : `${Math.floor(hours / 24)} days ago`
}
