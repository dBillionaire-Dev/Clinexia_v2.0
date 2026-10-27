import { describe, expect, it } from "vitest"
import { getCalculatorSafetyWarnings } from "./calculation-safety"
import { calculators } from "./registry"

describe("calculation safety layer", () => {
  it("adds laboratory preparation guidance to laboratory solution calculators", () => {
    const definition = calculators.find((c) => c.category === "lab-solutions")
    expect(definition).toBeDefined()
    const warnings = getCalculatorSafetyWarnings(definition!, {}, { value: 1, display: "1" })
    expect(warnings.some((warning) => warning.includes("validated SOPs"))).toBe(true)
  })

  it("adds method-awareness guidance to spectrophotometry calculators", () => {
    const definition = calculators.find((c) => c.category === "spectrophotometry")
    expect(definition).toBeDefined()
    const warnings = getCalculatorSafetyWarnings(definition!, {}, { value: 1, display: "1" })
    expect(warnings.some((warning) => warning.includes("blank-corrected"))).toBe(true)
  })

  it("adds method-awareness guidance to microbiology calculators", () => {
    const definition = calculators.find((c) => c.category === "microbiology")
    expect(definition).toBeDefined()
    const warnings = getCalculatorSafetyWarnings(definition!, {}, { value: 1, display: "1" })
    expect(warnings.some((warning) => warning.includes("validated specimen"))).toBe(true)
  })

  it("rejects non-finite numeric results", () => {
    const definition = calculators[0]
    expect(() => getCalculatorSafetyWarnings(definition, {}, { value: Number.NaN, display: "NaN" })).toThrow(/not finite/)
  })
})
