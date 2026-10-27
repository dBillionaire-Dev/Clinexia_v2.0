import { describe, expect, it } from "vitest"
import { ldlCalculator, nonHdlCalculator, vldlCalculator, anionGapCalculator, correctedCalciumCalculator, totalHdlRatioCalculator, calciumPhosphateProductCalculator, ldlHdlRatioCalculator, deltaRatioCalculator, estimatedOsmolalityCalculator, hba1cEagCalculator, correctedSodiumCalculator, correctedBunCalculator, correctedAlbuminAnionGapCalculator, creatinineUnitConversionCalculator } from "./chemistry"

describe("ldlCalculator", () => {
  it("computes LDL via the Friedewald equation (mg/dL)", () => {
    const result = ldlCalculator.calculate({ unit: "mg/dL", tc: 200, hdl: 50, tg: 150 })
    expect(result.value).toBeCloseTo(200 - 50 - 150 / 5, 1)
  })

  it("computes LDL in mmol/L using the 2.2 divisor", () => {
    const result = ldlCalculator.calculate({ unit: "mmol/L", tc: 5.2, hdl: 1.3, tg: 1.7 })
    expect(result.value).toBeCloseTo(5.2 - 1.3 - 1.7 / 2.2, 2)
  })

  it("refuses to calculate when triglycerides are too high", () => {
    const result = ldlCalculator.calculate({ unit: "mg/dL", tc: 200, hdl: 50, tg: 500 })
    expect(result.value).toBe("N/A")
    expect(result.warnings?.length).toBeGreaterThan(0)
  })

  it("warns when the result is negative", () => {
    const result = ldlCalculator.calculate({ unit: "mg/dL", tc: 100, hdl: 90, tg: 100 })
    expect(result.warnings?.length).toBeGreaterThan(0)
  })

  it("throws for missing inputs", () => {
    expect(() => ldlCalculator.calculate({ unit: "mg/dL", tc: 200, hdl: 50 })).toThrow()
  })
})

describe("nonHdlCalculator", () => {
  it("computes non-HDL cholesterol", () => {
    const result = nonHdlCalculator.calculate({ tc: 200, hdl: 50 })
    expect(result.value).toBe(150)
  })

  it("handles zero HDL", () => {
    const result = nonHdlCalculator.calculate({ tc: 200, hdl: 0 })
    expect(result.value).toBe(200)
  })
})

describe("vldlCalculator", () => {
  it("computes VLDL as TG/5", () => {
    const result = vldlCalculator.calculate({ tg: 150 })
    expect(result.value).toBe(30)
  })

  it("warns above 400 mg/dL triglycerides", () => {
    const result = vldlCalculator.calculate({ tg: 450 })
    expect(result.warnings?.length).toBeGreaterThan(0)
  })
})

describe("anionGapCalculator", () => {
  it("computes the anion gap", () => {
    const result = anionGapCalculator.calculate({ na: 140, cl: 104, hco3: 24 })
    expect(result.value).toBe(12)
  })

  it("computes the albumin-corrected anion gap when albumin is provided", () => {
    const result = anionGapCalculator.calculate({ na: 140, cl: 104, hco3: 24, albumin: 2 })
    expect(result.secondary?.length).toBe(1)
    expect(result.secondary?.[0].label).toContain("corrected")
  })

  it("omits the corrected value when albumin is not provided", () => {
    const result = anionGapCalculator.calculate({ na: 140, cl: 104, hco3: 24 })
    expect(result.secondary).toBeUndefined()
  })

  it("throws for missing inputs", () => {
    expect(() => anionGapCalculator.calculate({ na: 140, cl: 104 })).toThrow()
  })
})

describe("correctedCalciumCalculator", () => {
  it("returns the measured value unchanged when albumin is normal (4 g/dL)", () => {
    const result = correctedCalciumCalculator.calculate({ calcium: 9, albumin: 4 })
    expect(result.value).toBe(9)
  })

  it("corrects upward for low albumin", () => {
    const result = correctedCalciumCalculator.calculate({ calcium: 8, albumin: 2 })
    expect(result.value).toBeCloseTo(8 + 0.8 * (4 - 2), 2)
  })

  it("handles decimal inputs", () => {
    const result = correctedCalciumCalculator.calculate({ calcium: 8.7, albumin: 3.1 })
    expect(Number.isFinite(result.value)).toBe(true)
  })

  it("throws for missing inputs", () => {
    expect(() => correctedCalciumCalculator.calculate({ calcium: 9 })).toThrow()
  })
})

describe("totalHdlRatioCalculator", () => {
  it("computes the ratio", () => {
    const result = totalHdlRatioCalculator.calculate({ tc: 200, hdl: 50 })
    expect(result.value).toBe(4)
  })

  it("flags high risk at or above 5:1", () => {
    const result = totalHdlRatioCalculator.calculate({ tc: 200, hdl: 40 })
    expect(result.interpretation).toContain("High risk")
  })

  it("flags desirable below 3.5:1", () => {
    const result = totalHdlRatioCalculator.calculate({ tc: 150, hdl: 60 })
    expect(result.interpretation).toContain("Desirable")
  })

  it("throws for zero/negative HDL", () => {
    expect(() => totalHdlRatioCalculator.calculate({ tc: 200, hdl: 0 })).toThrow()
    expect(() => totalHdlRatioCalculator.calculate({ tc: 200, hdl: -5 })).toThrow()
  })
})

describe("calciumPhosphateProductCalculator", () => {
  it("computes the product", () => {
    const result = calciumPhosphateProductCalculator.calculate({ calcium: 9, phosphate: 4 })
    expect(result.value).toBe(36)
  })

  it("warns above the 55 threshold", () => {
    const result = calciumPhosphateProductCalculator.calculate({ calcium: 10, phosphate: 6 })
    expect(result.warnings?.length).toBeGreaterThan(0)
  })

  it("does not warn below the threshold", () => {
    const result = calciumPhosphateProductCalculator.calculate({ calcium: 9, phosphate: 4 })
    expect(result.warnings).toBeUndefined()
  })

  it("handles zero values", () => {
    const result = calciumPhosphateProductCalculator.calculate({ calcium: 0, phosphate: 4 })
    expect(result.value).toBe(0)
  })
})

describe("ldlHdlRatioCalculator", () => {
  it("computes the ratio", () => {
    const result = ldlHdlRatioCalculator.calculate({ ldl: 100, hdl: 50 })
    expect(result.value).toBe(2)
  })

  it("flags high risk at or above 4:1", () => {
    const result = ldlHdlRatioCalculator.calculate({ ldl: 200, hdl: 40 })
    expect(result.interpretation).toContain("High risk")
  })

  it("throws for zero/negative HDL", () => {
    expect(() => ldlHdlRatioCalculator.calculate({ ldl: 100, hdl: 0 })).toThrow()
    expect(() => ldlHdlRatioCalculator.calculate({ ldl: 100, hdl: -5 })).toThrow()
  })

  it("throws for negative LDL", () => {
    expect(() => ldlHdlRatioCalculator.calculate({ ldl: -10, hdl: 50 })).toThrow()
  })
})

describe("deltaRatioCalculator", () => {
  it("computes AG, delta gap, and delta ratio", () => {
    const result = deltaRatioCalculator.calculate({ na: 140, cl: 100, hco3: 12 })
    const ag = 140 - (100 + 12)
    const deltaGap = ag - 12
    const deltaRatio = deltaGap / (24 - 12)
    expect(result.value).toBeCloseTo(deltaRatio, 2)
    expect(result.secondary?.[0].label).toBe("Anion gap")
  })

  it("classifies a low delta ratio as hyperchloremic", () => {
    const result = deltaRatioCalculator.calculate({ na: 140, cl: 110, hco3: 20 })
    expect(result.interpretation).toContain("hyperchloremic")
  })

  it("throws when HCO3 is exactly 24 (delta HCO3 is zero)", () => {
    expect(() => deltaRatioCalculator.calculate({ na: 140, cl: 100, hco3: 24 })).toThrow()
  })
})

describe("estimatedOsmolalityCalculator", () => {
  it("computes calculated osmolality", () => {
    const result = estimatedOsmolalityCalculator.calculate({ na: 140, glucose: 90, bun: 14 })
    expect(result.value).toBeCloseTo(2 * 140 + 90 / 18 + 14 / 2.8, 1)
  })

  it("computes the osmolar gap when measured osmolality is provided", () => {
    const result = estimatedOsmolalityCalculator.calculate({ na: 140, glucose: 90, bun: 14, measuredOsmolality: 310 })
    expect(result.secondary?.length).toBe(1)
    expect(result.secondary?.[0].label).toBe("Osmolar gap")
  })

  it("omits the gap when measured osmolality is not provided", () => {
    const result = estimatedOsmolalityCalculator.calculate({ na: 140, glucose: 90, bun: 14 })
    expect(result.secondary).toBeUndefined()
  })

  it("warns when the osmolar gap is large", () => {
    const result = estimatedOsmolalityCalculator.calculate({ na: 140, glucose: 90, bun: 14, measuredOsmolality: 330 })
    expect(result.warnings?.length).toBeGreaterThan(0)
  })

  it("throws for zero/negative sodium", () => {
    expect(() => estimatedOsmolalityCalculator.calculate({ na: 0, glucose: 90, bun: 14 })).toThrow()
  })
})

describe("hba1cEagCalculator", () => {
  it("converts HbA1c to eAG", () => {
    const result = hba1cEagCalculator.calculate({ direction: "hba1c-to-eag", value: 7 })
    expect(result.value).toBeCloseTo(28.7 * 7 - 46.7, 0)
  })

  it("converts eAG to HbA1c", () => {
    const result = hba1cEagCalculator.calculate({ direction: "eag-to-hba1c", value: 154.2 })
    expect(result.value).toBeCloseTo(7, 1)
  })

  it("round-trips approximately", () => {
    const eag = hba1cEagCalculator.calculate({ direction: "hba1c-to-eag", value: 8 })
    const back = hba1cEagCalculator.calculate({ direction: "eag-to-hba1c", value: eag.value as number })
    expect(back.value as number).toBeCloseTo(8, 0)
  })

  it("throws for zero/negative value", () => {
    expect(() => hba1cEagCalculator.calculate({ direction: "hba1c-to-eag", value: 0 })).toThrow()
  })
})


describe("expanded chemistry calculators", () => {
  it("corrects sodium for hyperglycemia", () => expect(correctedSodiumCalculator.calculate({ sodium: 130, glucose: 300, factor: 1.6 }).value).toBe(133.2))
  it("converts urea to BUN", () => expect(correctedBunCalculator.calculate({ direction:"urea-to-bun", value:10 }).value).toBe(28))
  it("calculates albumin-corrected anion gap", () => expect(correctedAlbuminAnionGapCalculator.calculate({ sodium:140, chloride:100, bicarbonate:20, albumin:2 }).value).toBe(25))
  it("converts creatinine units", () => expect(creatinineUnitConversionCalculator.calculate({ direction:"mgdl-to-umol", value:1 }).value).toBe(88.4))
})
