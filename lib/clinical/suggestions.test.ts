// clinexia-upgrade:phase2 tests — suggestion rules.
import { describe, expect, it } from "vitest"
import { getSuggestions } from "./suggestions"

const tool = (id: string) => (id === "ldl-sampson" ? { id, category: "chemistry", name: "Sampson" } : undefined)
const none = () => undefined

describe("Friedewald -> Sampson suggestion", () => {
  it("appears above 400 mg/dL and links to the tool", () => {
    const s = getSuggestions("ldl-friedewald", { unit: "mg/dL", tg: 450 }, tool)
    expect(s).toHaveLength(1)
    expect(s[0].href).toBe("/calculators/chemistry/ldl-sampson")
    expect(s[0].text).toMatch(/direct LDL measurement is preferred/)
  })
  it("does not appear at exactly 400 mg/dL (Friedewald still applies)", () => expect(getSuggestions("ldl-friedewald", { unit: "mg/dL", tg: 400 }, tool)).toEqual([]))
  it("uses 4.5 mmol/L as the limit for mmol/L", () => {
    expect(getSuggestions("ldl-friedewald", { unit: "mmol/L", tg: 4.6 }, tool)).toHaveLength(1)
    expect(getSuggestions("ldl-friedewald", { unit: "mmol/L", tg: 4.5 }, tool)).toEqual([])
  })
  it("never appears when the Sampson tool is not available in this build", () => expect(getSuggestions("ldl-friedewald", { unit: "mg/dL", tg: 600 }, none)).toEqual([]))
  it("ignores missing or non-numeric triglycerides and other tools", () => {
    expect(getSuggestions("ldl-friedewald", { unit: "mg/dL", tg: "" }, tool)).toEqual([])
    expect(getSuggestions("ldl-friedewald", null, tool)).toEqual([])
    expect(getSuggestions("bmi", { tg: 900 }, tool)).toEqual([])
  })
})
