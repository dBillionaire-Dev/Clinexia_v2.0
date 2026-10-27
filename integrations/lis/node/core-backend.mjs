/**
 * Calculation backend that runs @clinexia/core directly (no network). Pass the module: import * as core from "@clinexia/core".
 * Mirrors what the public API does for one calculation: normalise units, check bounds, calculate, collect safety warnings.
 */
export function createCoreBackend(core) {
  return {
    name: "@clinexia/core",
    calculate(calculatorId, inputs) {
      const def = core.getCalculatorById(calculatorId)
      if (!def) return { ok: false, reason: "unknown_calculator" }
      const n = core.normaliseInputs(def, inputs)
      if (n.errors.length > 0) return { ok: false, reason: "invalid_input", fields: n.errors.map((e) => ({ id: e.id, code: e.code })) }
      try {
        core.validateCalculatorInputBounds(def, n.inputs)
        const result = def.calculate(n.inputs)
        const warnings = [...(result.warnings ?? []), ...core.getDosingSafetyWarnings(def, n.inputs, result), ...core.getCalculatorSafetyWarnings(def, n.inputs, result)]
        return {
          ok: true,
          version: core.getFormulaVersion(calculatorId) ?? "unversioned",
          result: { value: result.value, unit: result.unit, display: result.display, secondary: result.secondary ?? [] },
          warnings: Array.from(new Set(warnings)),
        }
      } catch {
        return { ok: false, reason: "calculation_error" }
      }
    },
  }
}
