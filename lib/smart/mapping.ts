import { resolveUnit, type CalculatorDefinition, type InputDefinition } from "@clinexia/core"

/**
 * FHIR to calculator inputs. Pure functions, no network, no storage, no logging: the SMART launcher and the CDS Hooks service
 * both call this with resources they already hold in memory.
 *
 *  - Patient.birthDate gives age in whole years; Patient.gender gives sex only when it is exactly male or female (never guessed).
 *  - Observations are matched by LOINC code (from the calculator's `fhir` metadata, Phase 2; those codes are UNVERIFIED).
 *  - Only final, amended or corrected observations with a numeric value and a usable date are considered.
 *  - The LATEST observation wins. Two different values at the same instant are a conflict: nothing is prefilled.
 *  - Units are converted with the same converter as the API. An unknown or incompatible unit is skipped, never guessed.
 *  - Every value keeps its observation date, and is marked stale beyond a configurable age.
 */

export interface FhirCoding { system?: string; code?: string }
export interface FhirQuantity { value?: number; unit?: string; system?: string; code?: string }
export interface FhirObservation {
  resourceType?: string
  id?: string
  status?: string
  code?: { coding?: FhirCoding[] }
  effectiveDateTime?: string
  effectivePeriod?: { start?: string; end?: string }
  issued?: string
  valueQuantity?: FhirQuantity
}
export interface FhirPatient { resourceType?: string; id?: string; birthDate?: string; gender?: string }

export interface StaleThresholds {
  creatinineDays: number
  heightDays: number
  /** Every other observation. Not specified by the brief: 90 days is a placeholder (a Decision needed). */
  otherDays: number
}
export const DEFAULT_STALE_THRESHOLDS: StaleThresholds = { creatinineDays: 30, heightDays: 365, otherDays: 90 }

const CREATININE_LOINCS = new Set(["2160-0", "14682-9"])
const HEIGHT_LOINCS = new Set(["8302-2"])
const LOINC_SYSTEM = "http://loinc.org"
const UCUM_SYSTEM = "http://unitsofmeasure.org"
const USABLE_STATUS = new Set(["final", "amended", "corrected"])
const DAY_MS = 86_400_000

export const staleAfterDays = (loinc: string | undefined, t: StaleThresholds = DEFAULT_STALE_THRESHOLDS): number =>
  loinc && CREATININE_LOINCS.has(loinc) ? t.creatinineDays : loinc && HEIGHT_LOINCS.has(loinc) ? t.heightDays : t.otherDays

export type SkipReason =
  | "no_patient_data" | "invalid_birthdate" | "age_unit_unsupported" | "unusable_gender"
  | "no_observation" | "unusable_observation" | "conflicting_observations" | "unit_not_convertible" | "out_of_range"

export interface MappedValue {
  inputId: string
  /** In the calculator's own unit, as the string the form uses. */
  value: string
  source: "patient" | "observation"
  observationId?: string
  /** Observation date, YYYY-MM-DD. */
  observedAt?: string
  ageDays?: number
  stale: boolean
  staleAfterDays?: number
  original?: { value: number; unit: string }
  converted: boolean
  loinc?: string
}
export interface SkippedInput { inputId: string; reason: SkipReason; detail?: string }
export interface MappingResult { values: MappedValue[]; skipped: SkippedInput[] }

export const SKIP_MESSAGES: Record<SkipReason, string> = {
  no_patient_data: "The patient record did not include this.",
  invalid_birthdate: "The date of birth is missing or incomplete, so age could not be worked out.",
  age_unit_unsupported: "This input is not an age in years.",
  unusable_gender: "The record's gender is not male or female, so it was not filled in.",
  no_observation: "No matching result was found in the record.",
  unusable_observation: "Matching results exist but none is final with a numeric value and a date.",
  conflicting_observations: "Two different values share the most recent time, so none was filled in.",
  unit_not_convertible: "The result's unit could not be converted safely, so it was not filled in.",
  out_of_range: "The value is outside the range this calculator accepts, so it was not filled in.",
}

const strictDate = /^(\d{4})-(\d{2})-(\d{2})/
function dateMs(text: string | undefined): { ms: number; day: string } | null {
  if (!text) return null
  const m = strictDate.exec(text)
  if (!m) return null // year or year-month only: not precise enough
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const check = new Date(Date.UTC(y, mo - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null
  // Full precision for ordering when a time is present, otherwise midnight UTC.
  const full = text.length > 10 ? Date.parse(text) : NaN
  return { ms: Number.isFinite(full) ? full : check.getTime(), day: m[0] }
}

const startOfUtcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

/** Whole years between birthDate (YYYY-MM-DD) and today, or null when it cannot be worked out. */
export function ageInYears(birthDate: string | undefined, today: Date): number | null {
  const b = birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? dateMs(birthDate) : null
  if (!b) return null
  const born = new Date(b.ms)
  let age = today.getUTCFullYear() - born.getUTCFullYear()
  const beforeBirthday = today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())
  if (beforeBirthday) age--
  return age >= 0 && age <= 130 ? age : null
}

const observationWhen = (o: FhirObservation) => dateMs(o.effectiveDateTime) ?? dateMs(o.effectivePeriod?.end) ?? dateMs(o.effectivePeriod?.start) ?? dateMs(o.issued)
const hasLoinc = (o: FhirObservation, loinc: string) => (o.code?.coding ?? []).some((c) => c.system === LOINC_SYSTEM && c.code === loinc)
const unitText = (q: FhirQuantity) => (q.system === UCUM_SYSTEM && q.code ? q.code : q.unit ?? q.code)

const outOfRange = (input: InputDefinition, v: number) => (input.min !== undefined && v < input.min) || (input.max !== undefined && v > input.max)

function mapPatientInput(input: InputDefinition, patient: FhirPatient | undefined, today: Date): MappedValue | SkippedInput {
  const path = input.fhir?.path
  if (!patient) return { inputId: input.id, reason: "no_patient_data" }
  if (path === "birthDate") {
    if (input.kind !== "number" || !/^(years?|a)$/i.test(input.unit ?? "")) return { inputId: input.id, reason: "age_unit_unsupported" }
    const age = ageInYears(patient.birthDate, today)
    if (age === null) return { inputId: input.id, reason: "invalid_birthdate" }
    if (outOfRange(input, age)) return { inputId: input.id, reason: "out_of_range" }
    return { inputId: input.id, value: String(age), source: "patient", stale: false, converted: false }
  }
  if (path === "gender") {
    const g = patient.gender
    const option = input.kind === "select" && (g === "male" || g === "female") ? (input.options ?? []).find((o) => o.value === g) : undefined
    return option ? { inputId: input.id, value: option.value, source: "patient", stale: false, converted: false } : { inputId: input.id, reason: "unusable_gender" }
  }
  return { inputId: input.id, reason: "no_patient_data" }
}

function mapObservationInput(input: InputDefinition, observations: FhirObservation[], today: Date, thresholds: StaleThresholds): MappedValue | SkippedInput {
  const loinc = input.fhir?.loinc
  if (!loinc) return { inputId: input.id, reason: "no_observation" }
  const matching = observations.filter((o) => (o.resourceType === undefined || o.resourceType === "Observation") && hasLoinc(o, loinc))
  if (matching.length === 0) return { inputId: input.id, reason: "no_observation" }

  const todayMs = startOfUtcDay(today)
  const usable = matching
    .map((o) => ({ o, when: observationWhen(o), q: o.valueQuantity }))
    .filter((x) => USABLE_STATUS.has(x.o.status ?? "") && x.when && typeof x.q?.value === "number" && Number.isFinite(x.q.value) && x.when.ms <= todayMs + DAY_MS)
  if (usable.length === 0) return { inputId: input.id, reason: "unusable_observation" }

  const latestMs = Math.max(...usable.map((x) => x.when!.ms))
  const latest = usable.filter((x) => x.when!.ms === latestMs)

  const converted = latest.map((x) => {
    const q = x.q as FhirQuantity
    const unit = unitText(q)
    if (!unit) return { x, fail: "unit_not_convertible" as const }
    const r = resolveUnit(input, q.value as number, unit)
    return r.ok ? { x, value: r.value, unit, wasConverted: Boolean(r.conversion) } : { x, fail: "unit_not_convertible" as const, detail: unit }
  })
  const good = converted.filter((c): c is typeof c & { value: number; unit: string; wasConverted: boolean } => "value" in c)
  if (good.length === 0) return { inputId: input.id, reason: "unit_not_convertible", detail: (converted[0] as { detail?: string }).detail }
  // The same measurement recorded in two units differs only by rounding (about 0.0001%); a real disagreement is much larger.
  if (good.some((g) => Math.abs(g.value - good[0].value) > 1e-5 * Math.max(1, Math.abs(g.value), Math.abs(good[0].value)))) return { inputId: input.id, reason: "conflicting_observations" }

  const pick = good[0]
  if (outOfRange(input, pick.value)) return { inputId: input.id, reason: "out_of_range" }
  const ageDays = Math.max(0, Math.floor((todayMs - startOfUtcDay(new Date(pick.x.when!.ms))) / DAY_MS))
  const limit = staleAfterDays(loinc, thresholds)
  return {
    inputId: input.id,
    value: String(pick.value),
    source: "observation",
    observationId: pick.x.o.id,
    observedAt: pick.x.when!.day,
    ageDays,
    stale: ageDays > limit,
    staleAfterDays: limit,
    original: { value: (pick.x.q as FhirQuantity).value as number, unit: pick.unit },
    converted: pick.wasConverted,
    loinc,
  }
}

export interface MapOptions { today?: Date; thresholds?: Partial<StaleThresholds> }

/** Maps what the record holds onto the calculator's inputs that carry FHIR metadata. Inputs without a usable value are listed in `skipped`. */
export function mapFhirToInputs(
  def: Pick<CalculatorDefinition, "inputs">,
  resources: { patient?: FhirPatient; observations?: FhirObservation[] },
  options: MapOptions = {},
): MappingResult {
  const today = options.today ?? new Date()
  const thresholds = { ...DEFAULT_STALE_THRESHOLDS, ...(options.thresholds ?? {}) }
  const values: MappedValue[] = []
  const skipped: SkippedInput[] = []
  for (const input of def.inputs) {
    if (!input.fhir) continue
    const r = input.fhir.resource === "Patient" ? mapPatientInput(input, resources.patient, today) : mapObservationInput(input, resources.observations ?? [], today, thresholds)
    if ("reason" in r) skipped.push(r)
    else values.push(r)
  }
  return { values, skipped }
}
