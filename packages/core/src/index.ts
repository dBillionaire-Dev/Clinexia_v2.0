/**
 * @clinexia/core: the calculators, conversions and integration helpers, with no dependency on Next.js, React, Supabase, Node or the
 * browser. This file is the whole public API; deep imports are not supported outside this repository.
 */

// Calculators: types, registry, versions, references, coding metadata, safety checks
export * from "./calculators/types"
export * from "./calculators/registry"
export { FORMULA_VERSIONS, getFormulaVersion } from "./calculators/versions"
export * from "./calculators/formula-info"
export * from "./calculators/dosing-references"
export * from "./calculators/coding-metadata"
export { validateCalculatorInputBounds, getDosingSafetyWarnings } from "./calculators/dosing-safety"
export { getCalculatorSafetyWarnings } from "./calculators/calculation-safety"

// Conversions
export * from "./conversions/registry"
export * from "./conversions/molar-mass"

// Integration: unit normalisation and deep-link prefill parsing
export * from "./integration/units"
export * from "./integration/normalise"
export * from "./integration/prefill"
