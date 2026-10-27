import type { CalculatorDefinition } from "./types"
import { CALCULATOR_CATEGORY_LABELS, CALCULATOR_SUBCATEGORY_LABELS } from "./types"

export interface CalculatorAuditIssue {
  id: string
  field: string
  message: string
}

export function auditCalculatorDefinition(c: CalculatorDefinition): CalculatorAuditIssue[] {
  const issues: CalculatorAuditIssue[] = []
  if (!c.id.trim()) issues.push({ id: c.id, field: "id", message: "Calculator id is empty." })
  if (!c.name.trim()) issues.push({ id: c.id, field: "name", message: "Calculator name is empty." })
  if (!c.description.trim()) issues.push({ id: c.id, field: "description", message: "Description is empty." })
  if (!c.inputs.length) issues.push({ id: c.id, field: "inputs", message: "Calculator must define at least one input." })

  const inputIds = new Set<string>()
  for (const input of c.inputs) {
    if (inputIds.has(input.id)) issues.push({ id: c.id, field: `inputs.${input.id}`, message: "Duplicate input id." })
    inputIds.add(input.id)
    if (!input.label.trim()) issues.push({ id: c.id, field: `inputs.${input.id}.label`, message: "Input label is empty." })
    if (input.min !== undefined && input.max !== undefined && input.min > input.max) {
      issues.push({ id: c.id, field: `inputs.${input.id}`, message: "Minimum exceeds maximum." })
    }
    if (input.kind === "select" && (!input.options || input.options.length === 0)) {
      issues.push({ id: c.id, field: `inputs.${input.id}.options`, message: "Select input has no options." })
    }
    if (input.kind === "select" && input.options) {
      const values = input.options.map((o) => o.value)
      if (new Set(values).size !== values.length) {
        issues.push({ id: c.id, field: `inputs.${input.id}.options`, message: "Select option values are duplicated." })
      }
    }
  }

  if (c.subcategory && !CALCULATOR_SUBCATEGORY_LABELS[c.category][c.subcategory]) {
    issues.push({ id: c.id, field: "subcategory", message: `Unknown subcategory "${c.subcategory}" for ${CALCULATOR_CATEGORY_LABELS[c.category]}.` })
  }
  if (typeof c.calculate !== "function") issues.push({ id: c.id, field: "calculate", message: "Calculate function is missing." })
  for (const relatedId of c.relatedTools ?? []) {
    if (relatedId === c.id) issues.push({ id: c.id, field: "relatedTools", message: "Calculator cannot relate to itself." })
  }
  return issues
}

export function auditCalculatorRegistry(calculators: CalculatorDefinition[]): CalculatorAuditIssue[] {
  const issues: CalculatorAuditIssue[] = []
  const ids = new Set<string>()
  for (const calculator of calculators) {
    if (ids.has(calculator.id)) {
      issues.push({ id: calculator.id, field: "id", message: "Duplicate calculator id in registry." })
    }
    ids.add(calculator.id)
    issues.push(...auditCalculatorDefinition(calculator))
  }
  return issues
}
