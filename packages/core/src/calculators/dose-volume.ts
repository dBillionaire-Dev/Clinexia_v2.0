import type { CalculationField, CalculationResult, CalculatorDefinition, InputDefinition } from "./types"
import { optionalNum, round } from "./helpers"

/**
 * Volume per dose.
 *
 * Single-drug dosing calculators report the dose in mg. This layer adds two OPTIONAL inputs for the product strength from
 * its label (for example 125 mg in 5 mL) and, when both are given, also reports the volume per dose in mL, next to the
 * dose in mg. Nothing is assumed: with no strength entered, no volume is shown.
 *
 * Only calculators with a clear per-administration mg amount of ONE drug are listed. Tablet-band regimens, fixed-dose
 * combinations, fluids, infusion rates and multi-drug protocols are deliberately excluded.
 */

/** The result's primary number is already the per-dose mg amount (its unit says so). */
const FROM_PRIMARY = [
  "mg-per-kg-dose", "mg-per-m2-dose", "dose-per-administration", "loading-dose", "maintenance-dose",
  "artesunate-severe-malaria", "azithromycin-pediatric-dose", "cefuroxime-surgical-prophylaxis", "ampicillin-pediatric-dose",
  "cefotaxime-pediatric-dose", "ciprofloxacin-pediatric-dose", "gentamicin-pediatric-dose", "meropenem-pediatric-dose",
  "vancomycin-pediatric-dose", "piperacillin-tazobactam-pediatric-dose", "clindamycin-pediatric-dose", "cefazolin-pediatric-dose",
  "linezolid-pediatric-dose", "doxycycline-pediatric-dose", "who-pediatric-pneumonia-regimen",
  "amoxicillin-clavulanate-renal-adjustment", "ciprofloxacin-renal-adjustment", "cefotaxime-renal-adjustment",
  "cefuroxime-axetil-renal-adjustment", "meropenem-renal-adjustment",
]

/** The calculator reports `perDoseMg` itself (its primary number is a daily dose, or a range). */
const EXPLICIT = [
  "amoxicillin-pediatric-dose", "amoxicillin-clavulanate-pediatric-dose", "cephalexin-pediatric-dose",
  "metronidazole-pediatric-dose", "cloxacillin-pediatric-dose", "mg-per-kg-per-day-dose", "ceftriaxone-pediatric-dose",
]

/** Products with two active ingredients: the strength entered must be the component the dose is calculated for. */
const COMBINATION = new Set([
  "amoxicillin-clavulanate-pediatric-dose", "amoxicillin-clavulanate-renal-adjustment", "piperacillin-tazobactam-pediatric-dose",
])

const FROM_PRIMARY_SET = new Set(FROM_PRIMARY)
export const DOSE_VOLUME_IDS: ReadonlySet<string> = new Set([...FROM_PRIMARY, ...EXPLICIT])

export const LIQUID_MG_ID = "liquidMg"
export const LIQUID_ML_ID = "liquidMl"

export const liquidStrengthInputs: InputDefinition[] = [
  {
    id: LIQUID_MG_ID,
    label: "Product strength: drug amount",
    kind: "number",
    unit: "mg",
    min: 0.001,
    max: 100000,
    optional: true,
    placeholder: "e.g. 125",
    helpText: "Optional. Enter the strength from the product label to also get the volume per dose, for example 125 mg in 5 mL.",
  },
  {
    id: LIQUID_ML_ID,
    label: "Product strength: in this volume",
    kind: "number",
    unit: "mL",
    min: 0.001,
    max: 10000,
    optional: true,
    placeholder: "e.g. 5",
  },
]

/** "mg", "mg/dose", "mg piperacillin/dose": per-dose units. Anything per day does not match. */
const PER_DOSE_UNIT = /^mg(?: [a-z]+)?(?:\/dose)?$/i

export function perDoseMgOf(id: string, result: CalculationResult): { low: number; high?: number } | undefined {
  if (result.perDoseMg) return result.perDoseMg
  if (!FROM_PRIMARY_SET.has(id)) return undefined
  if (typeof result.value !== "number" || !Number.isFinite(result.value) || result.value <= 0) return undefined
  if (!PER_DOSE_UNIT.test(result.unit ?? "")) return undefined
  return { low: result.value }
}

interface Strength { mg: number; ml: number; mgPerMl: number }

function readStrength(inputs: Record<string, number | string>): Strength | undefined {
  const mg = optionalNum(inputs, LIQUID_MG_ID)
  const ml = optionalNum(inputs, LIQUID_ML_ID)
  if (mg === undefined && ml === undefined) return undefined
  if (mg === undefined || ml === undefined) {
    throw new Error("Product strength needs both parts: the drug amount (mg) and the volume it is in (mL). Fill in both, or leave both empty.")
  }
  if (!(mg > 0) || !(ml > 0)) throw new Error("Product strength must be greater than zero.")
  return { mg, ml, mgPerMl: mg / ml }
}

const trim = (n: number, decimals: number) => String(Number(round(n, decimals).toFixed(decimals)))
const mgText = (n: number) => trim(n, 2)
const mlText = (n: number) => trim(n, n < 0.1 ? 3 : 2)
const rangeText = (low: number, high: number | undefined, f: (n: number) => string) =>
  high !== undefined && f(high) !== f(low) ? `${f(low)}–${f(high)}` : f(low)

function enrich(id: string, result: CalculationResult, dose: { low: number; high?: number } | undefined, strength: Strength | undefined): CalculationResult {
  const out: CalculationResult = {
    ...result,
    secondary: [...(result.secondary ?? [])],
    calculationSteps: [...(result.calculationSteps ?? [])],
    warnings: [...(result.warnings ?? [])],
  }

  if (!dose) {
    if (strength) out.warnings!.push("A volume per dose could not be calculated here, because this result is not a single numeric dose in mg.")
    return out
  }

  const rows: CalculationField[] = []
  const primaryIsPerDose = typeof result.value === "number" && PER_DOSE_UNIT.test(result.unit ?? "")
  const existingIndex = out.secondary!.findIndex((s) => /per[- ]dose|per administration/i.test(s.label))
  if (!primaryIsPerDose) {
    if (existingIndex >= 0) {
      // The calculator already shows the mg per dose: move that row to the top so it sits right above the volume.
      rows.push(out.secondary!.splice(existingIndex, 1)[0])
    } else {
      rows.push({ label: "Dose per administration", value: `${rangeText(dose.low, dose.high, mgText)} mg` })
    }
  }

  if (strength) {
    const lowMl = dose.low / strength.mgPerMl
    const highMl = dose.high !== undefined ? dose.high / strength.mgPerMl : undefined
    rows.push({ label: "Volume per dose", value: `${rangeText(lowMl, highMl, mlText)} mL` })
    rows.push({
      label: "Product strength used",
      value: `${trim(strength.mg, 3)} mg in ${trim(strength.ml, 3)} mL (${trim(strength.mgPerMl, 3)} mg/mL)`,
    })
    out.calculationSteps!.push(
      `Volume per dose: ${rangeText(dose.low, dose.high, mgText)} mg ÷ ${trim(strength.mgPerMl, 3)} mg/mL = ${rangeText(lowMl, highMl, mlText)} mL`,
    )

    const biggest = highMl ?? lowMl
    if (biggest > 30) out.warnings!.push("Large volume per dose (over 30 mL). Check the product strength and its units.")
    if (lowMl < 0.1) out.warnings!.push("Very small volume per dose (under 0.1 mL) is hard to measure accurately. Check the strength, any dilution, and the measuring device.")
    if (COMBINATION.has(id)) {
      out.warnings!.push("This product has two active ingredients. Enter the strength of the component the dose above is calculated for, not the total of both.")
    }
    out.warnings!.push("The volume comes from the strength you entered. Check the product label, the concentration after reconstitution or dilution, and the measuring device.")
  }

  out.secondary = [...rows, ...out.secondary!]
  return out
}

/** Adds the optional product-strength inputs and the mg-per-dose / mL-per-dose output to a supported calculator. */
export function withDoseVolume(def: CalculatorDefinition): CalculatorDefinition {
  if (!DOSE_VOLUME_IDS.has(def.id)) return def
  return {
    ...def,
    inputs: [...def.inputs, ...liquidStrengthInputs],
    calculate: (inputs) => {
      const strength = readStrength(inputs)
      const result = def.calculate(inputs)
      return enrich(def.id, result, perDoseMgOf(def.id, result), strength)
    },
  }
}
