/**
 * Height conversion helpers (cm, m, mm, ft, in and feet + inches).
 * The inch is exactly 2.54 cm by international definition, so every conversion here is exact apart from display rounding.
 */
export const CM_PER_INCH = 2.54
export const INCHES_PER_FOOT = 12

export type HeightUnit = "cm" | "m" | "mm" | "ft" | "in"

const CM_PER_UNIT: Record<HeightUnit, number> = {
  cm: 1,
  m: 100,
  mm: 0.1,
  in: CM_PER_INCH,
  ft: CM_PER_INCH * INCHES_PER_FOOT,
}

export const HEIGHT_UNITS: { id: HeightUnit; name: string; symbol: string }[] = [
  { id: "cm", name: "Centimeters", symbol: "cm" },
  { id: "m", name: "Meters", symbol: "m" },
  { id: "mm", name: "Millimeters", symbol: "mm" },
  { id: "ft", name: "Feet (decimal)", symbol: "ft" },
  { id: "in", name: "Inches", symbol: "in" },
]

export interface FeetInches {
  feet: number
  inches: number
}

export interface HeightBreakdown {
  cm: number
  m: number
  mm: number
  ft: number
  in: number
  feetInches: FeetInches
}

/** Convert a single value between two height units. Returns null for non-finite or negative input. */
export function convertHeight(value: number, from: HeightUnit, to: HeightUnit): number | null {
  if (!Number.isFinite(value) || value < 0) return null
  return (value * CM_PER_UNIT[from]) / CM_PER_UNIT[to]
}

/** Feet and inches to centimeters. Returns null for non-finite or negative input. */
export function feetInchesToCm(feet: number, inches: number): number | null {
  if (!Number.isFinite(feet) || !Number.isFinite(inches) || feet < 0 || inches < 0) return null
  return (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH
}

/**
 * Centimeters to whole feet and inches, with inches rounded to `inchDecimals` places.
 * Rounding that reaches 12 in carries into the next foot, so 182.88 cm is 6 ft 0 in, never 5 ft 12 in.
 */
export function cmToFeetInches(cm: number, inchDecimals = 1): FeetInches | null {
  if (!Number.isFinite(cm) || cm < 0) return null
  const totalInches = cm / CM_PER_INCH
  let feet = Math.floor(totalInches / INCHES_PER_FOOT + 1e-12)
  const factor = 10 ** inchDecimals
  let inches = Math.round((totalInches - feet * INCHES_PER_FOOT) * factor) / factor
  if (inches >= INCHES_PER_FOOT) {
    feet += 1
    inches = 0
  }
  return { feet, inches }
}

/** Every common representation of one height, computed from a value in centimeters. */
export function breakdownFromCm(cm: number): HeightBreakdown | null {
  if (!Number.isFinite(cm) || cm < 0) return null
  const feetInches = cmToFeetInches(cm)
  if (!feetInches) return null
  return {
    cm,
    m: cm / 100,
    mm: cm * 10,
    ft: cm / (CM_PER_INCH * INCHES_PER_FOOT),
    in: cm / CM_PER_INCH,
    feetInches,
  }
}

export function formatFeetInches({ feet, inches }: FeetInches): string {
  return `${feet} ft ${Number(inches.toFixed(1))} in`
}

/** Round for display without trailing zeros. */
export function formatHeightNumber(n: number, decimals = 2): string {
  return String(Number(n.toFixed(decimals)))
}

/** Heights outside this range are almost certainly a unit slip; the UI shows a gentle warning. */
export const PLAUSIBLE_ADULT_HEIGHT_CM = { min: 50, max: 272 }
