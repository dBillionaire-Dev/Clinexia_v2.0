// clinexia-upgrade:phase2 — guided, one-question-at-a-time scoring.
//
// Only tools on the allow-list below can run in guided mode. Each one is a point score where answering "yes"
// to a question can only keep the score the same or raise it (this is tested exhaustively). That property lets
// an "Unknown" answer be handled honestly: the score is shown as a range, from "unknown = no" to "unknown = yes".
// Unknown is never treated as "no" silently, and a range is never saved as a definitive result.

import type { CalculationResult, CalculatorDefinition, InputDefinition } from "../calculators/types"
import { validateInputs } from "./input-validation"

/** Questions where "Unknown" is allowed, per tool. Age and sex are never unknown. */
export const GUIDED_CALCULATORS: Record<string, { unknownAllowed: string[] }> = {
  "cha2ds2-vasc": { unknownAllowed: ["chf", "hypertension", "diabetes", "stroke", "vascular"] },
  "has-bled": { unknownAllowed: ["hypertension", "renal", "liver", "stroke", "bleeding", "labileInr", "age", "drugs", "alcohol"] },
  "dapt-score": { unknownAllowed: ["smoker", "diabetes", "miPresentation", "priorPciMi", "smallStent", "paclitaxelStent", "chfLowEf", "veinGraft"] },
}

export const UNKNOWN = "unknown"

export function isGuidedEligible(definition: CalculatorDefinition | undefined): boolean {
  if (!definition) return false
  const config = GUIDED_CALCULATORS[definition.id]
  if (!config) return false
  const ids = new Set(definition.inputs.map((i) => i.id))
  return config.unknownAllowed.every((id) => ids.has(id))
}

export interface GuidedStep {
  input: InputDefinition
  allowUnknown: boolean
  isYesNo: boolean
}

export function buildGuidedSteps(definition: CalculatorDefinition): GuidedStep[] {
  const unknownAllowed = new Set(GUIDED_CALCULATORS[definition.id]?.unknownAllowed ?? [])
  return definition.inputs.map((input) => {
    const values = (input.options ?? []).map((o) => o.value).sort().join("/")
    return { input, allowUnknown: unknownAllowed.has(input.id), isYesNo: input.kind === "select" && values === "no/yes" }
  })
}

export interface GuidedEvaluation {
  complete: boolean
  missing: string[]
  unknownIds: string[]
  issues: string[]
  /** Set when every question has a definite answer. */
  definitive?: CalculationResult
  /** Set when some answers are unknown: the lowest and highest possible result. */
  low?: CalculationResult
  high?: CalculationResult
}

function substitute(answers: Record<string, string>, unknownIds: string[], replacement: "no" | "yes"): Record<string, string> {
  const copy = { ...answers }
  for (const id of unknownIds) copy[id] = replacement
  return copy
}

export function evaluateGuided(definition: CalculatorDefinition, answers: Record<string, string>): GuidedEvaluation {
  const steps = buildGuidedSteps(definition)
  const missing = steps.filter((s) => !s.input.optional && (answers[s.input.id] === undefined || answers[s.input.id] === "")).map((s) => s.input.id)
  if (missing.length) return { complete: false, missing, unknownIds: [], issues: [] }

  const unknownIds = steps.filter((s) => s.allowUnknown && answers[s.input.id] === UNKNOWN).map((s) => s.input.id)
  const lowAnswers = substitute(answers, unknownIds, "no")
  const issues = validateInputs(definition, lowAnswers).map((i) => i.message)
  if (issues.length) return { complete: false, missing: [], unknownIds, issues }

  try {
    if (unknownIds.length === 0) return { complete: true, missing: [], unknownIds, issues: [], definitive: definition.calculate(answers) }
    const low = definition.calculate(lowAnswers)
    const high = definition.calculate(substitute(answers, unknownIds, "yes"))
    return { complete: true, missing: [], unknownIds, issues: [], low, high }
  } catch (error) {
    return { complete: false, missing: [], unknownIds, issues: [error instanceof Error ? error.message : "The score could not be calculated."] }
  }
}

/** "2" when both ends agree, otherwise "2 to 4". Returns null if either end is not a number. */
export function formatScoreRange(low: CalculationResult, high: CalculationResult): string | null {
  if (typeof low.value !== "number" || typeof high.value !== "number") return null
  return low.value === high.value ? String(low.value) : `${low.value} to ${high.value}`
}
