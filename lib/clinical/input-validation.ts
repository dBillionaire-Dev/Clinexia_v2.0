// clinexia-upgrade:phase2 — central, UI-independent input validation.
//
// Rules this layer enforces (and why):
//  - A required value is never replaced by a guess or a zero.
//  - A number is accepted only if it is written as a plain decimal number. Hex ("0x10"), "Infinity", "NaN"
//    and thousands separators are rejected instead of being silently converted.
//  - A select value must be one of the declared options (stale values from links, embeds or old state fail).
//  - Every problem is reported at once, not one per attempt.
// It does not convert units. Unit conversion is always an explicit, visible step in a calculator.

import type { CalculatorDefinition, InputDefinition } from "../calculators/types"

export type IssueCode = "required" | "not-a-number" | "below-min" | "above-max" | "invalid-option" | "invalid-date"

export interface InputIssue {
  inputId: string
  code: IssueCode
  message: string
}

const PLAIN_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/

export function isEmptyValue(raw: unknown): boolean {
  return raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")
}

/** Returns the number, or null when the text is not a plain finite decimal number. */
export function parseStrictNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null
  if (typeof raw !== "string") return null
  const text = raw.trim()
  if (!PLAIN_NUMBER.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

function isRealCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const [y, m, d] = text.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function withUnit(value: number, unit?: string): string {
  return unit ? `${value} ${unit}` : String(value)
}

export function validateInput(input: InputDefinition, raw: unknown): InputIssue | null {
  if (isEmptyValue(raw)) {
    return input.optional ? null : { inputId: input.id, code: "required", message: `${input.label} is required.` }
  }

  if (input.kind === "number") {
    const value = parseStrictNumber(raw)
    if (value === null) return { inputId: input.id, code: "not-a-number", message: `${input.label} must be a number.` }
    if (input.min !== undefined && value < input.min) {
      return { inputId: input.id, code: "below-min", message: `${input.label} must be at least ${withUnit(input.min, input.unit)}.` }
    }
    if (input.max !== undefined && value > input.max) {
      return { inputId: input.id, code: "above-max", message: `${input.label} must be no more than ${withUnit(input.max, input.unit)}.` }
    }
    return null
  }

  if (input.kind === "select") {
    const allowed = (input.options ?? []).map((option) => option.value)
    if (!allowed.includes(String(raw))) {
      return { inputId: input.id, code: "invalid-option", message: `${input.label}: choose one of the listed options.` }
    }
    return null
  }

  if (input.kind === "date") {
    if (!isRealCalendarDate(String(raw))) {
      return { inputId: input.id, code: "invalid-date", message: `${input.label} must be a valid date.` }
    }
    return null
  }

  return null
}

export function validateInputs(definition: CalculatorDefinition, values: Record<string, unknown>): InputIssue[] {
  const issues: InputIssue[] = []
  for (const input of definition.inputs) {
    const issue = validateInput(input, values[input.id])
    if (issue) issues.push(issue)
  }
  return issues
}

export function summariseIssues(issues: InputIssue[]): string {
  return issues.map((issue) => issue.message).join(" ")
}
