import { describe, expect, it } from "vitest"
import { beerLambertCalculator, absorbanceTransmittanceCalculator, spectrophotometryStandardCurveCalculator, dilutionCorrectedSpectroConcentrationCalculator } from "./spectrophotometry"

describe("Beer-Lambert calculator", () => {
  it("calculates absorbance", () => {
    const result = beerLambertCalculator.calculate({ solveFor: "absorbance", epsilon: 100, pathLength: 1, concentration: 0.01, absorbance: "" })
    expect(result.value).toBe(1)
  })
})

describe("spectrophotometry expansion", () => {
  it("converts absorbance to percent transmittance", () => {
    expect(absorbanceTransmittanceCalculator.calculate({ solveFor: "transmittance", absorbance: 0.301, percentTransmittance: 50 }).value).toBeCloseTo(50, 1)
  })
  it("calculates a two-point standard curve", () => {
    const result = spectrophotometryStandardCurveCalculator.calculate({ standard1Concentration: 0, standard1Absorbance: 0, standard2Concentration: 10, standard2Absorbance: 1, unknownAbsorbance: 0.5 })
    expect(result.value).toBe(5)
  })
  it("applies a documented dilution factor", () => {
    const result = dilutionCorrectedSpectroConcentrationCalculator.calculate({ absorbance: 0.5, slope: 0.1, intercept: 0, dilutionFactor: 10 })
    expect(result.value).toBe(50)
  })
})

describe("spectrophotometry extended tools", () => {
  it("converts wavelength to frequency", async () => {
    const { wavelengthFrequencyCalculator } = await import("./spectrophotometry")
    expect(wavelengthFrequencyCalculator.calculate({ solveFor: "frequency", wavelengthNm: 500, frequencyHz: 1 }).value).toBeCloseTo(5.99584916e14, -5)
  })
  it("calculates photon energy", async () => {
    const { photonEnergyCalculator } = await import("./spectrophotometry")
    expect(Number(photonEnergyCalculator.calculate({ wavelengthNm: 500 }).value)).toBeCloseTo(3.972891714e-19, 15)
  })
  it("converts wavelength to wavenumber", async () => {
    const { wavenumberCalculator } = await import("./spectrophotometry")
    expect(wavenumberCalculator.calculate({ solveFor: "wavenumber", wavelengthNm: 500, wavenumberCm1: 1 }).value).toBe(20000)
  })
  it("blank-corrects absorbance", async () => {
    const { blankCorrectedAbsorbanceCalculator } = await import("./spectrophotometry")
    expect(blankCorrectedAbsorbanceCalculator.calculate({ sampleAbsorbance: 0.65, blankAbsorbance: 0.05 }).value).toBe(0.6)
  })
  it("calculates replicate statistics", async () => {
    const { replicateStatisticsCalculator } = await import("./spectrophotometry")
    const result = replicateStatisticsCalculator.calculate({ reading1: 0.5, reading2: 0.5, reading3: 0.5 })
    expect(result.value).toBe(0.5)
    expect(result.secondary?.find(x => x.label === "CV")?.value).toBe("0%")
  })
  it("performs five-point regression", async () => {
    const { calibrationRegressionCalculator } = await import("./spectrophotometry")
    const result = calibrationRegressionCalculator.calculate({ x1: 0, y1: 0, x2: 2, y2: 0.2, x3: 4, y3: 0.4, x4: 6, y4: 0.6, x5: 8, y5: 0.8, unknownAbsorbance: 0.5 })
    expect(result.value).toBe(5)
    expect(result.secondary?.find(x => x.label === "R²")?.value).toBe("1")
  })
})
