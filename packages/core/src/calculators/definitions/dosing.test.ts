import { describe, expect, it } from "vitest"
import { getDosingSafetyWarnings, validateCalculatorInputBounds } from "../dosing-safety"
import {
  mgPerKgDoseCalculator,
  oralLiquidDoseVolumeCalculator,
  tabletCapsuleCountCalculator,
  doseVolumeRoundingCalculator,
  mgPerKgDayCalculator,
  mgPerM2DoseCalculator,
  doseVolumeCalculator,
  drugConcentrationCalculator,
  infusionRateCalculator,
  dropsPerMinuteCalculator,
  maximumDoseCheckCalculator,
  artesunateSevereMalariaCalculator,
  artemetherLumefantrineCalculator,
  artesunateAmodiaquineCalculator,
  artesunateMefloquineCalculator,
  dihydroartemisininPiperaquineCalculator,
  artesunateSulfadoxinePyrimethamineCalculator,
  artesunatePyronaridineCalculator,
  amoxicillinPediatricCalculator,
  amoxicillinClavulanatePediatricCalculator,
  azithromycinPediatricCalculator,
  ceftriaxonePediatricCalculator,
  cephalexinPediatricCalculator,
  metronidazolePediatricCalculator,
  cefuroximeSurgicalProphylaxisCalculator,
  ampicillinPediatricCalculator,
  cefotaximePediatricCalculator,
  cloxacillinPediatricCalculator,
  ciprofloxacinPediatricCalculator,
  gentamicinPediatricCalculator,
  meropenemPediatricCalculator,
  vancomycinPediatricCalculator,
  amoxicillinClavulanateRenalAdjustmentCalculator,
  ciprofloxacinRenalAdjustmentCalculator,
  cefotaximeRenalAdjustmentCalculator,
  cefuroximeAxetilRenalAdjustmentCalculator,
  meropenemRenalAdjustmentCalculator,
  vancomycinAuc24TargetCalculator,
  gentamicinPeakTroughCheckerCalculator,
  whoYoungInfantSepsisPneumoniaCalculator,
  whoYoungInfantMeningitisCalculator,
  piperacillinTazobactamPediatricCalculator,
  clindamycinPediatricCalculator,
  cefazolinPediatricCalculator,
  loadingDoseCalculator,
  maintenanceDoseCalculator,
  infusionDurationCalculator,
  courseTotalDoseCalculator,
  linezolidPediatricCalculator,
  doxycyclinePediatricCalculator,
  whoPediatricPneumoniaRegimenCalculator,
  whoPediatricDiarrhoeaZincCalculator,
  whoPediatricOrsPlanBCalculator,
  whoPediatricOrsOngoingLossCalculator,
  whoPediatricMaintenanceFluidCalculator,
  pediatricFluidDeficitCalculator,
} from "./dosing"

describe("dosing calculators", () => {
  it("calculates mg/kg dose", () => {
    expect(mgPerKgDoseCalculator.calculate({ dosePerKg: 4, weight: 25 }).value).toBe(100)
  })

  it("calculates mg/kg/day and per-dose amount", () => {
    const result = mgPerKgDayCalculator.calculate({ dosePerKgDay: 20, weight: 30, dosesPerDay: 2 })
    expect(result.value).toBe(600)
    expect(result.secondary?.[0].value).toBe("300 mg")
  })

  it("calculates mg/m² dose", () => {
    expect(mgPerM2DoseCalculator.calculate({ dosePerM2: 100, bsa: 1.8 }).value).toBe(180)
  })

  it("calculates dose volume", () => {
    expect(doseVolumeCalculator.calculate({ dose: 250, concentration: 50 }).value).toBe(5)
  })

  it("calculates drug concentration", () => {
    expect(drugConcentrationCalculator.calculate({ drugAmount: 500, finalVolume: 10 }).value).toBe(50)
  })

  it("calculates infusion rate", () => {
    expect(infusionRateCalculator.calculate({ volume: 1000, time: 8 }).value).toBe(125)
  })

  it("calculates rounded gravity drops/min", () => {
    expect(dropsPerMinuteCalculator.calculate({ volume: 500, dropFactor: 20, time: 240 }).value).toBe(42)
  })

  it("caps a supplied maximum dose", () => {
    const result = maximumDoseCheckCalculator.calculate({ calculatedDose: 850, maximumDose: 600 })
    expect(result.value).toBe(600)
    expect(result.secondary?.[0].value).toBe("Yes")
  })

  it("uses WHO weight bands for severe-malaria artesunate dosing", () => {
    expect(artesunateSevereMalariaCalculator.calculate({ weight: 19, route: "iv" }).value).toBe(57)
    expect(artesunateSevereMalariaCalculator.calculate({ weight: 20, route: "iv" }).value).toBe(48)
  })
})


it("uses WHO weight bands for artemether-lumefantrine", () => {
  expect(artemetherLumefantrineCalculator.calculate({ weight: 10 }).value).toBe(1)
  expect(artemetherLumefantrineCalculator.calculate({ weight: 20 }).value).toBe(2)
  expect(artemetherLumefantrineCalculator.calculate({ weight: 30 }).value).toBe(3)
  expect(artemetherLumefantrineCalculator.calculate({ weight: 40 }).value).toBe(4)
  expect(artemetherLumefantrineCalculator.calculate({ weight: 20 }).secondary?.find((x) => x.label === "Total tablets")?.value).toBe("12")
})


it("uses WHO weight bands for artesunate-amodiaquine", () => {
  expect(artesunateAmodiaquineCalculator.calculate({ weight: 6 }).display).toContain("25 mg artesunate + 67.5 mg amodiaquine")
  expect(artesunateAmodiaquineCalculator.calculate({ weight: 10 }).display).toContain("50 mg artesunate + 135 mg amodiaquine")
  expect(artesunateAmodiaquineCalculator.calculate({ weight: 20 }).display).toContain("100 mg artesunate + 270 mg amodiaquine")
  expect(artesunateAmodiaquineCalculator.calculate({ weight: 40 }).display).toContain("200 mg artesunate + 540 mg amodiaquine")
})

it("uses WHO weight bands for artesunate-mefloquine", () => {
  expect(artesunateMefloquineCalculator.calculate({ weight: 7 }).display).toContain("25 mg artesunate + 55 mg mefloquine")
  expect(artesunateMefloquineCalculator.calculate({ weight: 12 }).display).toContain("50 mg artesunate + 110 mg mefloquine")
  expect(artesunateMefloquineCalculator.calculate({ weight: 20 }).display).toContain("100 mg artesunate + 220 mg mefloquine")
  expect(artesunateMefloquineCalculator.calculate({ weight: 35 }).display).toContain("200 mg artesunate + 440 mg mefloquine")
})

it("uses WHO weight bands for dihydroartemisinin-piperaquine", () => {
  expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 7 }).display).toContain("20 mg DHA + 160 mg piperaquine")
  expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 10 }).display).toContain("30 mg DHA + 240 mg piperaquine")
  expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 20 }).display).toContain("60 mg DHA + 480 mg piperaquine")
  expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 70 }).display).toContain("160 mg DHA + 1280 mg piperaquine")
  expect(dihydroartemisininPiperaquineCalculator.calculate({ weight: 85 }).display).toContain("200 mg DHA + 1600 mg piperaquine")
})


it("uses WHO weight bands for artesunate-sulfadoxine-pyrimethamine", () => {
  expect(artesunateSulfadoxinePyrimethamineCalculator.calculate({ weight: 7 }).display).toContain("25 mg artesunate daily + 250/12.5 mg SP")
  expect(artesunateSulfadoxinePyrimethamineCalculator.calculate({ weight: 15 }).display).toContain("50 mg artesunate daily + 500/25 mg SP")
  expect(artesunateSulfadoxinePyrimethamineCalculator.calculate({ weight: 30 }).display).toContain("100 mg artesunate daily + 1000/50 mg SP")
  expect(artesunateSulfadoxinePyrimethamineCalculator.calculate({ weight: 60 }).display).toContain("200 mg artesunate daily + 1500/75 mg SP")
})

it("uses product weight bands for artesunate-pyronaridine", () => {
  expect(artesunatePyronaridineCalculator.calculate({ weight: 6 }).display).toContain("20 mg artesunate + 60 mg pyronaridine tetraphosphate")
  expect(artesunatePyronaridineCalculator.calculate({ weight: 10 }).display).toContain("40 mg artesunate + 120 mg pyronaridine tetraphosphate")
  expect(artesunatePyronaridineCalculator.calculate({ weight: 18 }).display).toContain("60 mg artesunate + 180 mg pyronaridine tetraphosphate")
  expect(artesunatePyronaridineCalculator.calculate({ weight: 22 }).display).toContain("60 mg artesunate + 180 mg pyronaridine tetraphosphate")
  expect(artesunatePyronaridineCalculator.calculate({ weight: 50 }).display).toContain("180 mg artesunate + 540 mg pyronaridine tetraphosphate")
  expect(artesunatePyronaridineCalculator.calculate({ weight: 70 }).display).toContain("240 mg artesunate + 720 mg pyronaridine tetraphosphate")
})

it("calculates WHO reference pediatric amoxicillin dose range", () => {
  const result = amoxicillinPediatricCalculator.calculate({ weight: 20 })
  expect(result.display).toBe("500–1000 mg/day")
  expect(result.secondary?.find((x) => x.label === "Per-dose range")?.value).toBe("166.7–333.3 mg/dose")
})

it("calculates amoxicillin-clavulanate using the amoxicillin component", () => {
  const result = amoxicillinClavulanatePediatricCalculator.calculate({ weight: 10 })
  expect(result.display).toBe("250–500 mg/day amoxicillin component")
})

it("calculates pediatric azithromycin", () => {
  expect(azithromycinPediatricCalculator.calculate({ weight: 15 }).value).toBe(150)
})

it("supports the WHO ceftriaxone meningitis dose", () => {
  expect(ceftriaxonePediatricCalculator.calculate({ weight: 20, indication: "general" }).value).toBe(1000)
  expect(ceftriaxonePediatricCalculator.calculate({ weight: 20, indication: "meningitis" }).value).toBe(2000)
})

it("calculates pediatric cephalexin range", () => {
  expect(cephalexinPediatricCalculator.calculate({ weight: 10 }).display).toBe("500–1000 mg/day")
})

it("calculates pediatric metronidazole range", () => {
  expect(metronidazolePediatricCalculator.calculate({ weight: 10 }).display).toBe("150–300 mg/day")
})


it("calculates the expanded antibiotic reference calculators", () => {
  expect(cefuroximeSurgicalProphylaxisCalculator.calculate({ weight: 20 }).value).toBe(1000)
  expect(ampicillinPediatricCalculator.calculate({ weight: 10, ageGroup: "after-first-week" }).display).toContain("500 mg IV/IM every 8 hours")
  expect(cefotaximePediatricCalculator.calculate({ weight: 10, indication: "meningitis" }).display).toContain("500 mg IV/IM every 6 hours")
  expect(cloxacillinPediatricCalculator.calculate({ weight: 10, ageGroup: "child" }).value).toBe(250)
  expect(ciprofloxacinPediatricCalculator.calculate({ weight: 25 }).value).toBe(300)
  expect(gentamicinPediatricCalculator.calculate({ weight: 20, ageGroup: "child" }).value).toBe(150)
  expect(meropenemPediatricCalculator.calculate({ weight: 20 }).value).toBe(400)
  expect(vancomycinPediatricCalculator.calculate({ weight: 20, ageGroup: "child" }).value).toBe(300)
})


it("applies renal adjustment for amoxicillin/clavulanate", () => {
  expect(amoxicillinClavulanateRenalAdjustmentCalculator.calculate({ gfr: 20, strength: "500", dialysis: "no" }).display).toContain("500 mg amoxicillin component every 12 hours")
  expect(amoxicillinClavulanateRenalAdjustmentCalculator.calculate({ gfr: 20, strength: "875", dialysis: "no" }).value).toBe("not recommended")
  expect(amoxicillinClavulanateRenalAdjustmentCalculator.calculate({ gfr: 5, strength: "250", dialysis: "no" }).display).toContain("every 24 hours")
})

it("applies adult ciprofloxacin renal intervals", () => {
  expect(ciprofloxacinRenalAdjustmentCalculator.calculate({ crcl: 40, dose: "500", dialysis: "no" }).display).toContain("every 12 hours")
  expect(ciprofloxacinRenalAdjustmentCalculator.calculate({ crcl: 20, dose: "500", dialysis: "no" }).display).toContain("every 18 hours")
  expect(ciprofloxacinRenalAdjustmentCalculator.calculate({ crcl: 20, dose: "500", dialysis: "yes" }).display).toContain("every 24 hours")
})

it("halves cefotaxime below the label renal threshold", () => {
  expect(cefotaximeRenalAdjustmentCalculator.calculate({ crcl: 15, usualDose: 2000 }).value).toBe(1000)
  expect(cefotaximeRenalAdjustmentCalculator.calculate({ crcl: 30, usualDose: 2000 }).value).toBe(2000)
})

it("applies cefuroxime axetil renal intervals", () => {
  expect(cefuroximeAxetilRenalAdjustmentCalculator.calculate({ crcl: 40, dose: "500", dialysis: "no" }).display).toContain("every 12 hours")
  expect(cefuroximeAxetilRenalAdjustmentCalculator.calculate({ crcl: 20, dose: "500", dialysis: "no" }).display).toContain("every 24 hours")
  expect(cefuroximeAxetilRenalAdjustmentCalculator.calculate({ crcl: 5, dose: "250", dialysis: "no" }).display).toContain("every 48 hours")
})

it("applies meropenem adult renal dose and interval bands", () => {
  expect(meropenemRenalAdjustmentCalculator.calculate({ crcl: 60, indication: "csssi", dialysis: "no" }).display).toContain("500 mg IV every 8 hours")
  expect(meropenemRenalAdjustmentCalculator.calculate({ crcl: 40, indication: "intra-abdominal", dialysis: "no" }).display).toContain("1000 mg IV every 12 hours")
  expect(meropenemRenalAdjustmentCalculator.calculate({ crcl: 20, indication: "intra-abdominal", dialysis: "no" }).display).toContain("500 mg IV every 12 hours")
  expect(meropenemRenalAdjustmentCalculator.calculate({ crcl: 5, indication: "csssi", dialysis: "no" }).display).toContain("250 mg IV every 24 hours")
  expect(meropenemRenalAdjustmentCalculator.calculate({ crcl: 20, indication: "csssi", dialysis: "yes" }).value).toBe("not established")
})


it("checks vancomycin AUC24 against the consensus target", () => {
  expect(vancomycinAuc24TargetCalculator.calculate({ auc24: 450 }).display).toContain("Within target")
  expect(vancomycinAuc24TargetCalculator.calculate({ auc24: 350 }).display).toContain("Below target")
  expect(vancomycinAuc24TargetCalculator.calculate({ auc24: 650 }).display).toContain("Above target")
})

it("checks conventional gentamicin peak and trough references", () => {
  expect(gentamicinPeakTroughCheckerCalculator.calculate({ population: "adult", peak: 5, trough: 1 }).value).toBe("Within conventional reference")
  expect(gentamicinPeakTroughCheckerCalculator.calculate({ population: "pediatric", peak: 6, trough: 1 }).value).toBe("Review required")
  expect(gentamicinPeakTroughCheckerCalculator.calculate({ population: "adult", peak: 5, trough: 2 }).value).toBe("Review required")
})


it("calculates the WHO 0–59 day sepsis/pneumonia reference regimen", () => {
  const firstWeek = whoYoungInfantSepsisPneumoniaCalculator.calculate({
    weight: 3,
    ageGroup: "first-week",
    syndrome: "sepsis",
  })
  expect(firstWeek.display).toContain("150 mg ampicillin")
  expect(firstWeek.display).toContain("15 mg gentamicin")
  expect(firstWeek.secondary?.find((x) => x.label === "Ampicillin")?.value).toContain("every 12 hours")
  expect(firstWeek.secondary?.find((x) => x.label === "Treatment duration")?.value).toBe("at least 10 days")

  const laterPneumonia = whoYoungInfantSepsisPneumoniaCalculator.calculate({
    weight: 4,
    ageGroup: "after-first-week",
    syndrome: "pneumonia",
  })
  expect(laterPneumonia.display).toContain("200 mg ampicillin")
  expect(laterPneumonia.display).toContain("30 mg gentamicin")
  expect(laterPneumonia.secondary?.find((x) => x.label === "Ampicillin")?.value).toContain("every 8 hours")
  expect(laterPneumonia.secondary?.find((x) => x.label === "Treatment duration")?.value).toBe("at least 7 days")
})

it("calculates WHO 0–59 day meningitis reference options", () => {
  const result = whoYoungInfantMeningitisCalculator.calculate({ weight: 3, ageGroup: "first-week" })
  expect(result.secondary?.find((x) => x.label === "Option 1: Ampicillin")?.value).toContain("150 mg")
  expect(result.secondary?.find((x) => x.label === "Option 2: Cefotaxime")?.value).toContain("150 mg")
  expect(result.secondary?.find((x) => x.label === "Option 3: Ceftriaxone")?.value).toContain("300 mg")
  expect(result.secondary?.find((x) => x.label === "Treatment duration")?.value).toBe("At least 3 weeks")
})


it("converts oral liquid strength from mg/5 mL to a dose volume", () => {
  expect(oralLiquidDoseVolumeCalculator.calculate({ dose: 250, concentration: 125 }).value).toBe(10)
  expect(oralLiquidDoseVolumeCalculator.calculate({ dose: 375, concentration: 250 }).display).toBe("7.5 mL")
})

it("calculates tablet or capsule unit count", () => {
  expect(tabletCapsuleCountCalculator.calculate({ dose: 500, strength: 250 }).value).toBe(2)
  expect(tabletCapsuleCountCalculator.calculate({ dose: 375, strength: 250 }).display).toBe("1.5 tablets/capsules")
})

it("rounds dose volume to the selected measurable increment", () => {
  expect(doseVolumeRoundingCalculator.calculate({ volume: 2.34, increment: "0.1", direction: "nearest" }).value).toBe(2.3)
  expect(doseVolumeRoundingCalculator.calculate({ volume: 2.34, increment: "0.1", direction: "up" }).value).toBe(2.4)
  expect(doseVolumeRoundingCalculator.calculate({ volume: 2.34, increment: "0.1", direction: "down" }).value).toBe(2.3)
})


describe("dosing safety layer", () => {
  it("rejects numeric inputs below the declared minimum", () => {
    expect(() => validateCalculatorInputBounds(mgPerKgDoseCalculator, { dosePerKg: 4, weight: -1 })).toThrow(
      "Patient weight must be at least 0 kg",
    )
  })

  it("flags reduced renal function without changing the calculated result", () => {
    const result = ciprofloxacinRenalAdjustmentCalculator.calculate({ crcl: 20, dose: "500", dialysis: "no" })
    const warnings = getDosingSafetyWarnings(
      ciprofloxacinRenalAdjustmentCalculator,
      { crcl: 20, dose: "500", dialysis: "no" },
      result,
    )
    expect(warnings.some((warning) => warning.includes("Reduced renal function detected"))).toBe(true)
    expect(result.value).toBeDefined()
  })

  it("adds the standard dosing safety review", () => {
    const result = mgPerKgDoseCalculator.calculate({ dosePerKg: 10, weight: 20 })
    const warnings = getDosingSafetyWarnings(mgPerKgDoseCalculator, { dosePerKg: 10, weight: 20 }, result)
    expect(warnings.some((warning) => warning.startsWith("Safety check:"))).toBe(true)
  })
})


it("calculates the Phase 12 pediatric antibiotic references", () => {
  expect(piperacillinTazobactamPediatricCalculator.calculate({ weight: 20 }).value).toBe(2000)
  expect(clindamycinPediatricCalculator.calculate({ weight: 10, ageGroup: "neonate" }).value).toBe(50)
  expect(clindamycinPediatricCalculator.calculate({ weight: 10, ageGroup: "child" }).value).toBe(100)
  expect(cefazolinPediatricCalculator.calculate({ weight: 20 }).value).toBe(500)
})


it("calculates a loading dose and applies an optional maximum", () => {
  expect(loadingDoseCalculator.calculate({ dosePerKg: 20, weight: 70 }).value).toBe(1400)
  expect(loadingDoseCalculator.calculate({ dosePerKg: 20, weight: 70, maxDose: 1000 }).value).toBe(1000)
})

it("converts total daily maintenance dose to individual doses", () => {
  const result = maintenanceDoseCalculator.calculate({ dailyDose: 1200, administrationsPerDay: 3 })
  expect(result.value).toBe(400)
  expect(result.secondary?.[0].value).toContain("8")
})

it("calculates infusion duration", () => {
  expect(infusionDurationCalculator.calculate({ volume: 250, rate: 125 }).value).toBe(2)
})

it("calculates total course dose", () => {
  expect(courseTotalDoseCalculator.calculate({ dose: 500, administrationsPerDay: 2, days: 7 }).value).toBe(7000)
})


it("calculates Phase 17 specialized antibiotic references", () => {
  expect(linezolidPediatricCalculator.calculate({ weight: 12, ageGroup: "child" }).value).toBe(120)
  expect(linezolidPediatricCalculator.calculate({ weight: 12, ageGroup: "neonate-first-week" }).secondary?.find((x) => x.label === "Interval")?.value).toBe("every 12 hours")
  expect(doxycyclinePediatricCalculator.calculate({ weight: 40, day: "day1" }).value).toBe(80)
  expect(doxycyclinePediatricCalculator.calculate({ weight: 80, day: "after-day1" }).value).toBe(100)
})

it("selects the WHO 2024 pediatric pneumonia regimen by presentation", () => {
  const fastBreathing = whoPediatricPneumoniaRegimenCalculator.calculate({
    weight: 12,
    presentation: "fast-breathing",
    fastBreathingDuration: "3-days",
  })
  expect(fastBreathing.value).toBe(480)
  expect(fastBreathing.display).toContain("480 mg oral amoxicillin twice daily for 3 days")
  expect(fastBreathing.secondary?.find((x) => x.label === "Calculated course total")?.value).toBe("2880 mg amoxicillin")

  const chestIndrawing = whoPediatricPneumoniaRegimenCalculator.calculate({
    weight: 12,
    presentation: "chest-indrawing",
    fastBreathingDuration: "3-days",
  })
  expect(chestIndrawing.display).toContain("480 mg oral amoxicillin twice daily for 5 days")
  expect(chestIndrawing.secondary?.find((x) => x.label === "Duration")?.value).toBe("5 days")
})


it("calculates the WHO 2024 pediatric diarrhoea zinc regimen", () => {
  const result = whoPediatricDiarrhoeaZincCalculator.calculate({
    ageYears: 2,
    diarrhoeaType: "acute-watery",
    duration: "10",
  })
  expect(result.value).toBe(5)
  expect(result.display).toContain("5 mg elemental zinc orally once daily for 10 days")
  expect(result.secondary?.find((x) => x.label === "Calculated course total")?.value).toBe("50 mg elemental zinc")

  const persistent = whoPediatricDiarrhoeaZincCalculator.calculate({
    ageYears: 8,
    diarrhoeaType: "persistent",
    duration: "14",
  })
  expect(persistent.secondary?.find((x) => x.label === "Calculated course total")?.value).toBe("70 mg elemental zinc")
})


it("calculates the WHO pediatric ORS Plan B volume", () => {
  const result = whoPediatricOrsPlanBCalculator.calculate({ weight: 12 })
  expect(result.value).toBe(900)
  expect(result.display).toBe("900 mL ORS over 4 hours")
  expect(result.secondary?.find((x) => x.label === "Hourly average")?.value).toBe("225 mL/hour")
  expect(result.secondary?.find((x) => x.label === "Protocol")?.value).toContain("Plan B")
})


it("calculates WHO pediatric maintenance IV fluid using the Holliday-Segar formula", () => {
  expect(whoPediatricMaintenanceFluidCalculator.calculate({ weight: 5 }).value).toBe(20)
  expect(whoPediatricMaintenanceFluidCalculator.calculate({ weight: 15 }).value).toBe(50)
  expect(whoPediatricMaintenanceFluidCalculator.calculate({ weight: 25 }).value).toBe(65)
  expect(whoPediatricMaintenanceFluidCalculator.calculate({ weight: 25 }).secondary?.find((x) => x.label === "24-hour volume")?.value).toBe("1560 mL/day")
})


it("calculates a clinician-entered pediatric fluid deficit", () => {
  const result = pediatricFluidDeficitCalculator.calculate({ weight: 12, dehydrationPercent: 8 })
  expect(result.value).toBe(960)
  expect(result.display).toBe("960 mL estimated fluid deficit")
  expect(result.secondary?.find((x) => x.label === "Estimated deficit")?.value).toBe("0.96 L")
})
