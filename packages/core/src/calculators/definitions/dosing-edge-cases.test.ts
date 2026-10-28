import { describe, expect, it } from "vitest"
import { getCalculatorReferences } from "../dosing-references"
import { validateCalculatorInputBounds } from "../dosing-safety"
import { calculators } from "../registry"
import {
  artemetherLumefantrineCalculator,
  artesunateAmodiaquineCalculator,
  artesunateMefloquineCalculator,
  dihydroartemisininPiperaquineCalculator,
  artesunateSulfadoxinePyrimethamineCalculator,
  artesunatePyronaridineCalculator,
  ciprofloxacinPediatricCalculator,
  ceftriaxonePediatricCalculator,
  cefotaximeRenalAdjustmentCalculator,
  cefuroximeAxetilRenalAdjustmentCalculator,
  meropenemRenalAdjustmentCalculator,
  vancomycinAuc24TargetCalculator,
  oralLiquidDoseVolumeCalculator,
  tabletCapsuleCountCalculator,
  doseVolumeRoundingCalculator,
  loadingDoseCalculator,
} from "./dosing"

describe("dosing boundary and regression coverage", () => {
  it("preserves exact artemether-lumefantrine weight-band boundaries", () => {
    expect(artemetherLumefantrineCalculator.calculate({ weight: 5 }).value).toBe(1)
    expect(artemetherLumefantrineCalculator.calculate({ weight: 15 }).value).toBe(2)
    expect(artemetherLumefantrineCalculator.calculate({ weight: 25 }).value).toBe(3)
    expect(artemetherLumefantrineCalculator.calculate({ weight: 35 }).value).toBe(4)
  })

  it("preserves artesunate-amodiaquine band transitions", () => {
    expect(artesunateAmodiaquineCalculator.calculate({ weight: 4.5 }).display).toContain("25 mg artesunate")
    expect(artesunateAmodiaquineCalculator.calculate({ weight: 9 }).display).toContain("50 mg artesunate")
    expect(artesunateAmodiaquineCalculator.calculate({ weight: 18 }).display).toContain("100 mg artesunate")
    expect(artesunateAmodiaquineCalculator.calculate({ weight: 36 }).display).toContain("200 mg artesunate")
  })

  it("preserves artesunate-mefloquine band transitions", () => {
    expect(artesunateMefloquineCalculator.calculate({ weight: 5 }).display).toContain("25 mg artesunate")
    expect(artesunateMefloquineCalculator.calculate({ weight: 9 }).display).toContain("50 mg artesunate")
    expect(artesunateMefloquineCalculator.calculate({ weight: 18 }).display).toContain("100 mg artesunate")
    expect(artesunateMefloquineCalculator.calculate({ weight: 30 }).display).toContain("200 mg artesunate")
  })

  it("preserves DHA-piperaquine transitions", () => {
    expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 8 }).display).toContain("30 mg DHA")
    expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 11 }).display).toContain("40 mg DHA")
    expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 17 }).display).toContain("60 mg DHA")
    expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 25 }).display).toContain("80 mg DHA")
    expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 36 }).display).toContain("120 mg DHA")
    expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 60 }).display).toContain("160 mg DHA")
    expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 80 }).display).toContain("200 mg DHA")
  })

  it("preserves sulfadoxine-pyrimethamine and pyronaridine boundaries", () => {
    expect(artesunateSulfadoxinePyrimethamineCalculator.calculate({ weight: 10 }).display).toContain("50 mg artesunate")
    expect(artesunateSulfadoxinePyrimethamineCalculator.calculate({ weight: 25 }).display).toContain("100 mg artesunate")
    expect(artesunateSulfadoxinePyrimethamineCalculator.calculate({ weight: 50 }).display).toContain("200 mg artesunate")

    expect(artesunatePyronaridineCalculator.calculate({ weight: 8 }).display).toContain("40 mg artesunate")
    expect(artesunatePyronaridineCalculator.calculate({ weight: 15 }).display).toContain("60 mg artesunate")
    expect(artesunatePyronaridineCalculator.calculate({ weight: 20 }).display).toContain("60 mg artesunate")
    expect(artesunatePyronaridineCalculator.calculate({ weight: 24 }).display).toContain("120 mg artesunate")
    expect(artesunatePyronaridineCalculator.calculate({ weight: 45 }).display).toContain("180 mg artesunate")
    expect(artesunatePyronaridineCalculator.calculate({ weight: 65 }).display).toContain("240 mg artesunate")
  })

  it("preserves pediatric ciprofloxacin weight-band boundaries", () => {
    expect(ciprofloxacinPediatricCalculator.calculate({ weight: 3 }).value).toBe(50)
    expect(ciprofloxacinPediatricCalculator.calculate({ weight: 6 }).value).toBe(100)
    expect(ciprofloxacinPediatricCalculator.calculate({ weight: 10 }).value).toBe(150)
    expect(ciprofloxacinPediatricCalculator.calculate({ weight: 15 }).value).toBe(200)
    expect(ciprofloxacinPediatricCalculator.calculate({ weight: 20 }).value).toBe(300)
    expect(ciprofloxacinPediatricCalculator.calculate({ weight: 30 }).value).toBe(500)
  })

  it("keeps ceftriaxone indication-specific dosing separate", () => {
    expect(ceftriaxonePediatricCalculator.calculate({ weight: 10, indication: "general" }).value).toBe(500)
    expect(ceftriaxonePediatricCalculator.calculate({ weight: 10, indication: "meningitis" }).value).toBe(1000)
  })

  it("preserves exact renal threshold behavior", () => {
    expect(cefotaximeRenalAdjustmentCalculator.calculate({ crcl: 20, usualDose: 2000 }).value).toBe(2000)
    expect(cefotaximeRenalAdjustmentCalculator.calculate({ crcl: 19.9, usualDose: 2000 }).value).toBe(1000)

    expect(cefuroximeAxetilRenalAdjustmentCalculator.calculate({ crcl: 30, dose: "500", dialysis: "no" }).display).toContain("every 12 hours")
    expect(cefuroximeAxetilRenalAdjustmentCalculator.calculate({ crcl: 29.9, dose: "500", dialysis: "no" }).display).toContain("every 24 hours")

    expect(meropenemRenalAdjustmentCalculator.calculate({ crcl: 50, indication: "csssi", dialysis: "no" }).display).toContain("every 12 hours")
    expect(meropenemRenalAdjustmentCalculator.calculate({ crcl: 50.1, indication: "csssi", dialysis: "no" }).display).toContain("every 8 hours")
  })

  it("keeps vancomycin AUC endpoints inside the target", () => {
    expect(vancomycinAuc24TargetCalculator.calculate({ auc24: 400 }).display).toContain("Within target")
    expect(vancomycinAuc24TargetCalculator.calculate({ auc24: 600 }).display).toContain("Within target")
    expect(vancomycinAuc24TargetCalculator.calculate({ auc24: 399.9 }).display).toContain("Below target")
    expect(vancomycinAuc24TargetCalculator.calculate({ auc24: 600.1 }).display).toContain("Above target")
  })

  it("does not silently change formulation calculations", () => {
    expect(oralLiquidDoseVolumeCalculator.calculate({ dose: 250, concentration: 125 }).value).toBe(10)
    expect(tabletCapsuleCountCalculator.calculate({ dose: 375, strength: 250 }).value).toBe(1.5)
    expect(doseVolumeRoundingCalculator.calculate({ volume: 2.25, increment: "0.1", direction: "nearest" }).value).toBe(2.3)
  })

  it("does not cap a loading dose unless a maximum is explicitly supplied", () => {
    expect(loadingDoseCalculator.calculate({ dosePerKg: 20, weight: 70 }).value).toBe(1400)
    expect(loadingDoseCalculator.calculate({ dosePerKg: 20, weight: 70, maxDose: 1000 }).value).toBe(1000)
  })
})

describe("dosing registry and source coverage", () => {
  const dosingCalculators = calculators.filter((calculator) => calculator.category === "dosing")

  it("has unique calculator IDs", () => {
    const ids = calculators.map((calculator) => calculator.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("gives every dosing calculator a usable definition", () => {
    for (const calculator of dosingCalculators) {
      expect(calculator.id).toBeTruthy()
      expect(calculator.name).toBeTruthy()
      expect(calculator.description).toBeTruthy()
      expect(calculator.inputs.length).toBeGreaterThan(0)
      expect(typeof calculator.calculate).toBe("function")
    }
  })

  it("provides a reference record for every dosing calculator", () => {
    for (const calculator of dosingCalculators) {
      const references = getCalculatorReferences(calculator)
      expect(references.length).toBeGreaterThan(0)
      expect(references[0].source).toBeTruthy()
      expect(references[0].version).toBeTruthy()
      expect(references[0].lastVerified).toMatch(/^2026-/)
    }
  })

  it("keeps numeric input bounds internally coherent", () => {
    for (const calculator of dosingCalculators) {
      for (const input of calculator.inputs) {
        if (input.kind !== "number") continue
        if (input.min !== undefined && input.max !== undefined) {
          expect(input.min).toBeLessThanOrEqual(input.max)
        }
      }
    }
  })

  it("rejects clearly invalid numeric input through the shared safety validator", () => {
    const calculator = dosingCalculators.find((item) => item.id === "mg-per-kg-dose")
    if (!calculator) throw new Error("mg-per-kg-dose calculator not registered")

    expect(() =>
      validateCalculatorInputBounds(calculator, { dosePerKg: 5, weight: -1 }),
    ).toThrow()
  })
})
