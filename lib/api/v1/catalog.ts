import type { CalculatorDefinition, InputDefinition } from "@/lib/calculators/types"
import { CALCULATOR_CATEGORY_LABELS } from "@/lib/calculators/types"
import { getResultCoding } from "@/lib/calculators/coding-metadata"
import { getFormulaVersion } from "@/lib/calculators/versions"
import { getReferenceStatus } from "@/lib/calculators/formula-info"
import { scopeForCalculator, hasScope } from "../scopes"

const describeInput = (i: InputDefinition) => ({
  id: i.id,
  label: i.label,
  kind: i.kind,
  unit: i.unit ?? null,
  min: i.min ?? null,
  max: i.max ?? null,
  options: i.options?.map((o) => ({ value: o.value, label: o.label })) ?? null,
  optional: i.optional === true,
  loinc: i.loinc ?? null,
  ucum: i.ucum ?? null,
  fhir: i.fhir ?? null,
})

/** The public description of one calculator. Calculators do not declare their outputs, so `outputs` carries the primary result's coding. */
export function describeCalculator(def: CalculatorDefinition) {
  const coding = getResultCoding(def.id)
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    categoryLabel: CALCULATOR_CATEGORY_LABELS[def.category],
    subcategory: def.subcategory ?? null,
    description: def.description,
    requiredScope: scopeForCalculator(def),
    inputs: def.inputs.map(describeInput),
    outputs: [{ id: "result", label: "Primary result", ucum: coding?.ucum ?? null, loinc: coding?.loinc ?? null }],
    formula: def.formula ?? null,
    notes: def.notes ?? [],
    limitations: def.limitations ?? [],
    version: getFormulaVersion(def.id) ?? "unversioned",
    referenceStatus: getReferenceStatus(def) ?? null,
  }
}

/** Calculators this key may run (catalog filtering). */
export const visibleTo = (scopes: readonly string[], all: CalculatorDefinition[]) => all.filter((c) => hasScope(scopes, scopeForCalculator(c)))
