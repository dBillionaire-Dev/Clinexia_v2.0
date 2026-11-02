// clinexia-upgrade:phase4 — LDL cholesterol by the Sampson (NIH) equation. Hidden until approved in ./review.ts.
//
// Sampson M, Ling C, Sun Q, et al. A new equation for calculation of low-density lipoprotein cholesterol in patients with
// normolipidemia and/or hypertriglyceridemia. JAMA Cardiol. 2020;5(5):540-548.
//   LDL-C = TC/0.948 - HDL-C/0.971 - (TG/8.56 + TG x nonHDL-C/2140 - TG^2/16100) - 9.44      (all mg/dL, nonHDL = TC - HDL)
// Validated for triglycerides up to 800 mg/dL. Above that no value is given. mmol/L entries are converted with the
// usual factors (cholesterol 38.67 mg/dL per mmol/L, triglycerides 88.57) and the result is converted back.
import type { CalculatorDefinition } from "../types"
import { CalculatorInputError, num, round, str } from "../helpers"

const CHOLESTEROL_MGDL_PER_MMOL = 38.67
const TRIGLYCERIDE_MGDL_PER_MMOL = 88.57
export const SAMPSON_MAX_TG_MGDL = 800

export function sampsonLdlMgDl(tc: number, hdl: number, tg: number): number {
  const nonHdl = tc - hdl
  return tc / 0.948 - hdl / 0.971 - (tg / 8.56 + (tg * nonHdl) / 2140 - (tg * tg) / 16100) - 9.44
}

export const sampsonLdlCalculator: CalculatorDefinition = {
  id: "ldl-sampson",
  name: "LDL Cholesterol (Sampson / NIH equation)",
  shortName: "LDL (Sampson)",
  category: "chemistry",
  description: "Estimates LDL cholesterol from total cholesterol, HDL and triglycerides when triglycerides are up to 800 mg/dL (9.0 mmol/L). Use it when a direct LDL measurement is not available and Friedewald cannot be used.",
  isEstimator: true,
  formula: "LDL = TC/0.948 − HDL/0.971 − (TG/8.56 + TG × nonHDL/2140 − TG²/16100) − 9.44 (mg/dL; nonHDL = TC − HDL)",
  keywords: ["ldl", "cholesterol", "sampson", "nih", "lipid", "triglycerides"],
  relatedTools: ["ldl-friedewald", "non-hdl-cholesterol", "total-hdl-ratio"],
  inputs: [
    { id: "unit", label: "Units", kind: "select", options: [{ value: "mg/dL", label: "mg/dL" }, { value: "mmol/L", label: "mmol/L" }], helpText: "Choose the unit your laboratory reported. Nothing is assumed." },
    { id: "tc", label: "Total cholesterol", kind: "number", min: 0, step: 0.01 },
    { id: "hdl", label: "HDL cholesterol", kind: "number", min: 0, step: 0.01 },
    { id: "tg", label: "Triglycerides", kind: "number", min: 0, step: 0.01 },
  ],
  calculate: (inputs) => {
    const unit = str(inputs, "unit")
    if (unit !== "mg/dL" && unit !== "mmol/L") throw new CalculatorInputError("Choose mg/dL or mmol/L.")
    const mmol = unit === "mmol/L"
    const tc = num(inputs, "tc") * (mmol ? CHOLESTEROL_MGDL_PER_MMOL : 1)
    const hdl = num(inputs, "hdl") * (mmol ? CHOLESTEROL_MGDL_PER_MMOL : 1)
    const tg = num(inputs, "tg") * (mmol ? TRIGLYCERIDE_MGDL_PER_MMOL : 1)
    if (tc <= 0 || hdl <= 0) throw new CalculatorInputError("Total cholesterol and HDL must be greater than zero.")
    if (hdl > tc) throw new CalculatorInputError("HDL cannot be higher than total cholesterol. Check the values.")
    if (tg > SAMPSON_MAX_TG_MGDL) {
      throw new CalculatorInputError(`The Sampson equation is validated only up to triglycerides of ${SAMPSON_MAX_TG_MGDL} mg/dL (9.0 mmol/L). Above that, use a direct LDL measurement. No value is given.`)
    }
    const ldlMgDl = sampsonLdlMgDl(tc, hdl, tg)
    const value = mmol ? round(ldlMgDl / CHOLESTEROL_MGDL_PER_MMOL, 2) : round(ldlMgDl, 1)
    return {
      value,
      unit,
      display: `${value} ${unit}`,
      secondary: [{ label: "Non-HDL cholesterol", value: `${mmol ? round((tc - hdl) / CHOLESTEROL_MGDL_PER_MMOL, 2) : round(tc - hdl, 1)} ${unit}` }],
      calculationSteps: [mmol ? "Values converted to mg/dL (cholesterol × 38.67, triglycerides × 88.57), calculated, then converted back." : "Calculated in mg/dL."],
      warnings: ldlMgDl < 0 ? ["The calculated LDL is negative. Check the input values."] : undefined,
    }
  },
  notes: ["A direct LDL measurement is preferred when triglycerides are high. Use this estimate when a direct measurement is not available."],
  limitations: [
    "Validated for triglycerides up to 800 mg/dL (9.0 mmol/L). No value is given above that.",
    "An estimate, not a measured value.",
    "Fasting is not required for the equation, but results from a different laboratory method may differ.",
  ],
}
