/**
 * Shared helpers used across calculator definitions so validation and
 * rounding behavior stays consistent instead of being reimplemented
 * per-calculator.
 */

export class CalculatorInputError extends Error {}

/** Reads a required numeric input, throwing a clear error if missing/invalid. */
export function num(inputs: Record<string, number | string>, id: string): number {
  const raw = inputs[id]
  if (raw === undefined || raw === null || raw === "") {
    throw new CalculatorInputError(`Missing required value: ${id}`)
  }
  const value = typeof raw === "number" ? raw : Number.parseFloat(raw)
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    throw new CalculatorInputError(`Invalid numeric value for ${id}`)
  }
  return value
}

/** Reads an optional numeric input, returning undefined if absent. */
export function optionalNum(inputs: Record<string, number | string>, id: string): number | undefined {
  const raw = inputs[id]
  if (raw === undefined || raw === null || raw === "") return undefined
  const value = typeof raw === "number" ? raw : Number.parseFloat(raw)
  return Number.isFinite(value) ? value : undefined
}

/** Reads a required string/select input. */
export function str(inputs: Record<string, number | string>, id: string): string {
  const raw = inputs[id]
  if (raw === undefined || raw === null || raw === "") {
    throw new CalculatorInputError(`Missing required value: ${id}`)
  }
  return String(raw)
}

export function assertPositive(value: number, label: string) {
  if (value <= 0) {
    throw new CalculatorInputError(`${label} must be greater than zero`)
  }
}

export function assertNonNegative(value: number, label: string) {
  if (value < 0) {
    throw new CalculatorInputError(`${label} cannot be negative`)
  }
}

/** Guards against division by zero with a descriptive error rather than NaN/Infinity. */
export function safeDivide(numerator: number, denominator: number, label = "denominator"): number {
  if (denominator === 0) {
    throw new CalculatorInputError(`Cannot calculate: ${label} is zero`)
  }
  return numerator / denominator
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function fmt(value: number, decimals = 2, unit?: string): string {
  const rounded = round(value, decimals)
  return unit ? `${rounded} ${unit}` : `${rounded}`
}
