import type { CalculatorDefinition } from "./types"
import { getCalculatorReferences, type CalculatorReference } from "./dosing-references"
import { getFormulaVersion } from "./versions"

export type ReferenceStatus = "current" | "supporting" | "review-needed"

/** Worst status wins: any review-needed reference makes the calculator review-needed; all current is current; otherwise supporting. */
export function getReferenceStatus(definition: CalculatorDefinition): ReferenceStatus | undefined {
  const statuses = getCalculatorReferences(definition).map((r) => r.status)
  if (statuses.length === 0) return undefined
  if (statuses.includes("review-needed")) return "review-needed"
  if (statuses.every((s) => s === "current")) return "current"
  return "supporting"
}

export interface FormulaInfo {
  id: string
  version: string | undefined
  referenceStatus: ReferenceStatus | undefined
  references: CalculatorReference[]
}

/** Version, aggregated reference status and the references themselves, for catalogs and API responses. */
export function getFormulaInfo(definition: CalculatorDefinition): FormulaInfo {
  return {
    id: definition.id,
    version: getFormulaVersion(definition.id),
    referenceStatus: getReferenceStatus(definition),
    references: getCalculatorReferences(definition),
  }
}
