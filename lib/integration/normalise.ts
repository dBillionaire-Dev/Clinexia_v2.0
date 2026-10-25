import type { CalculatorDefinition, InputDefinition } from "@/lib/calculators/types"
import type { UnitResolver } from "./prefill"
import { canonicalUnit, resolveUnit, type UnitConversion } from "./units"

/**
 * normaliseInputs: turns integration input (plain values or { value, unit }) into exactly what a calculator's
 * calculate() expects: its own declared units, as strings (the same form the web form passes).
 *
 *  - units are converted with the lib/conversions engine (see units.ts); an unknown or incompatible unit is an error
 *  - values are checked against kind, min/max (after conversion), select options and optional
 *  - required inputs are never defaulted: a missing sex must be an error, not "male"
 *  - messages never contain the values that were sent
 */

export type RawInputValue = number | string | { value: number | string; unit?: string }

export type NormaliseErrorCode =
  | "required" | "invalid_type" | "invalid_number" | "out_of_range" | "invalid_option" | "invalid_date"
  | "unknown_input" | "unit_unknown" | "unit_mismatch" | "unit_unsupported" | "unit_conflict"

export interface NormaliseError { id: string; code: NormaliseErrorCode; message: string }
export interface NormaliseConversion extends UnitConversion { id: string }
export interface NormaliseResult {
  /** Values ready for definition.calculate(). Contains every input that was valid; "" for optional inputs left out. */
  inputs: Record<string, string>
  conversions: NormaliseConversion[]
  errors: NormaliseError[]
}

const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/
const MAX_LEN = 64
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

function isDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "")

function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v !== "string") return null
  const t = v.trim()
  if (t.length > MAX_LEN || !NUMBER.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function rangeMessage(input: InputDefinition, side: "min" | "max") {
  const bound = side === "min" ? input.min : input.max
  return `${input.label} must be ${side === "min" ? "at least" : "no more than"} ${bound}${input.unit ? ` ${input.unit}` : ""}`
}

/** Select inputs that choose the unit of another input, e.g. weightUnit for weight. */
function companionSelect(def: CalculatorDefinition, input: InputDefinition): InputDefinition | undefined {
  return def.inputs.find((i) => i.kind === "select" && i.id === `${input.id}Unit`)
}

export function normaliseInputs(def: CalculatorDefinition, rawInputs: Record<string, unknown>): NormaliseResult {
  const inputs: Record<string, string> = {}
  const conversions: NormaliseConversion[] = []
  const errors: NormaliseError[] = []
  const raw = rawInputs && typeof rawInputs === "object" && !Array.isArray(rawInputs) ? rawInputs : {}
  const known = new Set(def.inputs.map((i) => i.id))

  for (const key of Object.keys(raw)) {
    if (!known.has(key)) errors.push({ id: key, code: "unknown_input", message: "This is not an input of this calculator." })
  }

  const unwrap = (v: unknown): { value: unknown; unit?: string; bad?: boolean } => {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const o = v as { value?: unknown; unit?: unknown }
      if (o.unit !== undefined && (typeof o.unit !== "string" || o.unit.trim() === "")) return { value: o.value, bad: true }
      return { value: o.value, unit: o.unit as string | undefined }
    }
    return { value: v }
  }

  // pass 1: companion unit selects the caller supplied explicitly (so a value + its own unit select are not converted twice)
  const explicitCompanion = new Set<string>()
  for (const input of def.inputs) {
    if (input.kind !== "number") continue
    const comp = companionSelect(def, input)
    if (comp && has(raw, comp.id) && !isBlank(raw[comp.id])) explicitCompanion.add(input.id)
  }

  for (const input of def.inputs) {
    const present = has(raw, input.id)
    const given = present ? raw[input.id] : undefined
    const { value, unit, bad } = unwrap(given)

    if (!present || isBlank(value)) {
      if (input.optional) inputs[input.id] = ""
      else if (!(input.kind === "select" && companionFillable(def, input, raw))) {
        errors.push({ id: input.id, code: "required", message: `${input.label} is required.` })
      }
      continue
    }
    if (bad) {
      errors.push({ id: input.id, code: "unit_unknown", message: `The unit for ${input.label} must be a non-empty string.` })
      continue
    }

    if (input.kind === "select") {
      if (unit !== undefined) { errors.push({ id: input.id, code: "unit_unsupported", message: `${input.label} is a choice and takes no unit.` }); continue }
      if (typeof value !== "string") { errors.push({ id: input.id, code: "invalid_type", message: `${input.label} must be text.` }); continue }
      const options = input.options ?? []
      const t = value.trim()
      const exact = options.find((o) => o.value === t)
      const loose = options.filter((o) => o.value.toLowerCase() === t.toLowerCase())
      const chosen = exact ?? (loose.length === 1 ? loose[0] : undefined)
      if (!chosen) errors.push({ id: input.id, code: "invalid_option", message: `${input.label} must be one of: ${options.map((o) => o.value).join(", ")}.` })
      else inputs[input.id] = chosen.value
      continue
    }

    if (input.kind === "date") {
      if (unit !== undefined) { errors.push({ id: input.id, code: "unit_unsupported", message: `${input.label} is a date and takes no unit.` }); continue }
      if (typeof value !== "string" || !isDate(value.trim())) errors.push({ id: input.id, code: "invalid_date", message: `${input.label} must be a date as YYYY-MM-DD.` })
      else inputs[input.id] = value.trim()
      continue
    }

    // number
    const n = parseNumber(value)
    if (n === null) { errors.push({ id: input.id, code: typeof value === "number" || typeof value === "string" ? "invalid_number" : "invalid_type", message: `${input.label} must be a plain number.` }); continue }

    let final = n
    if (unit !== undefined) {
      if (explicitCompanion.has(input.id)) {
        errors.push({ id: input.id, code: "unit_conflict", message: `${input.label} has a unit and its own unit choice (${input.id}Unit); send only one of them.` })
        continue
      }
      const r = resolveUnit(input, n, unit)
      if (!r.ok) { errors.push({ id: input.id, code: r.code, message: r.message }); continue }
      final = r.value
      if (r.conversion) conversions.push({ id: input.id, ...r.conversion })
    }

    if (input.min !== undefined && final < input.min) { errors.push({ id: input.id, code: "out_of_range", message: rangeMessage(input, "min") }); continue }
    if (input.max !== undefined && final > input.max) { errors.push({ id: input.id, code: "out_of_range", message: rangeMessage(input, "max") }); continue }
    inputs[input.id] = String(final)
  }

  // companion unit selects (weightUnit, heightUnit): when the caller sent a value without choosing the unit, the value is in the
  // input's declared unit, so set the select to match. Never overrides a choice the caller made.
  for (const input of def.inputs) {
    if (input.kind !== "number" || !input.unit || inputs[input.id] === undefined || inputs[input.id] === "") continue
    const comp = companionSelect(def, input)
    if (!comp || has(raw, comp.id)) continue
    const option = (comp.options ?? []).find((o) => canonicalUnit(o.value) === canonicalUnit(input.unit as string))
    if (option) inputs[comp.id] = option.value
  }
  // drop the "required" error for a companion select that was just filled
  const filtered = errors.filter((e) => !(e.code === "required" && inputs[e.id] !== undefined && inputs[e.id] !== ""))

  return { inputs, conversions, errors: filtered }
}

/** A required unit select (e.g. weightUnit) is not an error when the number it belongs to is present: it is filled afterwards. */
function companionFillable(def: CalculatorDefinition, select: InputDefinition, raw: Record<string, unknown>): boolean {
  if (!select.id.endsWith("Unit")) return false
  const base = def.inputs.find((i) => i.kind === "number" && `${i.id}Unit` === select.id && !!i.unit)
  if (!base) return false
  const v = has(raw, base.id) ? raw[base.id] : undefined
  const inner = v !== null && typeof v === "object" && !Array.isArray(v) ? (v as { value?: unknown }).value : v
  const comp = (select.options ?? []).some((o) => canonicalUnit(o.value) === canonicalUnit(base.unit as string))
  return comp && !isBlank(inner)
}

/**
 * Plugs unit conversion into the Phase 1 deep-link parser: creatinine=88&creatinine_unit=umol/L.
 * Anything the converter refuses is ignored by the parser, silently, like every other invalid param.
 */
export const prefillUnitResolver: UnitResolver = (input, value, unit) => {
  const r = resolveUnit(input, value, unit)
  return r.ok ? { ok: true, value: r.value } : { ok: false }
}
