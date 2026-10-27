import { describe, expect, it } from "vitest"
import * as core from "./index"
import { TEST_VECTORS } from "./vectors"
import * as vectors from "./vectors"

describe("public entry point", () => {
  it("exposes the documented API", () => {
    for (const name of [
      "calculators", "getCalculatorById", "calculatorCategories", "searchCalculators", "CALCULATION_DISCLAIMER", "FORMULA_VERSIONS", "getFormulaVersion",
      "getReferenceStatus", "getFormulaInfo", "getCalculatorReferences", "INPUT_CODING", "getResultCoding", "withCodingMetadata", "validateCalculatorInputBounds",
      "getDosingSafetyWarnings", "getCalculatorSafetyWarnings", "conversionCategories", "convert", "getConversionCategory", "mgdLToMmolL", "analytes",
      "normaliseInputs", "resolveUnit", "canonicalUnit", "convertAnalyteUnits", "parsePrefill", "prefillUnitResolver",
    ]) {
      expect((core as Record<string, unknown>)[name], name).toBeDefined()
    }
  })

  it("runs a calculation end to end from the entry point alone", () => {
    const def = core.getCalculatorById("creatinine-clearance")!
    const n = core.normaliseInputs(def, { age: 54, weight: 70, sex: "male", creatinine: { value: 88, unit: "umol/L" } })
    expect(n.errors).toEqual([])
    expect(def.calculate(n.inputs).display).toBe("84 mL/min")
    expect(core.getFormulaVersion("creatinine-clearance")).toBe("1.0.0")
  })

  it("exposes the test vectors on their own entry (for checking another copy of the calculators)", () => {
    expect(Object.keys(TEST_VECTORS).length).toBe(core.calculators.length)
    expect(typeof vectors.runVectorCase).toBe("function")
    const def = core.getCalculatorById("bmi")!
    const first = TEST_VECTORS.bmi.cases[0]
    expect(vectors.describeOutcome(vectors.runVectorCase(def, first.inputs))).toBe(first.display)
  })

  it("does not leak the internal helpers", () => {
    for (const name of ["num", "str", "round", "fmt", "safeDivide", "TEST_VECTORS"]) expect((core as Record<string, unknown>)[name], name).toBeUndefined()
  })
})
