// clinexia-upgrade:phase4 — total blood volume from height, weight and sex (Nadler) or BMI (Lemmens), with red cell and
// plasma volume from a packed cell volume (PCV, hematocrit). Hidden until approved in ./review.ts.
//
// Nadler SB, Hidalgo JH, Bloch T. Prediction of blood volume in normal human adults. Surgery. 1962;51(2):224-232.
//   men:   TBV (L) = 0.3669 H^3 + 0.03219 W + 0.6041        women: TBV (L) = 0.3561 H^3 + 0.03308 W + 0.1833   (H in m, W in kg)
// Lemmens HJM, Bernstein DP, Brodsky JB. Estimating blood volume in obese and morbidly obese patients. Obes Surg. 2006;16(6):773-776.
//   TBV (mL/kg) = 70 / sqrt(BMI / 22)
// Red cell volume = TBV x PCV; plasma volume = TBV x (1 - PCV). Adults only.
import type { CalculatorDefinition } from "../types"
import { CalculatorInputError, num, optionalNum, round, str } from "../helpers"

export function nadlerLitres(sex: "male" | "female", heightM: number, weightKg: number): number {
  return sex === "male" ? 0.3669 * heightM ** 3 + 0.03219 * weightKg + 0.6041 : 0.3561 * heightM ** 3 + 0.03308 * weightKg + 0.1833
}
export function lemmensMlPerKg(heightM: number, weightKg: number): number {
  const bmi = weightKg / (heightM * heightM)
  return 70 / Math.sqrt(bmi / 22)
}

export const bloodVolumeCalculator: CalculatorDefinition = {
  id: "blood-volume-nadler-lemmens",
  name: "Blood Volume (Nadler / Lemmens) with red cell and plasma volume",
  shortName: "Blood Volume",
  category: "hematology",
  subcategory: "blood-products",
  description: "Estimates an adult's total blood volume from height, weight and sex (Nadler) or from BMI (Lemmens). With a PCV it also splits the volume into red cell and plasma volume.",
  isEstimator: true,
  formula: "Nadler: men 0.3669·H³ + 0.03219·W + 0.6041 L; women 0.3561·H³ + 0.03308·W + 0.1833 L. Lemmens: 70 / √(BMI/22) mL/kg × W. Red cells = TBV × PCV; plasma = TBV × (1 − PCV).",
  keywords: ["blood volume", "nadler", "lemmens", "ebv", "red cell volume", "plasma volume", "pcv", "hematocrit"],
  relatedTools: ["estimated-blood-volume"],
  inputs: [
    { id: "method", label: "Method", kind: "select", options: [{ value: "nadler", label: "Nadler (height, weight, sex)" }, { value: "lemmens", label: "Lemmens (BMI-based, includes obesity)" }] },
    { id: "ageYears", label: "Age", kind: "number", unit: "years", min: 18, max: 120, step: 1, helpText: "Adults only. These equations are not for children." },
    { id: "sex", label: "Sex", kind: "select", optional: true, options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }], helpText: "Required for Nadler. Not used by Lemmens." },
    { id: "heightCm", label: "Height", kind: "number", unit: "cm", min: 100, max: 250, step: 0.5 },
    { id: "weightKg", label: "Weight", kind: "number", unit: "kg", min: 30, max: 400, step: 0.1 },
    { id: "pcv", label: "PCV (hematocrit)", kind: "number", unit: "%", min: 10, max: 70, step: 0.1, optional: true, helpText: "Optional. Enter it to get red cell and plasma volume." },
  ],
  calculate: (inputs) => {
    const method = str(inputs, "method")
    if (method !== "nadler" && method !== "lemmens") throw new CalculatorInputError("Choose a method.")
    const heightM = num(inputs, "heightCm") / 100
    const weight = num(inputs, "weightKg")
    let tbvMl: number
    if (method === "nadler") {
      const sex = String(inputs.sex ?? "")
      if (sex !== "male" && sex !== "female") throw new CalculatorInputError("Nadler needs the sex (male or female).")
      tbvMl = nadlerLitres(sex, heightM, weight) * 1000
    } else {
      tbvMl = lemmensMlPerKg(heightM, weight) * weight
    }
    const total = round(tbvMl, 0)
    const secondary = [{ label: "Per kg", value: `${round(tbvMl / weight, 1)} mL/kg` }]
    const pcvPercent = optionalNum(inputs, "pcv")
    const steps = [method === "nadler" ? "Nadler equation, converted from litres to mL." : "Lemmens: mL/kg from BMI, multiplied by weight."]
    if (pcvPercent !== undefined) {
      const f = pcvPercent / 100
      secondary.push({ label: "Red cell volume", value: `${round(tbvMl * f, 0)} mL` }, { label: "Plasma volume", value: `${round(tbvMl * (1 - f), 0)} mL` })
      steps.push(`Red cells = TBV × ${pcvPercent}%; plasma = TBV × ${round(100 - pcvPercent, 1)}%.`)
    }
    return {
      value: total,
      unit: "mL",
      display: `Total blood volume: ${total} mL`,
      secondary,
      calculationSteps: steps,
      interpretation: "An estimate for a typical adult of this size. Individual blood volume varies.",
      warnings: pcvPercent !== undefined ? ["Whole-body hematocrit is generally lower than the venous PCV, so the red cell and plasma split is approximate."] : undefined,
    }
  },
  limitations: [
    "Adults only (age 18 or over).",
    "Estimates from population equations, not a measurement of blood volume.",
    "Fluid status, pregnancy and some conditions change blood volume.",
  ],
}
