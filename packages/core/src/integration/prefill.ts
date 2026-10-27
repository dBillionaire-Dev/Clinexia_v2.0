import type { CalculatorDefinition, InputDefinition } from "../calculators/types"

/**
 * Deep-link prefill: ?age=54&weight=70&creatinine=1.2&sex=male  (add &calculate=1 to also run the calculation).
 *
 * Every value is validated against its InputDefinition (kind, min/max, select options). Anything invalid or unknown is
 * dropped silently: the form simply stays at its default for that input. Nothing in here logs, stores or sends values.
 *
 * Unit-aware params (creatinine=88&creatinine_unit=umol/L) go through a UnitResolver. Phase 1 ships a resolver that only
 * accepts the input's own unit; Phase 2 swaps in the real conversion-backed one without touching this parser.
 */

export type UnitResolution = { ok: true; value: number } | { ok: false }
export type UnitResolver = (input: InputDefinition, value: number, unit: string) => UnitResolution

const normUnit = (u: string) => u.trim().toLowerCase().replace(/[µμ]/g, "u").replace(/\s+/g, "")

/** Phase 1 default: a unit is accepted only when it is the calculator's own unit (no conversion). */
export const defaultUnitResolver: UnitResolver = (input, value, unit) =>
  input.unit && normUnit(input.unit) === normUnit(unit) ? { ok: true, value } : { ok: false }

export type PrefillSource = URLSearchParams | Record<string, string | string[] | undefined>

export interface PrefillResult {
  /** Validated values keyed by input id, as the strings the form state uses. */
  values: Record<string, string>
  /** Input ids that were applied. */
  applied: string[]
  /** Param NAMES (never values) that were ignored. For tests and debugging only. */
  ignored: string[]
  /** True only when calculate=1 (or true) is present. */
  calculate: boolean
  theme: "light" | "dark" | null
  postMessage: boolean
  /** Normalised origin from ?parentOrigin=, if it is a well-formed http(s) origin. NOT yet checked against the allowlist. */
  parentOrigin: string | null
}

export interface PrefillOptions {
  unitResolver?: UnitResolver
}

/** Params that control the view rather than an input. */
const RESERVED = new Set(["calculate", "theme", "postMessage", "parentOrigin"])
const UNIT_SUFFIX = "_unit"
const MAX_LEN = 64
const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

function reader(source: PrefillSource) {
  if (source instanceof URLSearchParams) {
    return {
      get: (k: string) => source.get(k) ?? undefined,
      keys: () => Array.from(new Set(source.keys())),
    }
  }
  return {
    get: (k: string) => {
      const v = Object.prototype.hasOwnProperty.call(source, k) ? source[k] : undefined
      return Array.isArray(v) ? v[0] : v
    },
    keys: () => Object.keys(source),
  }
}

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function originOf(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:" && u.protocol !== "http:") return null
    return u.origin
  } catch {
    return null
  }
}

/** Validates one raw value for one input. Returns the string to put in the form, or null to ignore it. */
export function parseInputValue(
  input: InputDefinition,
  raw: string,
  unit?: string,
  resolver: UnitResolver = defaultUnitResolver,
): string | null {
  const text = raw.trim()
  if (!text || text.length > MAX_LEN) return null

  if (input.kind === "number") {
    if (!NUMBER.test(text)) return null
    let value = Number(text)
    if (!Number.isFinite(value)) return null
    if (unit !== undefined && unit.trim() !== "") {
      const resolved = resolver(input, value, unit)
      if (!resolved.ok || !Number.isFinite(resolved.value)) return null
      value = resolved.value
    }
    if (input.min !== undefined && value < input.min) return null
    if (input.max !== undefined && value > input.max) return null
    return String(value)
  }

  if (input.kind === "select") {
    const options = input.options ?? []
    const exact = options.find((o) => o.value === text)
    if (exact) return exact.value
    const lower = text.toLowerCase()
    const loose = options.filter((o) => o.value.toLowerCase() === lower)
    return loose.length === 1 ? loose[0].value : null
  }

  if (input.kind === "date") return validDate(text) ? text : null

  return null
}

export function parsePrefill(def: CalculatorDefinition, source: PrefillSource, options: PrefillOptions = {}): PrefillResult {
  const read = reader(source)
  const resolver = options.unitResolver ?? defaultUnitResolver
  const inputIds = new Set(def.inputs.map((i) => i.id))

  const values: Record<string, string> = {}
  const applied: string[] = []
  const ignored: string[] = []

  for (const input of def.inputs) {
    const raw = read.get(input.id)
    if (raw === undefined) continue
    // A "<id>_unit" param is a unit for <id> unless the calculator really has an input with that id.
    const unitKey = `${input.id}${UNIT_SUFFIX}`
    const unit = input.kind === "number" && !inputIds.has(unitKey) ? read.get(unitKey) : undefined
    const parsed = parseInputValue(input, raw, unit, resolver)
    if (parsed === null) ignored.push(input.id)
    else {
      values[input.id] = parsed
      applied.push(input.id)
    }
  }

  // Report unknown param names (names only) so tests can assert they were dropped.
  for (const key of read.keys()) {
    if (inputIds.has(key) || RESERVED.has(key)) continue
    if (key.endsWith(UNIT_SUFFIX) && inputIds.has(key.slice(0, -UNIT_SUFFIX.length))) continue
    ignored.push(key)
  }

  const themeRaw = read.get("theme")
  const calc = read.get("calculate")
  return {
    values,
    applied,
    ignored,
    calculate: calc === "1" || calc === "true",
    theme: themeRaw === "light" || themeRaw === "dark" ? themeRaw : null,
    postMessage: read.get("postMessage") === "1",
    parentOrigin: originOf(read.get("parentOrigin")),
  }
}
