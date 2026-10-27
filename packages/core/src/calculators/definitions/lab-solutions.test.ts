import { c1v1c2v2Calculator, percentSolutionCalculator, molarityPreparationCalculator, reagentDilutionVolumeCalculator } from "./lab-solutions"
import { describe, expect, it } from "vitest"
import { molarityCalculator, normalityCalculator } from "./lab-solutions"

describe("molarityCalculator", () => {
  it("computes molarity for NaCl (0.9% saline analog: 5.85g / 58.44 MW / 1L ≈ 0.1M)", () => {
    const result = molarityCalculator.calculate({ mass: 5.85, molecularWeight: 58.44, volume: 1 })
    expect(result.value).toBeCloseTo(0.1, 2)
  })

  it("scales inversely with volume", () => {
    const oneLiter = molarityCalculator.calculate({ mass: 10, molecularWeight: 100, volume: 1 })
    const twoLiter = molarityCalculator.calculate({ mass: 10, molecularWeight: 100, volume: 2 })
    expect(twoLiter.value as number).toBeCloseTo((oneLiter.value as number) / 2, 4)
  })

  it("throws for zero/negative molecular weight or volume", () => {
    expect(() => molarityCalculator.calculate({ mass: 10, molecularWeight: 0, volume: 1 })).toThrow()
    expect(() => molarityCalculator.calculate({ mass: 10, molecularWeight: 100, volume: 0 })).toThrow()
  })

  it("handles decimal mass values", () => {
    const result = molarityCalculator.calculate({ mass: 2.35, molecularWeight: 58.44, volume: 0.5 })
    expect(Number.isFinite(result.value)).toBe(true)
  })

  it("throws for missing inputs", () => {
    expect(() => molarityCalculator.calculate({ mass: 10, volume: 1 })).toThrow()
  })
})

describe("normalityCalculator", () => {
  it("computes normality", () => {
    const result = normalityCalculator.calculate({ mass: 4.9, equivalentWeight: 49, volume: 1 })
    expect(result.value).toBeCloseTo(0.1, 4)
  })

  it("throws for zero/negative equivalent weight or volume", () => {
    expect(() => normalityCalculator.calculate({ mass: 10, equivalentWeight: 0, volume: 1 })).toThrow()
    expect(() => normalityCalculator.calculate({ mass: 10, equivalentWeight: 50, volume: 0 })).toThrow()
  })
})


describe("laboratory solution preparation calculators", () => {
  it("solves C1V1=C2V2 stock volume", () => {
    expect(c1v1c2v2Calculator.calculate({ solveFor: "v1", c1: 100, v1: "", c2: 10, v2: 100 }).value).toBe(10)
  })
  it("calculates percentage solution amount", () => {
    expect(percentSolutionCalculator.calculate({ type: "wv", percent: 5, finalAmount: 100 }).value).toBe(5)
  })
  it("calculates molar preparation mass", () => {
    expect(molarityPreparationCalculator.calculate({ targetMolarity: 0.1, molecularWeight: 58.44, finalVolume: 1 }).value).toBe(5.844)
  })
  it("calculates stock and solvent volume", () => {
    const result = reagentDilutionVolumeCalculator.calculate({ stockConcentration: 100, targetConcentration: 10, finalVolume: 100 })
    expect(result.value).toBe(10)
    expect(result.secondary?.[0].value).toContain("90")
  })
})
