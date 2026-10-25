import type { CalculationResult, CalculatorDefinition } from "@/lib/calculators/types"
import { CALCULATION_DISCLAIMER } from "@/lib/calculators/types"
import { validateCalculatorInputBounds, getDosingSafetyWarnings } from "@/lib/calculators/dosing-safety"
import { getCalculatorSafetyWarnings } from "@/lib/calculators/calculation-safety"
import { getCalculatorReferences, type CalculatorReference } from "@/lib/calculators/dosing-references"
import { getReferenceStatus, type ReferenceStatus } from "@/lib/calculators/formula-info"
import { getFormulaVersion } from "@/lib/calculators/versions"
import { getResultCoding } from "@/lib/calculators/coding-metadata"
import { INTENDED_USE_LINE } from "@/lib/integration/constants"
import { normaliseInputs, type NormaliseConversion, type NormaliseError } from "@/lib/integration/normalise"

export interface CalculationOk {
  ok: true
  id: string
  version: string
  result: CalculationResult
  conversions: NormaliseConversion[]
  references: CalculatorReference[]
  referenceStatus: ReferenceStatus | null
  disclaimer: string
  intendedUse: string
}
export interface CalculationFailure {
  ok: false
  fields: Array<NormaliseError | { id: null; code: "calculation_error"; message: string }>
}

/**
 * One calculation, the way the web form does it: normalise units, check bounds, calculate, add the same safety warnings.
 * Nothing about the inputs or the result is logged or stored.
 */
export function runCalculation(def: CalculatorDefinition, rawInputs: Record<string, unknown>): CalculationOk | CalculationFailure {
  const normalised = normaliseInputs(def, rawInputs)
  if (normalised.errors.length > 0) return { ok: false, fields: normalised.errors }

  const parsed = normalised.inputs
  let calc: CalculationResult
  try {
    validateCalculatorInputBounds(def, parsed)
    calc = def.calculate(parsed)
  } catch (error) {
    return { ok: false, fields: [{ id: null, code: "calculation_error", message: error instanceof Error ? error.message : "The calculation could not be completed." }] }
  }

  const warnings = [...(calc.warnings ?? []), ...getDosingSafetyWarnings(def, parsed, calc), ...getCalculatorSafetyWarnings(def, parsed, calc)]
  const coding = getResultCoding(def.id)
  const result: CalculationResult = {
    ...calc,
    ...(coding?.ucum && calc.ucum === undefined ? { ucum: coding.ucum } : {}),
    ...(coding?.loinc && calc.loinc === undefined ? { loinc: coding.loinc } : {}),
    warnings: warnings.length ? Array.from(new Set(warnings)) : undefined,
  }
  return {
    ok: true,
    id: def.id,
    version: getFormulaVersion(def.id) ?? "unversioned",
    result,
    conversions: normalised.conversions,
    references: getCalculatorReferences(def),
    referenceStatus: getReferenceStatus(def) ?? null,
    disclaimer: CALCULATION_DISCLAIMER,
    intendedUse: INTENDED_USE_LINE,
  }
}
