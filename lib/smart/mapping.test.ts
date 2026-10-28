import { describe, expect, it } from "vitest"
import { getCalculatorById } from "@clinexia/core"
import { DEFAULT_STALE_THRESHOLDS, ageInYears, mapFhirToInputs, staleAfterDays, type FhirObservation, type FhirPatient } from "./mapping"

const TODAY = new Date(Date.UTC(2026, 9, 26, 12)) // 26 Oct 2026
const near = (a: number, b: number, tol = 1e-4) => Math.abs(a - b) <= tol
const def = (id: string) => getCalculatorById(id)!
const crcl = def("creatinine-clearance") // age, weight, creatinine, sex
const patient: FhirPatient = { resourceType: "Patient", id: "p1", birthDate: "1972-10-26", gender: "male" } // 54 today

const obs = (loinc: string, value: number | undefined, unit: string | undefined, date: string | undefined, extra: Partial<FhirObservation> = {}): FhirObservation => ({
  resourceType: "Observation",
  id: `o-${loinc}-${date}-${value}`,
  status: "final",
  code: { coding: [{ system: "http://loinc.org", code: loinc }] },
  ...(date ? { effectiveDateTime: date } : {}),
  ...(value === undefined ? {} : { valueQuantity: { value, unit, system: "http://unitsofmeasure.org", code: unit } }),
  ...extra,
})
const CREAT = "2160-0"
const WEIGHT = "29463-7"
const map = (d = crcl, observations: FhirObservation[] = [], p: FhirPatient | null = patient, opts = {}) => mapFhirToInputs(d, { patient: p ?? undefined, observations }, { today: TODAY, ...opts })
const val = (r: ReturnType<typeof map>, id: string) => r.values.find((v) => v.inputId === id)
const skip = (r: ReturnType<typeof map>, id: string) => r.skipped.find((s) => s.inputId === id)?.reason

describe("patient: age and sex", () => {
  it("age is whole completed years from Patient.birthDate", () => {
    expect(ageInYears("1972-10-26", TODAY)).toBe(54)
    expect(ageInYears("1972-10-27", TODAY)).toBe(53) // birthday is tomorrow
    expect(ageInYears("2026-10-26", TODAY)).toBe(0)
    expect(val(map(), "age")).toMatchObject({ value: "54", source: "patient", stale: false })
  })
  it("a missing, partial, future or impossible birth date gives no age (never an estimate)", () => {
    for (const b of [undefined, "", "1972", "1972-10", "1972-13-40", "2030-01-01", "1850-01-01", "26/10/1972"]) {
      expect(ageInYears(b, TODAY), String(b)).toBeNull()
      expect(skip(map(crcl, [], { ...patient, birthDate: b }), "age")).toBe("invalid_birthdate")
    }
  })
  it("age outside the calculator's range is skipped", () => {
    expect(skip(map(def("egfr-ckd-epi"), [], { ...patient, birthDate: "2020-01-01" }), "age")).toBe("out_of_range") // eGFR needs 18 or more
  })
  it("sex is taken only when the record says male or female", () => {
    expect(val(map(), "sex")?.value).toBe("male")
    expect(val(map(crcl, [], { ...patient, gender: "female" }), "sex")?.value).toBe("female")
    for (const g of ["other", "unknown", undefined, "M", "Male"]) expect(skip(map(crcl, [], { ...patient, gender: g }), "sex"), String(g)).toBe("unusable_gender")
  })
  it("no Patient resource at all", () => {
    const r = map(crcl, [], null)
    expect(skip(r, "age")).toBe("no_patient_data")
    expect(skip(r, "sex")).toBe("no_patient_data")
  })
})

describe("observations: units", () => {
  it("creatinine recorded in umol/L is converted to the calculator's mg/dL", () => {
    const r = map(crcl, [obs(CREAT, 88, "umol/L", "2026-10-20")])
    const v = val(r, "creatinine")!
    expect(near(Number(v.value), 0.995456, 1e-5)).toBe(true)
    expect(v).toMatchObject({ converted: true, observedAt: "2026-10-20", ageDays: 6, stale: false, original: { value: 88, unit: "umol/L" } })
  })
  it("the same value in mg/dL is not converted", () => {
    const v = val(map(crcl, [obs(CREAT, 1.2, "mg/dL", "2026-10-20")]), "creatinine")!
    expect(v.value).toBe("1.2")
    expect(v.converted).toBe(false)
  })
  it("weight in pounds (UCUM [lb_av]) is converted to kg", () => {
    const v = val(map(crcl, [obs(WEIGHT, 154.32358, "[lb_av]", "2026-10-20")]), "weight")!
    expect(near(Number(v.value), 70, 1e-3)).toBe(true)
    expect(v.converted).toBe(true)
  })
  it("height in inches is converted to cm for BMI", () => {
    const v = val(map(def("bmi"), [obs("8302-2", 66, "[in_i]", "2026-10-20")]), "height")!
    expect(near(Number(v.value), 167.64)).toBe(true)
  })
  it("uses the UCUM code when the system is UCUM, otherwise the display unit", () => {
    const o = obs(CREAT, 88, undefined, "2026-10-20")
    o.valueQuantity = { value: 88, unit: "µmol/L" }
    expect(near(Number(val(map(crcl, [o]), "creatinine")!.value), 0.995456, 1e-5)).toBe(true)
  })
  it("a wrong, unknown or missing unit is skipped, never guessed", () => {
    for (const unit of ["furlongs", "kg", "cm", undefined]) {
      const r = map(crcl, [obs(CREAT, 88, unit, "2026-10-20")])
      expect(val(r, "creatinine"), String(unit)).toBeUndefined()
      expect(skip(r, "creatinine"), String(unit)).toBe("unit_not_convertible")
    }
  })
  it("a stated unit that CAN be converted is converted exactly as stated (the record is trusted for its unit)", () => {
    const v = val(map(crcl, [obs(CREAT, 0.088, "mmol/L", "2026-10-20")]), "creatinine")!
    expect(near(Number(v.value), 0.995456 * 1, 1e-3)).toBe(true) // 0.088 mmol/L = 88 umol/L
  })
  it("an implausible value after conversion is skipped as out of range", () => {
    expect(skip(map(crcl, [obs(CREAT, -5, "mg/dL", "2026-10-20")]), "creatinine")).toBe("out_of_range")
  })
  it("inputs without a fixed unit (LDL lipids share a unit select) are skipped", () => {
    const r = map(def("ldl-friedewald"), [obs("2093-3", 5, "mmol/L", "2026-10-20")], null)
    expect(skip(r, "tc")).toBe("unit_not_convertible")
  })
})

describe("observations: which one is used", () => {
  it("the most recent of several wins, whatever the order they arrive in", () => {
    const list = [obs(CREAT, 1.0, "mg/dL", "2026-09-01"), obs(CREAT, 1.4, "mg/dL", "2026-10-15"), obs(CREAT, 2.0, "mg/dL", "2026-08-01")]
    expect(val(map(crcl, list), "creatinine")).toMatchObject({ value: "1.4", observedAt: "2026-10-15" })
    expect(val(map(crcl, [...list].reverse()), "creatinine")?.value).toBe("1.4")
  })
  it("time of day orders results on the same date", () => {
    const list = [obs(CREAT, 1.0, "mg/dL", "2026-10-15T08:00:00Z"), obs(CREAT, 1.6, "mg/dL", "2026-10-15T17:30:00Z")]
    expect(val(map(crcl, list), "creatinine")?.value).toBe("1.6")
  })
  it("two different values at the very same time are a conflict: nothing is filled in", () => {
    const list = [obs(CREAT, 1.0, "mg/dL", "2026-10-15"), obs(CREAT, 1.6, "mg/dL", "2026-10-15")]
    expect(skip(map(crcl, list), "creatinine")).toBe("conflicting_observations")
  })
  it("the same value twice at the same time is not a conflict", () => {
    const list = [obs(CREAT, 1.0, "mg/dL", "2026-10-15"), obs(CREAT, 88.4017, "umol/L", "2026-10-15")]
    expect(val(map(crcl, list), "creatinine")).toBeDefined()
  })
  it("only final, amended or corrected results with a number and a usable date count", () => {
    const bad: FhirObservation[] = [
      obs(CREAT, 9, "mg/dL", "2026-10-25", { status: "entered-in-error" }),
      obs(CREAT, 9, "mg/dL", "2026-10-25", { status: "preliminary" }),
      obs(CREAT, 9, "mg/dL", "2026-10-25", { status: "cancelled" }),
      obs(CREAT, undefined, undefined, "2026-10-25"),
      obs(CREAT, 9, "mg/dL", undefined),
      obs(CREAT, 9, "mg/dL", "2026-10"),
      obs(CREAT, 9, "mg/dL", "2027-03-01"), // in the future
    ]
    expect(skip(map(crcl, bad), "creatinine")).toBe("unusable_observation")
    const withGood = [...bad, obs(CREAT, 1.1, "mg/dL", "2026-10-01"), obs(CREAT, 1.3, "mg/dL", "2026-10-02", { status: "amended" }), obs(CREAT, 1.2, "mg/dL", "2026-09-30", { status: "corrected" })]
    expect(val(map(crcl, withGood), "creatinine")).toMatchObject({ value: "1.3", observedAt: "2026-10-02" })
  })
  it("falls back to effectivePeriod, then issued, for the date", () => {
    const a = obs(CREAT, 1.1, "mg/dL", undefined, { effectivePeriod: { start: "2026-10-01", end: "2026-10-03" } })
    expect(val(map(crcl, [a]), "creatinine")?.observedAt).toBe("2026-10-03")
    const b = obs(CREAT, 1.1, "mg/dL", undefined, { issued: "2026-10-04T10:00:00Z" })
    expect(val(map(crcl, [b]), "creatinine")?.observedAt).toBe("2026-10-04")
  })
  it("matches on the LOINC system and code only", () => {
    const other: FhirObservation = { ...obs(CREAT, 1.1, "mg/dL", "2026-10-20"), code: { coding: [{ system: "http://example.org/local", code: CREAT }] } }
    const otherCode = obs("9999-9", 1.1, "mg/dL", "2026-10-20")
    expect(skip(map(crcl, [other, otherCode]), "creatinine")).toBe("no_observation")
    expect(skip(map(crcl, []), "creatinine")).toBe("no_observation")
  })
  it("ignores resources that are not Observations", () => {
    const notObs = { ...obs(CREAT, 1.1, "mg/dL", "2026-10-20"), resourceType: "Condition" }
    expect(skip(map(crcl, [notObs]), "creatinine")).toBe("no_observation")
  })
})

describe("stale results", () => {
  it("creatinine older than 30 days is flagged, 30 days is not", () => {
    expect(val(map(crcl, [obs(CREAT, 1, "mg/dL", "2026-09-26")]), "creatinine")).toMatchObject({ ageDays: 30, stale: false, staleAfterDays: 30 })
    expect(val(map(crcl, [obs(CREAT, 1, "mg/dL", "2026-09-25")]), "creatinine")).toMatchObject({ ageDays: 31, stale: true })
  })
  it("height older than a year is flagged, a year is not", () => {
    const bmi = def("bmi")
    expect(val(map(bmi, [obs("8302-2", 170, "cm", "2025-10-26")]), "height")).toMatchObject({ ageDays: 365, stale: false, staleAfterDays: 365 })
    expect(val(map(bmi, [obs("8302-2", 170, "cm", "2025-10-25")]), "height")).toMatchObject({ ageDays: 366, stale: true })
  })
  it("other results use the 'other' threshold (a placeholder of 90 days)", () => {
    expect(staleAfterDays(WEIGHT)).toBe(90)
    expect(val(map(crcl, [obs(WEIGHT, 70, "kg", "2026-07-28")]), "weight")).toMatchObject({ ageDays: 90, stale: false })
    expect(val(map(crcl, [obs(WEIGHT, 70, "kg", "2026-07-27")]), "weight")).toMatchObject({ ageDays: 91, stale: true })
  })
  it("thresholds are configurable", () => {
    const o = [obs(CREAT, 1, "mg/dL", "2026-10-16")] // 10 days old
    expect(val(map(crcl, o, patient, { thresholds: { creatinineDays: 7 } }), "creatinine")?.stale).toBe(true)
    expect(val(map(crcl, o, patient, { thresholds: { creatinineDays: 14 } }), "creatinine")?.stale).toBe(false)
    expect(DEFAULT_STALE_THRESHOLDS).toEqual({ creatinineDays: 30, heightDays: 365, otherDays: 90 })
  })
  it("the observation date is always recorded", () => {
    for (const v of map(crcl, [obs(CREAT, 1, "mg/dL", "2026-10-20"), obs(WEIGHT, 70, "kg", "2026-10-21")]).values.filter((x) => x.source === "observation")) {
      expect(v.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof v.ageDays).toBe("number")
    }
  })
})

describe("missing data", () => {
  it("an empty record skips every FHIR-coded input and fills nothing", () => {
    const r = map(crcl, [], { resourceType: "Patient" })
    expect(r.values).toEqual([])
    expect(r.skipped.map((s) => s.inputId).sort()).toEqual(["age", "creatinine", "sex", "weight"])
  })
  it("inputs with no FHIR metadata are never touched", () => {
    const withExtra = { inputs: [...crcl.inputs, { id: "note", label: "Note", kind: "number" as const }] }
    const r = mapFhirToInputs(withExtra, { patient, observations: [] }, { today: TODAY })
    expect([...r.values, ...r.skipped].some((x) => x.inputId === "note")).toBe(false)
  })
  it("a full record fills every input of Cockcroft-Gault", () => {
    const r = map(crcl, [obs(CREAT, 88, "umol/L", "2026-10-20"), obs(WEIGHT, 70, "kg", "2026-10-21")])
    expect(r.values.map((v) => v.inputId).sort()).toEqual(["age", "creatinine", "sex", "weight"])
    expect(r.skipped).toEqual([])
  })
})
