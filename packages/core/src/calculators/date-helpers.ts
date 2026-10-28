import { CalculatorInputError } from "./helpers"

/**
 * Calendar-date helpers for calculators that take a `date` input (value "YYYY-MM-DD").
 * Dates are handled as UTC midnight timestamps so daylight-saving changes and the phone's time zone
 * can never shift a result by a day.
 */

const DAY_MS = 86_400_000
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Parses "YYYY-MM-DD" into UTC midnight milliseconds. Rejects impossible dates such as 2025-02-30. */
export function parseIsoDate(raw: unknown, label: string): number {
  if (raw === undefined || raw === null || raw === "") throw new CalculatorInputError(`${label} is required`)
  const match = ISO_DATE.exec(String(raw))
  if (!match) throw new CalculatorInputError(`${label} must be a valid date`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const ms = Date.UTC(year, month - 1, day)
  const check = new Date(ms)
  const valid = check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
  if (!valid || year < 1900 || year > 2200) throw new CalculatorInputError(`${label} must be a valid date`)
  return ms
}

/** Like parseIsoDate, but returns undefined when the input is blank or missing. */
export function optionalIsoDate(inputs: Record<string, number | string>, id: string, label: string): number | undefined {
  const raw = inputs[id]
  if (raw === undefined || raw === null || raw === "") return undefined
  return parseIsoDate(raw, label)
}

/** Today's calendar date on the user's device, as UTC midnight milliseconds. */
export function todayUtcMs(now: Date = new Date()): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

export const addDays = (ms: number, days: number): number => ms + days * DAY_MS

/** Whole days from b to a (a - b). */
export const diffDays = (a: number, b: number): number => Math.round((a - b) / DAY_MS)

/** "Mon 12 Oct 2026": fixed wording so it never depends on the phone's locale or ICU data. */
export function formatDate(ms: number): string {
  const d = new Date(ms)
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function formatIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** "24 weeks 3 days" from a number of days. */
export function weeksAndDays(totalDays: number): string {
  const weeks = Math.floor(totalDays / 7)
  const days = totalDays - weeks * 7
  return `${weeks} week${weeks === 1 ? "" : "s"} ${days} day${days === 1 ? "" : "s"}`
}
