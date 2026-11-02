// clinexia-upgrade:phase2 tests — validation, bands, review gate, evidence, guided scoring, synonyms.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { calculators, getCalculatorById } from "../calculators/registry"
import { auditBands, findBand } from "./interpretation"
import { parseStrictNumber, validateInputs } from "./input-validation"
import { allEvidence, getEvidence, lookupBand } from "./evidence"
import { CLINICAL_REVIEWS, isReleased } from "./review"
import { GUIDED_CALCULATORS, UNKNOWN, buildGuidedSteps, evaluateGuided, formatScoreRange, isGuidedEligible } from "./guided"

// These tests describe the DEFAULT (hidden) state, so they must not depend on how the suite was launched.
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", ""))
afterEach(() => vi.unstubAllEnvs())

describe("parseStrictNumber", () => {
  it.each(["12", "-3.5", ".5", "1e3", " 7 "])("accepts %s", (t) => expect(parseStrictNumber(t)).not.toBeNull())
  it.each(["", "abc", "0x10", "Infinity", "NaN", "1,000", "1 2", "--1"])("rejects %s", (t) => expect(parseStrictNumber(t)).toBeNull())
  it("rejects non-finite numbers", () => {
    expect(parseStrictNumber(Number.NaN)).toBeNull()
    expect(parseStrictNumber(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe("validateInputs", () => {
  const def = getCalculatorById("cha2ds2-vasc")!
  const good = { chf: "no", hypertension: "no", age: "70", diabetes: "no", stroke: "no", vascular: "no", sex: "male" }
  it("accepts a complete valid set", () => expect(validateInputs(def, good)).toEqual([]))
  it("reports every problem at once", () => {
    const codes = validateInputs(def, { ...good, age: "17", sex: "other", chf: "" }).map((i) => i.code).sort()
    expect(codes).toEqual(["below-min", "invalid-option", "required"])
  })
  it("rejects a non-numeric age instead of coercing it", () => {
    expect(validateInputs(def, { ...good, age: "0x40" })[0].code).toBe("not-a-number")
  })
  it("never raises an issue for a valid sample of ANY registered calculator (no regressions)", () => {
    for (const c of calculators) {
      const values: Record<string, string> = {}
      for (const i of c.inputs) {
        if (i.kind === "select") values[i.id] = i.options![0].value
        else if (i.kind === "date") values[i.id] = "2025-06-15"
        else {
          const lo = i.min ?? 0, hi = i.max ?? Number.MAX_SAFE_INTEGER
          values[i.id] = String(Math.min(Math.max(1, lo), hi))
        }
      }
      expect(validateInputs(c, values), c.id).toEqual([])
    }
  })
})

describe("interpretation bands", () => {
  const bands = [
    { id: "a", min: 0, max: 1, label: "a", meaning: "", sourceIds: [] },
    { id: "b", min: 2, max: 3, label: "b", meaning: "", sourceIds: [] },
  ]
  it("finds the matching band", () => expect(findBand(bands, 2)?.id).toBe("b"))
  it("returns null outside every band instead of the nearest one", () => expect(findBand(bands, 4)).toBeNull())
  it("returns null for NaN", () => expect(findBand(bands, Number.NaN)).toBeNull())
  it("returns null when two bands overlap (ambiguous)", () => {
    expect(findBand([...bands, { ...bands[0], id: "c", min: 1, max: 2 }], 1)).toBeNull()
  })
  it("auditBands reports gaps and overlaps", () => {
    expect(auditBands(bands, { min: 0, max: 3 })).toEqual([])
    expect(auditBands(bands, { min: 0, max: 4 })).toHaveLength(1)
  })
})

describe("clinical review gate", () => {
  it("withholds everything that is pending by default", () => {
    for (const key of Object.keys(CLINICAL_REVIEWS)) {
      if (CLINICAL_REVIEWS[key].status === "pending") expect(isReleased(key), key).toBe(false)
    }
  })
  it("releases pending content only in preview mode", () => {
    vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", "1")
    expect(isReleased("has-bled:bands")).toBe(true)
  })
  it("never releases an unknown key, even in preview mode", () => {
    vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", "1")
    expect(isReleased("not-a-real-key")).toBe(false)
  })
  it("every approved record names a reviewer, credentials and a real date", () => {
    for (const [key, state] of Object.entries(CLINICAL_REVIEWS)) {
      if (state.status !== "approved") continue
      expect(state.reviewer.trim(), key).not.toBe("")
      expect(state.credentials.trim(), key).not.toBe("")
      expect(Number.isNaN(Date.parse(state.reviewedAt)), key).toBe(false)
    }
  })
})

describe("evidence records", () => {
  it("every source link is an https URL with a title and a citation", () => {
    for (const record of allEvidence()) {
      expect(record.sources.length, record.calculatorId).toBeGreaterThan(0)
      for (const s of record.sources) {
        expect(s.url).toMatch(/^https:\/\//)
        expect(s.title.length).toBeGreaterThan(5)
        expect(s.citation.length).toBeGreaterThan(10)
      }
    }
  })
  it("every band cites a source that exists", () => {
    for (const record of allEvidence()) for (const b of record.bands ?? []) for (const i of b.sourceIds) expect(record.sources[i], `${record.calculatorId}:${b.id}`).toBeDefined()
  })
  it("CHA2DS2-VASc bands cover every score 0-9 exactly once for each sex", () => {
    const bands = getEvidence("cha2ds2-vasc")!.bands!
    expect(auditBands(bands, { min: 0, max: 9 }, [{ sex: "male" }, { sex: "female" }])).toEqual([])
  })
  it("HAS-BLED bands cover 0-9 exactly once", () => {
    expect(auditBands(getEvidence("has-bled")!.bands!, { min: 0, max: 9 })).toEqual([])
  })
  it("bands are withheld (not hidden silently) until reviewed", () => {
    expect(lookupBand("cha2ds2-vasc", 2, { sex: "male" })).toEqual({ band: null, withheld: true })
    vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", "1")
    expect(lookupBand("cha2ds2-vasc", 2, { sex: "male" }).band?.id).toBe("at-male")
    expect(lookupBand("cha2ds2-vasc", 2, { sex: "female" }).band?.id).toBe("below-female")
    expect(lookupBand("cha2ds2-vasc", 3, { sex: "female" }).band?.id).toBe("at-female")
    expect(lookupBand("cha2ds2-vasc", 1, { sex: "male" }).band?.id).toBe("below-male")
  })
  it("no band is returned when the sex is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", "1")
    expect(lookupBand("cha2ds2-vasc", 2, {}).band).toBeNull()
  })
  it("a tool with no evidence record has no band and nothing withheld", () => {
    expect(lookupBand("bmi", 20)).toEqual({ band: null, withheld: false })
  })
})

describe("guided scoring", () => {
  it("only allow-listed tools are eligible, and they all exist", () => {
    for (const id of Object.keys(GUIDED_CALCULATORS)) expect(isGuidedEligible(getCalculatorById(id)), id).toBe(true)
    expect(isGuidedEligible(getCalculatorById("bmi"))).toBe(false)
    expect(isGuidedEligible(undefined)).toBe(false)
  })

  // The range logic is only valid if "yes" never lowers a score. Prove it for every combination.
  it.each(Object.keys(GUIDED_CALCULATORS))("%s: answering yes never lowers the score (exhaustive)", (id) => {
    const def = getCalculatorById(id)!
    const unknownIds = GUIDED_CALCULATORS[id].unknownAllowed
    const fixedSets: Record<string, string>[] = id === "cha2ds2-vasc"
      ? [{ age: "30", sex: "male" }, { age: "70", sex: "female" }, { age: "80", sex: "male" }]
      : id === "dapt-score" ? [{ age: "50" }, { age: "70" }, { age: "80" }] : [{}]
    for (const fixed of fixedSets) {
      const score = (mask: number) => {
        const a: Record<string, string> = { ...fixed }
        unknownIds.forEach((k, i) => (a[k] = mask & (1 << i) ? "yes" : "no"))
        for (const input of def.inputs) if (a[input.id] === undefined) a[input.id] = input.options?.[0].value ?? "1"
        return def.calculate(a).value as number
      }
      for (let m = 0; m < 1 << unknownIds.length; m += 1) {
        for (let i = 0; i < unknownIds.length; i += 1) expect(score(m | (1 << i))).toBeGreaterThanOrEqual(score(m))
      }
    }
  })

  const def = getCalculatorById("cha2ds2-vasc")!
  const base = { chf: "no", hypertension: "no", age: "70", diabetes: "no", stroke: "no", vascular: "no", sex: "female" }
  it("is incomplete until every question is answered", () => {
    const { age, ...rest } = base
    expect(evaluateGuided(def, rest)).toMatchObject({ complete: false, missing: ["age"] })
  })
  it("gives a definitive score when nothing is unknown", () => {
    const r = evaluateGuided(def, base)
    expect(r.definitive?.value).toBe(2) // age 65-74 (1) + female (1)
    expect(r.low).toBeUndefined()
  })
  it("gives a range, never a single number, when something is unknown", () => {
    const r = evaluateGuided(def, { ...base, hypertension: UNKNOWN, diabetes: UNKNOWN })
    expect(r.definitive).toBeUndefined()
    expect(formatScoreRange(r.low!, r.high!)).toBe("2 to 4")
    expect(r.unknownIds.sort()).toEqual(["diabetes", "hypertension"])
  })
  it("does not allow unknown for age or sex", () => {
    const steps = buildGuidedSteps(def)
    expect(steps.find((s) => s.input.id === "age")!.allowUnknown).toBe(false)
    expect(evaluateGuided(def, { ...base, sex: UNKNOWN }).complete).toBe(false)
  })
  it("rejects an out-of-range age instead of scoring it", () => {
    const r = evaluateGuided(def, { ...base, age: "5" })
    expect(r.complete).toBe(false)
    expect(r.issues[0]).toMatch(/at least 18/)
  })
})

