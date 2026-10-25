import { conversionCategories, getConversionCategory } from "@/lib/conversions/registry"
import { convert } from "@/lib/conversions/engine"
import { analytes, getAnalyte } from "@/lib/conversions/molar-mass"
import { convertAnalyteUnits } from "@/lib/integration/units"
import { fail, ok, type ApiResult } from "./kit"

/**
 * UCUM codes for the units of the existing conversion categories, where a standard code exists.
 * UNVERIFIED: written from the UCUM specification, not machine-validated (see docs/integration/FINDINGS.md).
 */
const UCUM: Record<string, Record<string, string>> = {
  mass: { kg: "kg", g: "g", mg: "mg", ug: "ug", ng: "ng", lb: "[lb_av]", oz: "[oz_av]" },
  volume: { L: "L", dL: "dL", mL: "mL", uL: "uL", nL: "nL" },
  length: { m: "m", cm: "cm", mm: "mm", um: "um", nm: "nm" },
  temperature: { C: "Cel", F: "[degF]", K: "K" },
  pressure: { Pa: "Pa", kPa: "kPa", mmHg: "mm[Hg]", cmH2O: "cm[H2O]", bar: "bar", atm: "atm" },
  energy: { J: "J", kJ: "kJ", cal: "cal", kcal: "kcal" },
  time: { s: "s", min: "min", h: "h", d: "d" },
  concentration: { "g/L": "g/L", "mg/L": "mg/L", "mg/dL": "mg/dL", "g/dL": "g/dL", "ug/mL": "ug/mL" },
  molar: { M: "mol/L", mM: "mmol/L", uM: "umol/L", nM: "nmol/L" },
}

const ANALYTE_UNITS = ["mg/dL", "g/dL", "g/L", "mg/L", "umol/L", "mmol/L"]

export function listConversions(): ApiResult {
  return ok({
    categories: conversionCategories.map((c) => ({
      id: c.id,
      name: c.name,
      units: c.units.map((u) => ({ id: u.id, name: u.name, symbol: u.symbol, ucum: UCUM[c.id]?.[u.id] ?? null })),
    })),
    analytes: {
      note: "Mass concentration to molar concentration for a named analyte, using the molecular weights below.",
      units: ANALYTE_UNITS,
      items: analytes.map((a) => ({ id: a.id, molecularWeight: a.molecularWeight })),
    },
  })
}

const asNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string" && /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(v.trim()) && v.trim().length <= 64) return Number(v)
  return null
}

/** Accepts an engine unit id ("mmHg") or its UCUM code ("mm[Hg]"). */
function resolveUnitId(categoryId: string, unit: unknown): string | null {
  if (typeof unit !== "string" || unit.length === 0 || unit.length > 32) return null
  const category = getConversionCategory(categoryId)
  if (!category) return null
  if (category.units.some((u) => u.id === unit)) return unit
  const byUcum = Object.entries(UCUM[categoryId] ?? {}).find(([, code]) => code === unit)
  return byUcum ? byUcum[0] : null
}

/** POST /conversions/convert  { category | analyte, value, from, to } */
export function convertBody(body: Record<string, unknown>): ApiResult {
  const value = asNumber(body.value)
  if (value === null) return fail(422, "validation_failed", "value must be a plain number.", { fields: [{ id: "value", code: "invalid_number", message: "value must be a plain number." }] })

  if (typeof body.analyte === "string") {
    const analyte = getAnalyte(body.analyte)
    if (!analyte) return fail(422, "validation_failed", "Unknown analyte.", { fields: [{ id: "analyte", code: "invalid_option", message: `analyte must be one of: ${analytes.map((a) => a.id).join(", ")}.` }] })
    if (typeof body.from !== "string" || typeof body.to !== "string") return fail(422, "validation_failed", "from and to are required.", { fields: [{ id: "from", code: "required", message: "from and to are required." }] })
    const r = convertAnalyteUnits(analyte.id, value, body.from, body.to)
    if (!r.ok) return fail(422, "validation_failed", r.message, { fields: [{ id: "from", code: "unit_unsupported", message: r.message }] })
    return ok({ analyte: analyte.id, molecularWeight: analyte.molecularWeight, value, from: body.from, to: body.to, result: r.value })
  }

  if (typeof body.category !== "string" || !getConversionCategory(body.category)) {
    return fail(422, "validation_failed", "Unknown category.", { fields: [{ id: "category", code: "invalid_option", message: `category must be one of: ${conversionCategories.map((c) => c.id).join(", ")} (or send "analyte").` }] })
  }
  const categoryId = body.category
  const from = resolveUnitId(categoryId, body.from)
  const to = resolveUnitId(categoryId, body.to)
  if (!from || !to) {
    return fail(422, "validation_failed", "Unknown unit for this category.", {
      fields: [{ id: !from ? "from" : "to", code: "unit_unknown", message: "The unit is not recognised for this category. Nothing is guessed." }],
    })
  }
  let result: number
  try {
    result = convert(getConversionCategory(categoryId)!, value, from, to)
  } catch {
    return fail(422, "validation_failed", "The conversion could not be completed.", { fields: [{ id: "value", code: "invalid_number", message: "The value could not be converted." }] })
  }
  return ok({
    category: categoryId,
    value,
    from: { unit: from, ucum: UCUM[categoryId]?.[from] ?? null },
    to: { unit: to, ucum: UCUM[categoryId]?.[to] ?? null },
    result: Number(result.toPrecision(12)),
  })
}
