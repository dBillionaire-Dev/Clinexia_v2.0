import type { CalculationResult, CalculatorDefinition } from "./types"

/**
 * Test vectors: a small, deterministic snapshot of what every calculator returns for representative inputs.
 *
 * The inputs are chosen by buildVectorInputs (defaults and mid-range values, selects flipped in the second case) or, for the
 * few calculators where that does not work, by VECTOR_OVERRIDES. The RESULTS are never typed by hand: they are produced by
 * running the calculator, and a hash of them is stored in test-vector-data.ts. See docs/integration/CHANGELOG.md for the
 * workflow (change behaviour -> test fails -> bump the version in versions.ts -> regenerate the vectors).
 *
 * Nothing in this file depends on Node, React or the browser, so it can move into the shared core package unchanged.
 */

/**
 * "Today" while vectors are computed: 1 June 2026, 12:00 in the machine's OWN time zone. Calculators read today's calendar
 * date from local time, so this gives the same answer on every day, machine and time zone.
 */
export const VECTOR_TODAY = { year: 2026, month: 6, day: 1 } as const

export type VectorOutcome = { ok: true; result: CalculationResult } | { ok: false; error: string }

export interface VectorCase {
  inputs: Record<string, string>
  /** The result's display text (or the error message), for humans reading the data file. The hash is what is compared. */
  display: string
}

export interface VectorEntry {
  /** The formula version these vectors were generated for (FORMULA_VERSIONS at generation time). */
  version: string
  cases: VectorCase[]
  /** sha-256 of the canonical JSON of every case's outcome. */
  hash: string
}

/** Inputs only (never results) for calculators where the generic choice fails or is meaningless. */
export const VECTOR_OVERRIDES: Record<string, Record<string, string>[]> = {
  // Either the LMP or the due date, not both.
  "gestational-age": [
    { lmp: "2026-01-10", edd: "", asOf: "2026-03-15", cycleLength: "" },
    { lmp: "", edd: "2026-10-17", asOf: "2026-03-15", cycleLength: "" },
  ],
  // The generic "flip every select" case turns the unit selects into combinations that are not valid for these values.
  "lean-body-mass": [
    { sex: "male", weight: "70", weightUnit: "kg", height: "170", heightUnit: "cm" },
    { sex: "female", weight: "154", weightUnit: "lb", height: "66", heightUnit: "in" },
  ],
  // Needs a whole number of stools.
  "who-pediatric-ors-ongoing-loss": [
    { ageYears: "3", looseStools: "4" },
    { ageYears: "8", looseStools: "10" },
  ],
}

function pickInputs(def: CalculatorDefinition, variant: 0 | 1 | 2): Record<string, string> {
  const inputs: Record<string, string> = {}
  for (const input of def.inputs) {
    if (input.kind === "select") {
      const options = input.options ?? []
      const base = Math.max(0, options.findIndex((o) => o.value === String(input.defaultValue)))
      inputs[input.id] = options.length ? options[(base + (variant === 1 ? 1 : 0)) % options.length].value : ""
    } else if (input.kind === "date") {
      inputs[input.id] = variant === 1 ? "2026-04-15" : "2026-03-15"
    } else {
      let v: number
      if (input.defaultValue !== undefined) v = Number(input.defaultValue)
      else if (input.min !== undefined && input.max !== undefined) v = input.min + (input.max - input.min) * 0.3
      else if (input.min !== undefined) v = Math.max(input.min, 1) * 10
      else if (input.max !== undefined) v = input.max / 4
      else v = 10
      if (variant === 2) v *= 1.5
      if (input.max !== undefined) v = Math.min(v, input.max)
      if (input.min !== undefined) v = Math.max(v, input.min)
      inputs[input.id] = String(Math.round(v * 1000) / 1000)
    }
  }
  return inputs
}

/** Three input sets per calculator: the base case, selects moved to their next option, and numbers scaled by 1.5. */
export function buildVectorInputs(def: CalculatorDefinition): Record<string, string>[] {
  const override = VECTOR_OVERRIDES[def.id]
  if (override) return override.map((o) => ({ ...o }))
  return [pickInputs(def, 0), pickInputs(def, 1), pickInputs(def, 2)]
}

/** Runs fn with a fixed "today" (see VECTOR_TODAY) and en-US number formatting, then restores both. */
export function withFixedEnvironment<T>(fn: () => T): T {
  const RealDate = Date
  const fixed = new RealDate(VECTOR_TODAY.year, VECTOR_TODAY.month - 1, VECTOR_TODAY.day, 12, 0, 0).getTime()
  const realToLocale = Number.prototype.toLocaleString
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fixed)
      else super(...(args as []))
    }
    static now() {
      return fixed
    }
  }
  ;(globalThis as { Date: DateConstructor }).Date = FixedDate as unknown as DateConstructor
  Number.prototype.toLocaleString = function (this: number, _locales?: string | string[], options?: Intl.NumberFormatOptions) {
    return realToLocale.call(this, "en-US", options)
  } as typeof Number.prototype.toLocaleString
  try {
    return fn()
  } finally {
    ;(globalThis as { Date: DateConstructor }).Date = RealDate
    Number.prototype.toLocaleString = realToLocale
  }
}

/** Runs one case the way a caller would: calculate() with string inputs. Errors are part of the snapshot. */
export function runVectorCase(def: CalculatorDefinition, inputs: Record<string, string>): VectorOutcome {
  return withFixedEnvironment(() => {
    try {
      return { ok: true as const, result: def.calculate({ ...inputs }) }
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) }
    }
  })
}

/** JSON with object keys sorted, so equal data always serialises identically. */
export function canonicalJson(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm)
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]))
    }
    return v
  }
  return JSON.stringify(norm(value))
}

export const describeOutcome = (o: VectorOutcome): string => (o.ok ? o.result.display : `error: ${o.error}`)

/** What gets hashed for a calculator: every case's inputs and full outcome. */
export function vectorPayload(def: CalculatorDefinition, caseInputs: Record<string, string>[]) {
  return caseInputs.map((inputs) => ({ inputs, outcome: runVectorCase(def, inputs) }))
}
