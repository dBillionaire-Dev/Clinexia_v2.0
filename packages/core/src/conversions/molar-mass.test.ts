import { describe, expect, it } from "vitest"
import { mgdLToMmolL, mmolLToMgdL, analytes, getAnalyte } from "./molar-mass"

describe("molar mass conversion  -  round trips", () => {
  for (const analyte of analytes) {
    it(`${analyte.name}: mg/dL -> mmol/L -> mg/dL returns the original value`, () => {
      const originalMgdL = 100
      const mmolL = mgdLToMmolL(originalMgdL, analyte.molecularWeight)
      const roundTrip = mmolLToMgdL(mmolL, analyte.molecularWeight)
      expect(roundTrip).toBeCloseTo(originalMgdL, 6)
    })
  }
})

describe("molar mass conversion  -  known clinical values", () => {
  it("100 mg/dL glucose ≈ 5.55 mmol/L", () => {
    const glucose = getAnalyte("glucose")!
    expect(mgdLToMmolL(100, glucose.molecularWeight)).toBeCloseTo(5.5556, 3)
  })

  it("1 mg/dL creatinine ≈ 88.4 µmol/L (0.0884 mmol/L)", () => {
    const creatinine = getAnalyte("creatinine")!
    expect(mgdLToMmolL(1, creatinine.molecularWeight)).toBeCloseTo(0.0884, 3)
  })

  it("zero mg/dL converts to zero mmol/L", () => {
    const glucose = getAnalyte("glucose")!
    expect(mgdLToMmolL(0, glucose.molecularWeight)).toBe(0)
  })
})

describe("molar mass conversion  -  error handling", () => {
  it("throws for zero or negative molecular weight", () => {
    expect(() => mgdLToMmolL(100, 0)).toThrow()
    expect(() => mgdLToMmolL(100, -10)).toThrow()
    expect(() => mmolLToMgdL(5, 0)).toThrow()
  })

  it("getAnalyte returns undefined for an unknown id", () => {
    expect(getAnalyte("not-a-real-analyte")).toBeUndefined()
  })
})
