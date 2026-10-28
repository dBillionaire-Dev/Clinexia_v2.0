import { describe, expect, it } from "vitest"
import { calculatorCatalog, calculators, getCalculatorsByCategoryAndSubcategory } from "./registry"
import { CALCULATOR_CATEGORY_LABELS, CALCULATOR_SUBCATEGORY_LABELS } from "./types"

describe("calculator taxonomy", () => {
  it("exposes all top-level clinical domains", () => {
    expect(Object.keys(CALCULATOR_CATEGORY_LABELS)).toEqual([
      "general",
      "renal",
      "chemistry",
      "hematology",
      "microbiology",
      "lab-solutions",
      "spectrophotometry",
      "dosing",
      "oncology",
      "cardiovascular",
      "stem-cell-transplant",
    ])
    expect(calculatorCatalog).toHaveLength(11)
  })

  it("exposes the requested second-level clinical sections", () => {
    expect(Object.keys(CALCULATOR_SUBCATEGORY_LABELS.dosing)).toEqual([
      "general-dosing",
      "antimalarial",
      "antibiotic",
      "renal-adjustment",
      "therapeutic-drug-monitoring",
    ])
    expect(Object.keys(CALCULATOR_SUBCATEGORY_LABELS.oncology)).toEqual([
      "body-surface-area",
      "chemotherapy-dosing",
      "dose-modifications",
      "cycle-course-calculations",
      "supportive-care",
      "toxicity-safety-checks",
    ])
    expect(Object.keys(CALCULATOR_SUBCATEGORY_LABELS.hematology)).toEqual([
      "anemia",
      "coagulation",
      "transfusion",
      "blood-products",
      "hematologic-malignancy",
    ])
    expect(Object.keys(CALCULATOR_SUBCATEGORY_LABELS.cardiovascular)).toEqual([
      "hypertension",
      "heart-failure",
      "anticoagulation",
      "antiplatelet",
      "arrhythmia",
      "risk-prevention",
    ])
    expect(Object.keys(CALCULATOR_SUBCATEGORY_LABELS["stem-cell-transplant"])).toEqual([
      "hct",
      "conditioning",
      "stem-cell-collection",
      "cell-dose",
      "engraftment",
      "transplant-support",
    ])
  })

  it("places existing oncology and dosing calculators into explicit sections", () => {
    expect(getCalculatorsByCategoryAndSubcategory("oncology", "body-surface-area").map((c) => c.id)).toContain("oncology-bsa-dose")
    expect(getCalculatorsByCategoryAndSubcategory("oncology", "chemotherapy-dosing").map((c) => c.id)).toContain("oncology-regimen-dose")
    expect(getCalculatorsByCategoryAndSubcategory("oncology", "dose-modifications").map((c) => c.id)).toContain("oncology-organ-function-dose-modification")
    expect(getCalculatorsByCategoryAndSubcategory("dosing", "therapeutic-drug-monitoring").map((c) => c.id)).toContain("vancomycin-auc24-target-check")
    expect(calculators.some((c) => c.category === "cardiovascular")).toBe(true)
    expect(calculators.some((c) => c.category === "stem-cell-transplant")).toBe(true)
    expect(calculators.some((c) => c.category === "spectrophotometry")).toBe(true)
  })

  it("populates every declared nested clinical section", () => {
    for (const [category, sections] of Object.entries(CALCULATOR_SUBCATEGORY_LABELS)) {
      for (const subcategory of Object.keys(sections)) {
        expect(getCalculatorsByCategoryAndSubcategory(category as any, subcategory).length, `${category}/${subcategory}`).toBeGreaterThan(0)
      }
    }
  })

})
