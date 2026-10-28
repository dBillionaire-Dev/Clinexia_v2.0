import { INPUT_CODING } from "@clinexia/core"
import { getCalculatorById, type CalculatorDefinition } from "@clinexia/core"

/** The SMART launcher only works for calculators that have FHIR-coded inputs and are not dosing or oncology tools. */
export const DEFAULT_SMART_CALCULATOR = "egfr-ckd-epi"

export function smartCalculatorIds(): string[] {
  return Object.keys(INPUT_CODING).filter((id) => {
    const def = getCalculatorById(id)
    return def !== undefined && def.category !== "dosing" && def.category !== "oncology"
  })
}

/** Resolves the calculator named in a launch URL, or the default. An unknown or not-allowed id falls back to the default. */
export function resolveSmartCalculator(id: string | null | undefined): CalculatorDefinition {
  const ok = id && smartCalculatorIds().includes(id) ? id : DEFAULT_SMART_CALCULATOR
  return getCalculatorById(ok)!
}

export const calculatorPath = (def: Pick<CalculatorDefinition, "id" | "category">, embed: boolean) =>
  `${embed ? "/embed" : "/calculators"}/${def.category}/${def.id}`
