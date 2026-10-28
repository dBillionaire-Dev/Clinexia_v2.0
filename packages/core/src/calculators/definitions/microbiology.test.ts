import { describe, expect, it } from "vitest"
import { cfuCalculator, dilutionFactorCalculator, concentrationAfterDilutionCalculator, serialDilutionFactorCalculator, concentrationAfterSerialDilutionCalculator, pooledCultureCfuCalculator } from "./microbiology"

describe("cfuCalculator", () => {
  it("computes CFU/mL", () => {
    const result = cfuCalculator.calculate({ colonies: 150, volumePlated: 0.1, dilutionFactor: 1000 })
    expect(result.value).toBe((150 / 0.1) * 1000)
  })

  it("warns when colony count is outside the reliable 30-300 range", () => {
    const tooFew = cfuCalculator.calculate({ colonies: 5, volumePlated: 0.1, dilutionFactor: 1000 })
    const tooMany = cfuCalculator.calculate({ colonies: 400, volumePlated: 0.1, dilutionFactor: 1000 })
    const justRight = cfuCalculator.calculate({ colonies: 150, volumePlated: 0.1, dilutionFactor: 1000 })
    expect(tooFew.warnings?.length).toBeGreaterThan(0)
    expect(tooMany.warnings?.length).toBeGreaterThan(0)
    expect(justRight.warnings).toBeUndefined()
  })

  it("throws for zero volume plated or dilution factor", () => {
    expect(() => cfuCalculator.calculate({ colonies: 150, volumePlated: 0, dilutionFactor: 1000 })).toThrow()
    expect(() => cfuCalculator.calculate({ colonies: 150, volumePlated: 0.1, dilutionFactor: 0 })).toThrow()
  })

  it("throws for negative colony count", () => {
    expect(() => cfuCalculator.calculate({ colonies: -5, volumePlated: 0.1, dilutionFactor: 1000 })).toThrow()
  })

  it("handles zero colonies (valid  -  a legitimate plate result)", () => {
    const result = cfuCalculator.calculate({ colonies: 0, volumePlated: 0.1, dilutionFactor: 1000 })
    expect(result.value).toBe(0)
  })
})

describe("dilutionFactorCalculator", () => {
  it("computes the dilution factor", () => {
    const result = dilutionFactorCalculator.calculate({ aliquotVolume: 1, finalVolume: 10 })
    expect(result.value).toBe(10)
  })

  it("throws for zero aliquot or final volume", () => {
    expect(() => dilutionFactorCalculator.calculate({ aliquotVolume: 0, finalVolume: 10 })).toThrow()
    expect(() => dilutionFactorCalculator.calculate({ aliquotVolume: 1, finalVolume: 0 })).toThrow()
  })

  it("handles decimal volumes", () => {
    const result = dilutionFactorCalculator.calculate({ aliquotVolume: 0.5, finalVolume: 5 })
    expect(result.value).toBe(10)
  })
})

describe("concentrationAfterDilutionCalculator", () => {
  it("computes the resulting concentration", () => {
    const result = concentrationAfterDilutionCalculator.calculate({ initialConcentration: 1000000, dilutionFactor: 10 })
    expect(result.value).toBe(100000)
  })

  it("handles zero initial concentration", () => {
    const result = concentrationAfterDilutionCalculator.calculate({ initialConcentration: 0, dilutionFactor: 10 })
    expect(result.value).toBe(0)
  })

  it("throws for negative initial concentration", () => {
    expect(() => concentrationAfterDilutionCalculator.calculate({ initialConcentration: -5, dilutionFactor: 10 })).toThrow()
  })

  it("throws for zero/negative dilution factor", () => {
    expect(() => concentrationAfterDilutionCalculator.calculate({ initialConcentration: 100, dilutionFactor: 0 })).toThrow()
  })
})


describe("expanded microbiology calculators", () => {
  it("multiplies serial dilution factors", () => expect(serialDilutionFactorCalculator.calculate({ factor1:10, factor2:10, factor3:100 }).value).toBe(10000))
  it("calculates pooled CFU/mL", () => expect(pooledCultureCfuCalculator.calculate({ totalColonies:150, totalVolumeMl:0.3, dilutionFactor:100 }).value).toBe(50000))
  it("calculates concentration after serial dilution", () => expect(concentrationAfterSerialDilutionCalculator.calculate({ initialConcentration:100, dilutionFactor:10 }).value).toBe(10))
})
