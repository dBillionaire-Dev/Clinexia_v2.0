// clinexia-upgrade:phase4 — qSOFA (quick SOFA). Hidden until approved in ./review.ts.
import type { CalculatorDefinition } from "../types"
import { CalculatorInputError, num } from "../helpers"

export const qsofaCalculator: CalculatorDefinition = {
  id: "qsofa",
  name: "qSOFA (quick SOFA)",
  shortName: "qSOFA",
  category: "general",
  description: "Counts three bedside criteria (respiratory rate, systolic blood pressure, Glasgow Coma Scale) in an adult with suspected infection, outside the ICU.",
  formula: "qSOFA = 1 point each for: respiratory rate ≥ 22/min, systolic BP ≤ 100 mmHg, GCS < 15. Positive screen: 2 or more points.",
  keywords: ["sepsis", "quick sofa", "screening", "emergency"],
  inputs: [
    { id: "respiratoryRate", label: "Respiratory rate", kind: "number", unit: "breaths/min", min: 4, max: 80, step: 1 },
    { id: "systolicBp", label: "Systolic blood pressure", kind: "number", unit: "mmHg", min: 30, max: 300, step: 1 },
    { id: "gcs", label: "Glasgow Coma Scale total", kind: "number", unit: "points (3 to 15)", min: 3, max: 15, step: 1, helpText: "Below 15 counts as altered mentation." },
  ],
  calculate: (inputs) => {
    const rr = num(inputs, "respiratoryRate")
    const sbp = num(inputs, "systolicBp")
    const gcs = num(inputs, "gcs")
    if (!Number.isInteger(gcs)) throw new CalculatorInputError("Glasgow Coma Scale total must be a whole number from 3 to 15.")
    const rrPoint = rr >= 22 ? 1 : 0
    const sbpPoint = sbp <= 100 ? 1 : 0
    const gcsPoint = gcs < 15 ? 1 : 0
    const score = rrPoint + sbpPoint + gcsPoint
    const positive = score >= 2
    return {
      value: score,
      display: `qSOFA: ${score} of 3 (${positive ? "positive screen" : "negative screen"})`,
      secondary: [
        { label: "Respiratory rate ≥ 22/min", value: rrPoint ? "Yes (1)" : "No (0)" },
        { label: "Systolic BP ≤ 100 mmHg", value: sbpPoint ? "Yes (1)" : "No (0)" },
        { label: "GCS < 15", value: gcsPoint ? "Yes (1)" : "No (0)" },
      ],
      calculationSteps: [`${rrPoint} + ${sbpPoint} + ${gcsPoint} = ${score}`],
      interpretation: positive
        ? "Two or more criteria are present. In the Sepsis-3 work this identified patients with suspected infection who were more likely to have a poor outcome, and should prompt assessment for organ dysfunction. It does not diagnose sepsis."
        : "Fewer than two criteria are present. A negative qSOFA does not rule out sepsis: the score is insensitive.",
      warnings: ["The 2026 Surviving Sepsis Campaign guideline recommends against using qSOFA as a single screening tool for sepsis or septic shock, and suggests NEWS, NEWS2, MEWS or SIRS instead."],
    }
  },
  limitations: [
    "Intended for adults with suspected infection outside the ICU. Not validated in children or pregnancy.",
    "Insensitive: many patients with sepsis score 0 or 1.",
    "A screening score, not a diagnosis. Sepsis is assessed with the SOFA score and clinical judgement.",
  ],
}

