// clinexia-upgrade:phase4 — SOFA (Sequential Organ Failure Assessment). Hidden until approved in ./review.ts.
//
// Thresholds follow the table published in Sepsis-3 (Singer 2016), which restates Vincent 1996.
// Published tables leave the exact boundary values unassigned (for example bilirubin "6.0-11.9" then "> 12.0").
// This tool assigns each boundary to the higher score (>= 12.0, >= 5.0 and so on). A clinical reviewer must
// confirm that choice. Systems that are not entered are NOT scored and NOT assumed normal.
import type { CalculatorDefinition } from "../types"
import { CalculatorInputError, optionalNum, round } from "../helpers"

const BILIRUBIN_UMOL_PER_MGDL = 17.1
const CREATININE_UMOL_PER_MGDL = 88.4

const cardioOptions = [
  { value: "tier2", label: "Dopamine ≤ 5 µg/kg/min, or dobutamine (any dose)" },
  { value: "tier3", label: "Dopamine > 5 to 15, or epinephrine ≤ 0.1, or norepinephrine ≤ 0.1 µg/kg/min" },
  { value: "tier4", label: "Dopamine > 15, or epinephrine > 0.1, or norepinephrine > 0.1 µg/kg/min" },
  { value: "none", label: "No vasoactive drugs" },
]
const unitOptions = (a: string, b: string) => [{ value: "mgdl", label: a }, { value: "umol", label: b }]

export function sofaRespiration(pao2: number, fio2: number, support: boolean): number {
  const ratio = pao2 / fio2
  if (ratio < 100 && support) return 4
  if (ratio < 200 && support) return 3
  if (ratio < 300) return 2
  if (ratio < 400) return 1
  return 0
}
export const sofaCoagulation = (platelets: number) => (platelets < 20 ? 4 : platelets < 50 ? 3 : platelets < 100 ? 2 : platelets < 150 ? 1 : 0)
export const sofaLiver = (bilirubinMgDl: number) => (bilirubinMgDl >= 12 ? 4 : bilirubinMgDl >= 6 ? 3 : bilirubinMgDl >= 2 ? 2 : bilirubinMgDl >= 1.2 ? 1 : 0)
export const sofaCns = (gcs: number) => (gcs < 6 ? 4 : gcs <= 9 ? 3 : gcs <= 12 ? 2 : gcs <= 14 ? 1 : 0)
export function sofaCardiovascular(map: number | undefined, tier: string): number {
  const drug = tier === "tier4" ? 4 : tier === "tier3" ? 3 : tier === "tier2" ? 2 : 0
  const pressure = map !== undefined && map < 70 ? 1 : 0
  return Math.max(drug, pressure)
}
export function sofaRenal(creatinineMgDl: number | undefined, urineMlPerDay: number | undefined): number {
  const fromCreatinine = creatinineMgDl === undefined ? 0 : creatinineMgDl >= 5 ? 4 : creatinineMgDl >= 3.5 ? 3 : creatinineMgDl >= 2 ? 2 : creatinineMgDl >= 1.2 ? 1 : 0
  const fromUrine = urineMlPerDay === undefined ? 0 : urineMlPerDay < 200 ? 4 : urineMlPerDay < 500 ? 3 : 0
  return Math.max(fromCreatinine, fromUrine)
}

function unitOf(inputs: Record<string, number | string>, id: string, label: string): "mgdl" | "umol" {
  const unit = String(inputs[id] ?? "")
  if (unit !== "mgdl" && unit !== "umol") throw new CalculatorInputError(`Choose the unit for ${label}.`)
  return unit
}

export const sofaCalculator: CalculatorDefinition = {
  id: "sofa",
  name: "SOFA score (Sequential Organ Failure Assessment)",
  shortName: "SOFA",
  category: "general",
  description: "Scores six organ systems from 0 to 4 each. Enter only the systems you have data for: systems left blank are not scored and are not assumed normal.",
  formula: "SOFA = respiration + coagulation + liver + cardiovascular + central nervous system + renal (each 0 to 4). Maximum 24.",
  keywords: ["sepsis", "organ failure", "icu", "critical care"],
  inputs: [
    { id: "pao2", label: "PaO₂", kind: "number", unit: "mmHg", min: 10, max: 700, step: 1, optional: true },
    { id: "fio2", label: "FiO₂ (fraction)", kind: "number", unit: "0.21 to 1.00", min: 0.21, max: 1, step: 0.01, optional: true, helpText: "Required with PaO₂. Enter 0.40 for 40%." },
    { id: "support", label: "Ventilatory support (mechanical ventilation or CPAP)", kind: "select", optional: true, options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }], helpText: "Required with PaO₂. Scores 3 and 4 need respiratory support." },
    { id: "platelets", label: "Platelets", kind: "number", unit: "×10⁹/L", min: 0, max: 2000, step: 1, optional: true },
    { id: "bilirubin", label: "Bilirubin", kind: "number", min: 0, max: 1500, step: 0.1, optional: true },
    { id: "bilirubinUnit", label: "Bilirubin unit", kind: "select", optional: true, options: unitOptions("mg/dL", "µmol/L") },
    { id: "map", label: "Mean arterial pressure", kind: "number", unit: "mmHg", min: 10, max: 250, step: 1, optional: true },
    { id: "cardioSupport", label: "Vasoactive drugs (given for at least 1 hour)", kind: "select", optional: true, options: cardioOptions },
    { id: "gcs", label: "Glasgow Coma Scale total", kind: "number", unit: "points (3 to 15)", min: 3, max: 15, step: 1, optional: true },
    { id: "creatinine", label: "Creatinine", kind: "number", min: 0, max: 3000, step: 0.1, optional: true },
    { id: "creatinineUnit", label: "Creatinine unit", kind: "select", optional: true, options: unitOptions("mg/dL", "µmol/L") },
    { id: "urineOutput", label: "Urine output (24 h)", kind: "number", unit: "mL/day", min: 0, max: 10000, step: 10, optional: true },
  ],
  calculate: (inputs) => {
    const scores: Array<{ system: string; points: number; basis: string }> = []

    const pao2 = optionalNum(inputs, "pao2")
    const fio2 = optionalNum(inputs, "fio2")
    const support = String(inputs.support ?? "")
    if (pao2 !== undefined || fio2 !== undefined) {
      if (pao2 === undefined || fio2 === undefined) throw new CalculatorInputError("Enter both PaO₂ and FiO₂ to score respiration.")
      if (support !== "yes" && support !== "no") throw new CalculatorInputError("State whether the patient has ventilatory support.")
      scores.push({ system: "Respiration", points: sofaRespiration(pao2, fio2, support === "yes"), basis: `PaO₂/FiO₂ = ${round(pao2 / fio2, 0)} mmHg` })
    }

    const platelets = optionalNum(inputs, "platelets")
    if (platelets !== undefined) scores.push({ system: "Coagulation", points: sofaCoagulation(platelets), basis: `${platelets} ×10⁹/L` })

    const bilirubin = optionalNum(inputs, "bilirubin")
    if (bilirubin !== undefined) {
      const mgdl = unitOf(inputs, "bilirubinUnit", "bilirubin") === "umol" ? bilirubin / BILIRUBIN_UMOL_PER_MGDL : bilirubin
      scores.push({ system: "Liver", points: sofaLiver(mgdl), basis: `${round(mgdl, 2)} mg/dL` })
    }

    const map = optionalNum(inputs, "map")
    const tier = String(inputs.cardioSupport ?? "")
    if (map !== undefined || (tier !== "" && tier !== "none")) {
      scores.push({ system: "Cardiovascular", points: sofaCardiovascular(map, tier), basis: map !== undefined ? `MAP ${map} mmHg` : "vasoactive drugs" })
    }

    const gcs = optionalNum(inputs, "gcs")
    if (gcs !== undefined) {
      if (!Number.isInteger(gcs)) throw new CalculatorInputError("Glasgow Coma Scale total must be a whole number from 3 to 15.")
      scores.push({ system: "Central nervous system", points: sofaCns(gcs), basis: `GCS ${gcs}` })
    }

    const creatinine = optionalNum(inputs, "creatinine")
    const urine = optionalNum(inputs, "urineOutput")
    if (creatinine !== undefined || urine !== undefined) {
      const mgdl = creatinine === undefined ? undefined : unitOf(inputs, "creatinineUnit", "creatinine") === "umol" ? creatinine / CREATININE_UMOL_PER_MGDL : creatinine
      scores.push({ system: "Renal", points: sofaRenal(mgdl, urine), basis: [mgdl !== undefined ? `${round(mgdl, 2)} mg/dL` : "", urine !== undefined ? `${urine} mL/day` : ""].filter(Boolean).join(", ") })
    }

    if (scores.length === 0) throw new CalculatorInputError("Enter data for at least one organ system.")
    const total = scores.reduce((sum, s) => sum + s.points, 0)
    const partial = scores.length < 6
    return {
      value: total,
      display: `SOFA: ${total}${partial ? ` (${scores.length} of 6 systems scored)` : ""}`,
      secondary: scores.map((s) => ({ label: s.system, value: `${s.points} (${s.basis})` })),
      calculationSteps: [`${scores.map((s) => s.points).join(" + ")} = ${total}`],
      interpretation: "Higher scores mean more organ dysfunction. In Sepsis-3, organ dysfunction due to infection is defined as an acute rise in total SOFA of 2 or more points from the patient's baseline. This tool does not know the baseline, and the total alone is not a diagnosis.",
      warnings: partial ? ["Systems that were not entered were not scored and are not assumed normal. The total may under-state organ dysfunction."] : undefined,
    }
  },
  limitations: [
    "Adult scoring table. Not validated for children.",
    "Use the worst value in the period being assessed, as defined by the source.",
    "Boundary values that published tables leave unassigned (for example bilirubin exactly 12.0 mg/dL) are scored in the higher category here.",
  ],
}

