import { describe, expect, it } from "vitest"
import { hctCiCalculator, conditioningDayCalculator, stemCellCollectionYieldCalculator, cd34CellDoseCalculator, neutrophilEngraftmentDayCalculator, donorChimerismCalculator, collectionTargetCalculator, viableCd34CellDoseCalculator, engraftmentDurationCalculator } from "./stem-cell-transplant"

describe("stem-cell and transplant calculators", () => {
  it("calculates HCT-CI", () => expect(hctCiCalculator.calculate({age40:"yes",arrhythmia:"yes",cardiac:"no",ibd:"no",diabetes:"no",cerebrovascular:"no",psychiatric:"no",mildLiver:"no",obesity:"yes",infection:"no",moderatePulmonary:"no",rheumatologic:"no",pepticUlcer:"no",renal:"no",priorTumor:"no",heartValve:"no",severePulmonary:"no",severeLiver:"no"}).value).toBe(3))
  it("labels conditioning day", () => expect(conditioningDayCalculator.calculate({day:-3}).secondary?.[0].value).toContain("Pre-transplant"))
  it("calculates collection yield", () => expect(stemCellCollectionYieldCalculator.calculate({cd34PerUl:500,volumeMl:200,weightKg:70}).value).toBe(1.43))
  it("calculates CD34 dose", () => expect(cd34CellDoseCalculator.calculate({totalCd34:350,weightKg:70}).value).toBe(5))
  it("calculates engraftment timing", () => expect(neutrophilEngraftmentDayCalculator.calculate({engraftmentDay:14}).value).toBe(14))
  it("calculates donor chimerism", () => expect(donorChimerismCalculator.calculate({donorSignal:95,totalSignal:100}).value).toBe(95))
})


describe("expanded stem-cell calculators", () => {
  it("calculates collection target", () => expect(collectionTargetCalculator.calculate({ targetDose: 2, weightKg: 70 }).value).toBe(140))
  it("calculates viable CD34 dose", () => expect(viableCd34CellDoseCalculator.calculate({ totalCd34: 300, viability: 80, weightKg: 60 }).value).toBe(4))
  it("calculates engraftment duration", () => expect(engraftmentDurationCalculator.calculate({ transplantDay: 0, engraftmentDay: 14 }).value).toBe(14))
})
