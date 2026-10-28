import { describe, expect, it } from "vitest"
import {
  carboplatinCalvertCalculator,
  oncologyBsaDoseCalculator,
  oncologyCumulativeDoseCalculator,
  oncologyDoseCapCalculator,
  oncologyDoseIntensityCalculator,
  oncologyRelativeDoseIntensityCalculator,
  oncologyCycleTotalCalculator,
  oncologyRegimenDoseCalculator,
  oncologyHematologicModificationCalculator,
  oncologyOrganFunctionModificationCalculator,
  oncologyToxicitySafetyCalculator,
  oncologyAntiemeticRiskCalculator,
  oncologyFebrileNeutropeniaRiskCalculator,
  oncologyCycleProgressCalculator,
  oncologyCourseCompletionCalculator,
} from "./oncology"

describe("oncology calculation primitives", () => {
  it("calculates dose intensity", () => {
    expect(oncologyDoseIntensityCalculator.calculate({ cumulativeDose: 600, durationWeeks: 12 }).value).toBe(50)
  })

  it("calculates relative dose intensity", () => {
    expect(oncologyRelativeDoseIntensityCalculator.calculate({ deliveredIntensity: 40, plannedIntensity: 50 }).value).toBe(80)
  })

  it("calculates cumulative dose", () => {
    expect(oncologyCumulativeDoseCalculator.calculate({ dosePerAdministration: 50, administrationsPerCycle: 2, cycles: 6 }).value).toBe(600)
  })

  it("calculates a cycle total", () => {
    expect(oncologyCycleTotalCalculator.calculate({ dosePerAdministration: 100, scheduledAdministrations: 3 }).value).toBe(300)
  })

  it("calculates Calvert carboplatin dose", () => {
    expect(carboplatinCalvertCalculator.calculate({ targetAuc: 5, gfr: 60 }).value).toBe(425)
  })

  it("applies a supplied protocol dose cap", () => {
    const result = oncologyDoseCapCalculator.calculate({ calculatedDose: 650, protocolMaximum: 600 })
    expect(result.value).toBe(600)
    expect(result.display).toContain("capped")
  })

  it("calculates patient-specific breast TC doses from BSA", () => {
    const result = oncologyRegimenDoseCalculator.calculate({ regimenId: "tc-breast-adjuvant", bsa: 1.8, weightKg: "" })
    expect(result.secondary?.find((field) => field.label === "Docetaxel dose")?.value).toBe("135 mg")
    expect(result.secondary?.find((field) => field.label === "Cyclophosphamide dose")?.value).toBe("1080 mg")
  })

  it("calculates protocol AUC-based carboplatin with the Calvert formula", () => {
    const result = oncologyRegimenDoseCalculator.calculate({ regimenId: "tchp-breast-neoadjuvant", bsa: 1.8, weightKg: 75, gfr: 60 })
    expect(result.secondary?.find((field) => field.label === "Carboplatin dose")?.value).toBe("510 mg")
  })

  it("requires GFR for AUC-based carboplatin", () => {
    expect(() => oncologyRegimenDoseCalculator.calculate({ regimenId: "tchp-breast-neoadjuvant", bsa: 1.8, weightKg: 75, gfr: "" })).toThrow(/GFR is required/)
  })

  it("calculates patient-specific R-CHOP doses from BSA", () => {
    const result = oncologyRegimenDoseCalculator.calculate({ regimenId: "r-chop21-dlbcl", bsa: 1.8, weightKg: "" })
    expect(result.display).toContain("R-CHOP21")
    expect(result.secondary?.find((field) => field.label === "Rituximab dose")?.value).toBe("675 mg")
    expect(result.secondary?.find((field) => field.label === "Vincristine dose")?.value).toBe("2 mg")
    expect(result.warnings?.some((warning) => warning.includes("indication"))).toBe(true)
  })

})



describe("oncology haematologic dose-modification calculator", () => {
  it("reports the TAC severe-neutropenia protocol action without changing a dose", () => {
    const result = oncologyHematologicModificationCalculator.calculate({
      regimenId: "tac-breast-cancer",
      anc: 0.3,
      febrileNeutropenia: "no",
    })
    expect(result.display).toContain("1 protocol rule")
    expect(result.secondary?.some((field) => field.value.includes("25%"))).toBe(true)
  })
})


describe("oncology renal/hepatic dose-modification calculator", () => {
  it("matches TAC severe renal guidance", () => {
    const result = oncologyOrganFunctionModificationCalculator.calculate({
      regimenId: "tac-breast-cancer",
      eGfr: 10,
      hepaticDysfunction: "none",
      bilirubin: "",
      astAlt: "",
    })
    expect(result.display).toContain("1 protocol rule")
    expect(result.secondary?.some((field) => field.value.includes("multidisciplinary"))).toBe(true)
  })

  it("matches TCHP mild hepatic guidance", () => {
    const result = oncologyOrganFunctionModificationCalculator.calculate({
      regimenId: "tchp-breast-neoadjuvant",
      eGfr: "",
      hepaticDysfunction: "mild",
      bilirubin: "",
      astAlt: "",
    })
    expect(result.display).toContain("1 protocol rule")
    expect(result.secondary?.some((field) => field.value.includes("Reduce docetaxel by 50%"))).toBe(true)
  })

  it("matches R-CVP hepatic omission threshold", () => {
    const result = oncologyOrganFunctionModificationCalculator.calculate({
      regimenId: "r-cvp-non-hodgkin-lymphoma",
      eGfr: "",
      hepaticDysfunction: "none",
      bilirubin: 60,
      astAlt: 200,
    })
    expect(result.display).toContain("1 protocol rule")
    expect(result.secondary?.some((field) => field.value.includes("Omit vincristine"))).toBe(true)
  })

  it("matches SCLC renal etoposide reduction", () => {
    const result = oncologyOrganFunctionModificationCalculator.calculate({
      regimenId: "sclc-atezolizumab-carboplatin-etoposide",
      eGfr: 25,
      hepaticDysfunction: "none",
      bilirubin: "",
      astAlt: "",
    })
    expect(result.secondary?.some((field) => field.value.includes("Reduce etoposide by 25%"))).toBe(true)
  })
})


describe("oncology toxicity / safety calculator", () => {
  it("matches FOLFIRI grade 3 diarrhoea on first occurrence", () => {
    const result = oncologyToxicitySafetyCalculator.calculate({
      regimenId: "folfiri-colorectal",
      toxicityType: "diarrhoea",
      toxicityGrade: 3,
      occurrence: 1,
      persistentAtNextCycle: "no",
    })
    expect(result.display).toContain("1 toxicity rule")
    expect(result.secondary?.some((field) => field.value.includes("25%"))).toBe(true)
  })

  it("matches TCHP grade 3 neuropathy", () => {
    const result = oncologyToxicitySafetyCalculator.calculate({
      regimenId: "tchp-breast-neoadjuvant",
      toxicityType: "peripheral-neuropathy",
      toxicityGrade: 3,
      occurrence: 1,
      persistentAtNextCycle: "no",
    })
    expect(result.secondary?.some((field) => field.value.includes("Omit docetaxel"))).toBe(true)
  })

  it("does not invent a rule for an unsupported toxicity", () => {
    const result = oncologyToxicitySafetyCalculator.calculate({
      regimenId: "tchp-breast-neoadjuvant",
      toxicityType: "cardiac",
      toxicityGrade: 2,
      occurrence: 1,
      persistentAtNextCycle: "no",
    })
    expect(result.display).toContain("no structured toxicity rule matched")
  })
})


describe("oncology supportive care calculators", () => {
  it("classifies breast AC as high emetogenic risk", () => {
    const result = oncologyAntiemeticRiskCalculator.calculate({ therapy: "breast-ac", carboplatinAuc: "" })
    expect(result.display).toContain("High emetogenic risk")
  })

  it("classifies carboplatin without inventing an AUC-specific prescription", () => {
    const result = oncologyAntiemeticRiskCalculator.calculate({ therapy: "carboplatin", carboplatinAuc: 5 })
    expect(result.display).toContain("Moderate emetogenic risk")
    expect(result.warnings?.some((warning) => warning.includes("thresholds differ"))).toBe(true)
  })

  it("places a 20% FN risk into the high-risk band", () => {
    const result = oncologyFebrileNeutropeniaRiskCalculator.calculate({
      fnRiskPercent: 20,
      patientRiskFactors: "no",
      priorFebrileNeutropenia: "no",
    })
    expect(result.display).toContain("≥20% band")
    expect(result.interpretation).toContain("primary prophylactic G-CSF")
  })

  it("keeps intermediate FN risk dependent on patient factors", () => {
    const result = oncologyFebrileNeutropeniaRiskCalculator.calculate({
      fnRiskPercent: 15,
      patientRiskFactors: "unknown",
      priorFebrileNeutropenia: "unknown",
    })
    expect(result.display).toContain("10–<20% band")
    expect(result.warnings?.some((warning) => warning.includes("not assessed"))).toBe(true)
  })
})



describe("oncology cycle / course calculations", () => {
  it("calculates cycle position and remaining planned cycles", () => {
    const result = oncologyCycleProgressCalculator.calculate({
      currentCycle: 4,
      plannedCycles: 8,
      completedCycles: 3,
      treatmentDay: 1,
    })
    expect(result.display).toContain("Cycle 4, treatment day 1")
    expect(result.display).toContain("5 planned cycles remaining")
    expect(result.secondary?.some((field) => field.value === "37.5%")).toBe(true)
  })

  it("rejects completed cycles above the planned course", () => {
    expect(() => oncologyCycleProgressCalculator.calculate({
      currentCycle: 5,
      plannedCycles: 4,
      completedCycles: 5,
      treatmentDay: "",
    })).toThrow("Completed cycles cannot exceed planned total cycles")
  })

  it("tracks completed and remaining exposure from a documented per-cycle dose", () => {
    const result = oncologyCourseCompletionCalculator.calculate({
      dosePerCycle: 750,
      plannedCycles: 6,
      completedCycles: 2,
    })
    expect(result.display).toContain("1500 mg completed exposure")
    const field = (label: string) => result.secondary?.find((entry) => entry.label === label)?.value
    expect(field("Planned course exposure")).toBe("4500 mg")
    expect(field("Completed exposure")).toBe("1500 mg")
    expect(field("Remaining planned exposure")).toBe("3000 mg")
  })
})


describe("oncology BSA / body-surface-area calculator", () => {
  it("calculates Mosteller BSA and an uncapped protocol dose", () => {
    const result = oncologyBsaDoseCalculator.calculate({
      heightCm: 170,
      weightKg: 70,
      doseMgM2: 100,
      maximumDoseMg: "",
    })
    expect(result.secondary?.some((field) => field.label === "Mosteller BSA" && field.value === "1.82 m²")).toBe(true)
    expect(result.value).toBe(182)
  })

  it("applies a protocol maximum only when explicitly supplied", () => {
    const result = oncologyBsaDoseCalculator.calculate({
      heightCm: 180,
      weightKg: 100,
      doseMgM2: 200,
      maximumDoseMg: 300,
    })
    expect(result.value).toBe(300)
    expect(result.secondary?.some((field) => field.label === "Cap applied" && field.value === "Yes")).toBe(true)
  })
})
