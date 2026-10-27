import { describe, expect, it } from "vitest"
import { treatmentRegimens } from "./treatment-regimens"
import {
  assessDoseModifications,
  assessHematologicDoseModifications,
  assessToxicityDoseModifications,
  calculateTreatmentRegimenDoses,
  getTreatmentRegimenById,
  getTreatmentRegimensBySpecialty,
  searchTreatmentRegimens,
  validateTreatmentRegimen,
  validateTreatmentRegistry,
  type TreatmentRegimen,
} from "./treatment-engine"

const sampleRegimen: TreatmentRegimen = {
  id: "example-reference-regimen",
  name: "Example Reference Regimen",
  specialty: "oncology",
  disease: "Example disease",
  indication: "Example protocol indication",
  population: "adult",
  drugs: [
    {
      id: "example-drug",
      drug: "Example drug",
      doseBasis: "mg/m2",
      dose: 100,
      doseUnit: "mg/m²",
      route: "IV",
      schedule: "Day 1",
    },
  ],
  references: [
    {
      source: "Example protocol source",
      version: "2026",
      lastVerified: "2026-09-15",
      status: "current",
    },
  ],
  status: "reference-only",
}

describe("treatment engine", () => {
  it("validates the treatment registry structure", () => {
    expect(validateTreatmentRegistry([sampleRegimen])).toEqual([])
  })

  it("rejects a regimen without references", () => {
    const invalid = { ...sampleRegimen, references: [] }
    expect(validateTreatmentRegimen(invalid)).toContain("At least one protocol/reference is required.")
  })

  it("looks up a regimen by id", () => {
    expect(getTreatmentRegimenById([sampleRegimen], sampleRegimen.id)?.name).toBe(sampleRegimen.name)
  })

  it("filters by specialty", () => {
    expect(getTreatmentRegimensBySpecialty([sampleRegimen], "oncology")).toHaveLength(1)
    expect(getTreatmentRegimensBySpecialty([sampleRegimen], "cardiovascular")).toHaveLength(0)
  })

  it("searches regimen name, disease and drug names", () => {
    expect(searchTreatmentRegimens([sampleRegimen], "example drug")).toHaveLength(1)
    expect(searchTreatmentRegimens([sampleRegimen], "oncology", { specialty: "oncology" })).toHaveLength(1)
    expect(searchTreatmentRegimens([sampleRegimen], "oncology", { specialty: "hematology" })).toHaveLength(0)
  })

  it("calculates BSA-based regimen doses and applies an explicit cap", () => {
    const regimen = treatmentRegimens.find((item) => item.id === "r-chop21-dlbcl")
    expect(regimen).toBeDefined()

    const doses = calculateTreatmentRegimenDoses(regimen!, { bsa: 1.8 })
    expect(doses.find((dose) => dose.drug === "Rituximab")?.dose).toBe(675)
    expect(doses.find((dose) => dose.drug === "Cyclophosphamide")?.dose).toBe(1350)
    expect(doses.find((dose) => dose.drug === "Doxorubicin")?.dose).toBe(90)
    expect(doses.find((dose) => dose.drug === "Vincristine")?.dose).toBe(2)
    expect(doses.find((dose) => dose.drug === "Vincristine")?.capped).toBe(true)
    expect(doses.find((dose) => dose.drug === "Prednisolone")?.dose).toBe(100)
  })

  it("matches structured TAC haematological rules without changing doses", () => {
    const regimen = treatmentRegimens.find((item) => item.id === "tac-breast-cancer")
    expect(regimen).toBeDefined()

    const severe = assessHematologicDoseModifications(regimen!, { anc: 0.3 })
    expect(severe).toHaveLength(1)
    expect(severe[0].action).toContain("25%")
    expect(severe[0].appliesTo).toEqual(["docetaxel", "doxorubicin", "cyclophosphamide"])

    const platelets = assessHematologicDoseModifications(regimen!, { platelets: 40 })
    expect(platelets).toHaveLength(1)
    expect(platelets[0].action).toContain("25%")
  })

  it("matches febrile neutropenia separately for TCHP", () => {
    const regimen = treatmentRegimens.find((item) => item.id === "tchp-breast-neoadjuvant")
    expect(regimen).toBeDefined()
    const matches = assessHematologicDoseModifications(regimen!, { febrileNeutropenia: true })
    expect(matches).toHaveLength(1)
    expect(matches[0].appliesTo).toEqual(["docetaxel", "carboplatin"])
  })

  it("calculates the selected colorectal regimens without inventing schedule data", () => {
    const regimen = treatmentRegimens.find((item) => item.id === "mfolfox6-colorectal")
    const doses = calculateTreatmentRegimenDoses(regimen!, { bsa: 1.8 })
    expect(doses.find((dose) => dose.drug === "Oxaliplatin")?.dose).toBe(153)
    expect(doses.find((dose) => dose.drug === "5-Fluorouracil (bolus)")?.frequency).toBe("Day 1")
    expect(doses.find((dose) => dose.drug === "5-Fluorouracil (infusion)")?.dose).toBe(4320)
  })
})

import { treatmentRegistryErrors, getTreatmentRegimen, searchTreatments } from "./treatment-regimens"

describe("oncology regimen registry", () => {
  it("contains only structurally valid treatment references", () => {
    expect(treatmentRegistryErrors).toEqual([])
  })

  it("includes the initial oncology regimen set", () => {
    expect(getTreatmentRegimen("r-chop21-dlbcl")?.name).toContain("R-CHOP21")
    expect(getTreatmentRegimen("abvd-hodgkin-lymphoma")?.disease).toBe("Hodgkin lymphoma")
    expect(getTreatmentRegimen("mfolfox6-colorectal")?.cycleLength).toBe("14 days")
    expect(getTreatmentRegimen("folfiri-colorectal")?.cycleLength).toBe("14 days")
    expect(getTreatmentRegimen("ac-breast-cancer")?.disease).toBe("Breast cancer")
  })

  it("supports oncology search without mixing specialties", () => {
    expect(searchTreatments("colorectal", { specialty: "oncology" }).length).toBeGreaterThanOrEqual(2)
    expect(treatmentRegimens.every((regimen) => regimen.specialty === "oncology")).toBe(true)
  })
})


describe("organ-function dose-modification criteria", () => {
  it("supports renal threshold matching", () => {
    const regimen = treatmentRegimens.find((item) => item.id === "tchp-breast-neoadjuvant")
    expect(regimen).toBeDefined()
    const matches = assessDoseModifications(regimen!, { eGfr: 20 })
    expect(matches.some((item) => item.ruleId === "tchp-renal-15-29")).toBe(true)
  })

  it("supports hepatic all-of criteria", () => {
    const regimen = treatmentRegimens.find((item) => item.id === "r-cvp-non-hodgkin-lymphoma")
    expect(regimen).toBeDefined()
    const matches = assessDoseModifications(regimen!, { bilirubin: 60, astAlt: 200 })
    expect(matches).toHaveLength(1)
    expect(matches[0].ruleId).toBe("rcvp-hepatic-vincristine-omit")
  })
})


describe("toxicity dose-modification criteria", () => {
  it("matches FOLFIRI grade 3 diarrhoea on first occurrence", () => {
    const regimen = treatmentRegimens.find((item) => item.id === "folfiri-colorectal")
    expect(regimen).toBeDefined()
    const matches = assessToxicityDoseModifications(regimen!, { toxicityType: "diarrhoea", toxicityGrade: 3, occurrence: 1 })
    expect(matches).toHaveLength(1)
    expect(matches[0].action).toContain("25%")
  })

  it("matches TCHP grade 3 neuropathy", () => {
    const regimen = treatmentRegimens.find((item) => item.id === "tchp-breast-neoadjuvant")
    expect(regimen).toBeDefined()
    const matches = assessToxicityDoseModifications(regimen!, { toxicityType: "peripheral-neuropathy", toxicityGrade: 3 })
    expect(matches).toHaveLength(1)
    expect(matches[0].action).toContain("Omit docetaxel")
  })
})
