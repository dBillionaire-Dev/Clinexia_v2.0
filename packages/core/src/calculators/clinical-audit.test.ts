import { describe, expect, it } from "vitest"
import { calculators, calculatorCatalog } from "./registry"
import { buildClinicalAuditSummary } from "./clinical-audit"
import { getCalculatorReferences } from "./dosing-references"

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0

describe("Clinexia clinical registry audit", () => {
  it("has unique ids and no structural registry issues", () => {
    const report = buildClinicalAuditSummary()
    expect(report.structuralIssues).toEqual([])
    expect(new Set(calculators.map((c) => c.id)).size).toBe(calculators.length)
  })

  it("has a non-empty definition and calculation function for every calculator", () => {
    for (const calculator of calculators) {
      expect(nonEmpty(calculator.id)).toBe(true)
      expect(nonEmpty(calculator.name)).toBe(true)
      expect(nonEmpty(calculator.description)).toBe(true)
      expect(typeof calculator.calculate).toBe("function")
      expect(calculator.inputs.length).toBeGreaterThan(0)
    }
  })

  it("has source metadata for every calculator", () => {
    for (const calculator of calculators) {
      const references = getCalculatorReferences(calculator)
      expect(references.length, calculator.id).toBeGreaterThan(0)
      expect(references.every((reference) => nonEmpty(reference.source) && nonEmpty(reference.version) && nonEmpty(reference.lastVerified)), calculator.id).toBe(true)
    }
  })

  it("does not leave an empty top-level calculator domain", () => {
    expect(calculatorCatalog.every((category) => category.count > 0)).toBe(true)
  })

  it("has no calculators currently mapped to review-needed references", () => {
    const report = buildClinicalAuditSummary()
    expect(report.calculatorsUsingReviewNeededReference).toEqual([])
  })
})
