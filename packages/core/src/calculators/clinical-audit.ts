import { calculators, calculatorCatalog } from "./registry"
import { auditCalculatorRegistry, type CalculatorAuditIssue } from "./validation"
import { getCalculatorReferences } from "./dosing-references"

export interface ClinicalAuditSummary {
  calculatorCount: number
  categoryCount: number
  categoriesWithCalculators: number
  subcategoriesWithCalculators: number
  structuralIssues: CalculatorAuditIssue[]
  calculatorsMissingKeywords: string[]
  calculatorsMissingLimitations: string[]
  calculatorsMissingFormula: string[]
  calculatorsUsingReviewNeededReference: string[]
}

export function buildClinicalAuditSummary(): ClinicalAuditSummary {
  const structuralIssues = auditCalculatorRegistry(calculators)
  const calculatorsMissingKeywords = calculators.filter((c) => !c.keywords?.length).map((c) => c.id)
  const calculatorsMissingLimitations = calculators.filter((c) => !c.limitations?.length).map((c) => c.id)
  const calculatorsMissingFormula = calculators.filter((c) => !c.formula?.trim()).map((c) => c.id)
  const subcategoriesWithCalculators = calculatorCatalog.reduce((count, category) => {
    const subcategories = new Set(
      calculators.filter((calculator) => calculator.category === category.id && calculator.subcategory).map((calculator) => calculator.subcategory),
    )
    return count + subcategories.size
  }, 0)
  const calculatorsUsingReviewNeededReference = calculators
    .filter((c) => getCalculatorReferences(c).some((reference) => reference.status === "review-needed"))
    .map((c) => c.id)

  return {
    calculatorCount: calculators.length,
    categoryCount: calculatorCatalog.length,
    categoriesWithCalculators: calculatorCatalog.filter((c) => c.count > 0).length,
    subcategoriesWithCalculators,
    structuralIssues,
    calculatorsMissingKeywords,
    calculatorsMissingLimitations,
    calculatorsMissingFormula,
    calculatorsUsingReviewNeededReference,
  }
}
