import type { ConversionCategory } from "@/lib/conversions/types"
import { convert } from "@/lib/conversions/engine"
import { massConversion } from "@/lib/conversions/data/mass"
import { lengthConversion } from "@/lib/conversions/data/length"
import { temperatureConversion } from "@/lib/conversions/data/temperature"
import { concentrationConversion, molarConversion } from "@/lib/conversions/data/concentration"
import { getAnalyte, mgdLToMmolL, mmolLToMgdL } from "@/lib/conversions/molar-mass"
import type { InputDefinition } from "@/lib/calculators/types"

/**
 * Unit resolution for integrations. Every numeric conversion goes through the existing lib/conversions engine
 * (convert, the data tables and the molar-mass helpers). Nothing here re-implements a conversion factor except the
 * two length units the engine table does not list (inch, foot), which are exact by international definition and are
 * added to a LOCAL copy of the length table, so the public conversion tool is unchanged.
 *
 * A unit is only converted when the input's own declared unit and the supplied unit are both known and compatible.
 * Anything else is refused. Nothing is guessed.
 */

const fold = (u: string) => u.trim().toLowerCase().replace(/[µμ]/g, "u").replace(/\s+/g, "")

/** folded spelling (including UCUM spellings) -> canonical unit id used by the engine tables */
const ALIASES: Record<string, string> = {
  kg: "kg", g: "g", lb: "lb", lbs: "lb", "[lb_av]": "lb",
  cm: "cm", m: "m", mm: "mm", in: "in", inch: "in", inches: "in", "[in_i]": "in", ft: "ft", foot: "ft", feet: "ft", "[ft_i]": "ft",
  c: "C", "°c": "C", cel: "C", degc: "C", f: "F", "°f": "F", "[degf]": "F", degf: "F", k: "K",
  "mg/dl": "mg/dL", "g/dl": "g/dL", "g/l": "g/L", "mg/l": "mg/L",
  "umol/l": "umol/L", "mmol/l": "mmol/L",
  years: "years", year: "years", yr: "years", yrs: "years", a: "years",
}

export const canonicalUnit = (unit: string): string => {
  const f = fold(unit)
  return ALIASES[f] ?? f
}

const LENGTH_WITH_IMPERIAL: ConversionCategory = {
  ...lengthConversion,
  units: [
    ...lengthConversion.units,
    { id: "in", name: "Inch", symbol: "in", factor: 0.0254 }, // exact by definition
    { id: "ft", name: "Foot", symbol: "ft", factor: 0.3048 }, // exact by definition
  ],
}

const WEIGHT_UNITS = new Set(["kg", "g", "lb"])
const LENGTH_UNITS = new Set(["cm", "m", "mm", "in", "ft"])
const TEMPERATURE_UNITS = new Set(["C", "F", "K"])
const MASS_CONC_UNITS = new Set(["mg/dL", "g/dL", "g/L", "mg/L"])
const MOLAR_UNITS = new Set(["umol/L", "mmol/L"])

/** Which analyte (molecular weight in lib/conversions/molar-mass) a mass concentration input stands for, by input id. */
const ANALYTE_BY_INPUT_ID: Record<string, string> = {
  creatinine: "creatinine",
  glucose: "glucose",
  calcium: "calcium",
  tc: "cholesterol",
  hdl: "cholesterol",
  tg: "triglycerides",
}

export type UnitFailureCode = "unit_unknown" | "unit_mismatch" | "unit_unsupported"
export interface UnitConversion {
  from: { value: number; unit: string }
  to: { value: number; unit: string }
}
export type UnitResolveResult =
  | { ok: true; value: number; conversion?: UnitConversion }
  | { ok: false; code: UnitFailureCode; message: string }

const cleanNumber = (n: number) => Number(n.toPrecision(10)) // removes float noise only

const toMgdL = (analyteId: string | undefined, value: number, from: string): number => {
  if (MASS_CONC_UNITS.has(from)) return convert(concentrationConversion, value, from, "mg/dL")
  const analyte = analyteId ? getAnalyte(analyteId) : undefined
  if (!analyte) throw new Error("no molar mass")
  const mmol = convert(molarConversion, value, from === "umol/L" ? "uM" : "mM", "mM")
  return mmolLToMgdL(mmol, analyte.molecularWeight)
}

const fromMgdL = (analyteId: string | undefined, mgdL: number, to: string): number => {
  if (MASS_CONC_UNITS.has(to)) return convert(concentrationConversion, mgdL, "mg/dL", to)
  const analyte = analyteId ? getAnalyte(analyteId) : undefined
  if (!analyte) throw new Error("no molar mass")
  const mmol = mgdLToMmolL(mgdL, analyte.molecularWeight)
  return convert(molarConversion, mmol, "mM", to === "umol/L" ? "uM" : "mM")
}

/** Converts `value` given in `unit` into the input's own declared unit. */
export function resolveUnit(input: Pick<InputDefinition, "id" | "label" | "unit">, value: number, unit: string): UnitResolveResult {
  const declaredRaw = input.unit
  if (!declaredRaw) {
    return { ok: false, code: "unit_unsupported", message: `${input.label} has no fixed unit, so a unit cannot be supplied for it. Send a plain value.` }
  }
  const declared = canonicalUnit(declaredRaw)
  const given = canonicalUnit(unit)
  if (given === declared) return { ok: true, value } // same unit, nothing to convert

  const sets = [WEIGHT_UNITS, LENGTH_UNITS, TEMPERATURE_UNITS, MASS_CONC_UNITS, MOLAR_UNITS]
  const knownGiven = sets.some((s) => s.has(given)) || given === "years"
  if (!knownGiven) {
    return { ok: false, code: "unit_unknown", message: `Unit is not recognised for ${input.label}. It is not converted or guessed.` }
  }

  const done = (converted: number): UnitResolveResult => {
    const v = cleanNumber(converted)
    if (!Number.isFinite(v)) return { ok: false, code: "unit_unsupported", message: `${input.label} could not be converted.` }
    return { ok: true, value: v, conversion: { from: { value, unit: given }, to: { value: v, unit: declared } } }
  }

  try {
    if (WEIGHT_UNITS.has(declared) && WEIGHT_UNITS.has(given)) return done(convert(massConversion, value, given, declared))
    if (LENGTH_UNITS.has(declared) && LENGTH_UNITS.has(given)) return done(convert(LENGTH_WITH_IMPERIAL, value, given, declared))
    if (TEMPERATURE_UNITS.has(declared) && TEMPERATURE_UNITS.has(given)) return done(convert(temperatureConversion, value, given, declared))

    const declaredConc = MASS_CONC_UNITS.has(declared) || MOLAR_UNITS.has(declared)
    const givenConc = MASS_CONC_UNITS.has(given) || MOLAR_UNITS.has(given)
    if (declaredConc && givenConc) {
      const bothMass = MASS_CONC_UNITS.has(declared) && MASS_CONC_UNITS.has(given)
      const bothMolar = MOLAR_UNITS.has(declared) && MOLAR_UNITS.has(given)
      if (bothMass) return done(convert(concentrationConversion, value, given, declared))
      if (bothMolar) return done(convert(molarConversion, value, given === "umol/L" ? "uM" : "mM", declared === "umol/L" ? "uM" : "mM"))
      const analyteId = ANALYTE_BY_INPUT_ID[input.id]
      if (!analyteId) {
        return { ok: false, code: "unit_unsupported", message: `${input.label} cannot be converted between mass and molar units (no molar mass is defined for it).` }
      }
      return done(fromMgdL(analyteId, toMgdL(analyteId, value, given), declared))
    }
  } catch {
    return { ok: false, code: "unit_unsupported", message: `${input.label} could not be converted from the unit supplied.` }
  }

  return { ok: false, code: "unit_mismatch", message: `The unit supplied is not compatible with ${input.label} (${declaredRaw}).` }
}
