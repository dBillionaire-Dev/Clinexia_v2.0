import { describe, expect, it } from "vitest"
import { calculators, getCalculatorById, getCalculatorsByCategory, searchCalculators } from "./registry"

describe("calculator registry integrity", () => {
  it("has no duplicate ids", () => {
    const ids = calculators.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every calculator has at least one input and a calculate function", () => {
    for (const c of calculators) {
      expect(c.inputs.length).toBeGreaterThan(0)
      expect(typeof c.calculate).toBe("function")
    }
  })

  // Most calculators deliberately ship no defaults: pre-filling a patient value
  // such as ANC or age would be unsafe. Where a calculator does default every
  // input, though, opening it must produce a working calculation rather than an
  // immediate "missing required value" error.
  it("every fully-defaulted calculator runs without throwing on its own defaults", () => {
    // The optional product-strength inputs (added to dosing calculators) never have defaults: they are left empty.
    const isStrengthInput = (id: string) => id === "liquidMg" || id === "liquidMl"
    const fullyDefaulted = calculators.filter((c) => c.inputs.every((input) => input.defaultValue !== undefined || isStrengthInput(input.id)))
    expect(fullyDefaulted.length).toBeGreaterThan(0)

    for (const c of fullyDefaulted) {
      const inputs: Record<string, number | string> = {}
      for (const input of c.inputs) inputs[input.id] = (input.defaultValue ?? "") as number | string
      expect(() => c.calculate(inputs), `${c.id} threw with its own default inputs`).not.toThrow()
    }
  })

  it("every relatedTools reference points to a real calculator", () => {
    for (const c of calculators) {
      for (const relatedId of c.relatedTools ?? []) {
        expect(getCalculatorById(relatedId), `${c.id} references missing related tool ${relatedId}`).toBeDefined()
      }
    }
  })

  it("getCalculatorsByCategory only returns calculators in that category", () => {
    const chemistry = getCalculatorsByCategory("chemistry")
    expect(chemistry.length).toBeGreaterThan(0)
    expect(chemistry.every((c) => c.category === "chemistry")).toBe(true)
  })

  it("searchCalculators finds a known calculator by name and keyword", () => {
    expect(searchCalculators("bmi").some((c) => c.id === "bmi")).toBe(true)
    expect(searchCalculators("body mass index").some((c) => c.id === "bmi")).toBe(true)
  })

  it("searchCalculators returns nothing for an empty query", () => {
    expect(searchCalculators("")).toEqual([])
  })
})
