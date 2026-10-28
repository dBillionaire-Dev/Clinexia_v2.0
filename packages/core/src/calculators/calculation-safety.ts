import type { CalculatorDefinition, CalculationResult } from "./types"
import { LAB_PREP_DISCLAIMER } from "./types"

/**
 * Non-prescriptive safety/quality prompts for laboratory calculation tools.
 * These are intentionally method-aware reminders, not acceptance criteria.
 */
export function getCalculatorSafetyWarnings(
  definition: CalculatorDefinition,
  _parsed: Record<string, number | string>,
  result: CalculationResult,
): string[] {
  const warnings: string[] = []

  if (typeof result.value === "number" && !Number.isFinite(result.value)) {
    throw new Error("The calculated result is not finite. Check the entered values and units.")
  }

  if (definition.category === "lab-solutions") {
    warnings.push(LAB_PREP_DISCLAIMER)
  }

  if (definition.category === "spectrophotometry") {
    warnings.push("Use blank-corrected measurements and the laboratory's validated analytical/calibration range; this tool does not validate instrument performance or method linearity.")
  }

  if (definition.category === "microbiology") {
    warnings.push("Use the laboratory's validated specimen, dilution, plating and counting procedure; calculated CFU values do not establish organism identity or clinical significance.")
  }

  return warnings
}
