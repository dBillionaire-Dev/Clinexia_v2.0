// clinexia-upgrade:phase4 tests — qSOFA, SOFA, PECARN.
// Reference for every expected value: the threshold tables in the sources named in ../evidence.ts
// (Sepsis-3 / Vincent 1996 for SOFA, Seymour 2016 for qSOFA, Kuppermann 2009 for PECARN). Tolerance: exact (integer scores).
import { describe, expect, it } from "vitest"
import { qsofaCalculator } from "./qsofa"
import { sofaCalculator, sofaCardiovascular, sofaCns, sofaCoagulation, sofaLiver, sofaRenal, sofaRespiration } from "./sofa"
import { pecarn2To17Calculator, pecarnUnder2Calculator } from "./pecarn"
import { ALL_CLINICAL_MODULES, getApprovedClinicalModules } from "./index"
import { CLINICAL_MODULE_REVIEWS, selectApproved, type ModuleReview } from "./review"
import { bloodVolumeCalculator, lemmensMlPerKg, nadlerLitres } from "./blood-volume"
import { SAMPSON_MAX_TG_MGDL, sampsonLdlCalculator, sampsonLdlMgDl } from "./sampson-ldl"

describe("approval gate", () => {
  it("ships exactly the tools whose record is approved (none while all are pending)", () => {
    const approvedIds = Object.entries(CLINICAL_MODULE_REVIEWS).filter(([, r]) => r.status === "approved").map(([id]) => id).sort()
    expect(getApprovedClinicalModules().map((m) => m.id).sort()).toEqual(approvedIds)
  })
  it("every tool has a review record, and only listed tools do", () => {
    expect(Object.keys(CLINICAL_MODULE_REVIEWS).sort()).toEqual(ALL_CLINICAL_MODULES.map((m) => m.id).sort())
  })
  it("selectApproved passes exactly the approved ones", () => {
    const ok: ModuleReview = { status: "approved", reviewer: "A", credentials: "MD", reviewedAt: "2026-11-01", scope: "x" }
    expect(selectApproved(ALL_CLINICAL_MODULES, { qsofa: ok }).map((m) => m.id)).toEqual(["qsofa"])
    expect(selectApproved(ALL_CLINICAL_MODULES, { qsofa: { status: "pending" } })).toEqual([])
    expect(selectApproved(ALL_CLINICAL_MODULES, {})).toEqual([])
  })
  it("every approved record names a reviewer, credentials and a real date", () => {
    for (const [id, r] of Object.entries(CLINICAL_MODULE_REVIEWS)) {
      if (r.status !== "approved") continue
      expect(r.reviewer.trim(), id).not.toBe("")
      expect(r.credentials.trim(), id).not.toBe("")
      expect(Number.isNaN(Date.parse(r.reviewedAt)), id).toBe(false)
    }
  })
  it("every tool has limitations and unique input ids", () => {
    for (const m of ALL_CLINICAL_MODULES) {
      expect(m.limitations?.length, m.id).toBeGreaterThan(0)
      expect(new Set(m.inputs.map((i) => i.id)).size, m.id).toBe(m.inputs.length)
    }
  })
})

describe("qSOFA", () => {
  const run = (rr: number, sbp: number, gcs: number) => qsofaCalculator.calculate({ respiratoryRate: rr, systolicBp: sbp, gcs })
  it.each([
    [21, 101, 15, 0], [22, 101, 15, 1], [21, 100, 15, 1], [21, 101, 14, 1],
    [22, 100, 15, 2], [22, 101, 14, 2], [21, 100, 14, 2], [22, 100, 14, 3],
  ])("rr=%i sbp=%i gcs=%i -> %i (boundaries: RR>=22, SBP<=100, GCS<15)", (rr, sbp, gcs, expected) => {
    expect(run(rr, sbp, gcs).value).toBe(expected)
  })
  it("calls 2 positive and 1 negative, and always carries the SSC caveat", () => {
    expect(run(22, 100, 15).display).toMatch(/positive/)
    expect(run(22, 101, 15).display).toMatch(/negative/)
    expect(run(22, 100, 15).warnings?.[0]).toMatch(/recommends against/)
  })
  it("rejects missing and non-integer GCS", () => {
    expect(() => qsofaCalculator.calculate({ respiratoryRate: 20, systolicBp: 120, gcs: "" })).toThrow()
    expect(() => run(20, 120, 14.5)).toThrow(/whole number/)
  })
})

describe("SOFA component tables", () => {
  it("respiration, including the 'needs respiratory support' rule for 3 and 4", () => {
    expect(sofaRespiration(400, 1, false)).toBe(0)
    expect(sofaRespiration(399, 1, false)).toBe(1)
    expect(sofaRespiration(299, 1, false)).toBe(2)
    expect(sofaRespiration(199, 1, true)).toBe(3)
    expect(sofaRespiration(199, 1, false)).toBe(2)
    expect(sofaRespiration(99, 1, true)).toBe(4)
    expect(sofaRespiration(99, 1, false)).toBe(2)
    expect(sofaRespiration(80, 0.4, false)).toBe(2) // ratio 200: not below 200
  })
  it("coagulation", () => {
    expect([150, 149, 100, 99, 50, 49, 20, 19].map(sofaCoagulation)).toEqual([0, 1, 1, 2, 2, 3, 3, 4])
  })
  it("liver, with the unassigned boundaries scored in the higher category", () => {
    expect([1.19, 1.2, 1.9, 1.95, 2.0, 5.9, 5.99, 6.0, 11.9, 11.99, 12.0].map(sofaLiver)).toEqual([0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4])
  })
  it("cns", () => expect([15, 14, 13, 12, 10, 9, 6, 5, 3].map(sofaCns)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]))
  it("cardiovascular takes the worse of MAP and drugs", () => {
    expect(sofaCardiovascular(70, "none")).toBe(0)
    expect(sofaCardiovascular(69, "none")).toBe(1)
    expect(sofaCardiovascular(90, "tier2")).toBe(2)
    expect(sofaCardiovascular(60, "tier3")).toBe(3)
    expect(sofaCardiovascular(undefined, "tier4")).toBe(4)
  })
  it("renal takes the worse of creatinine and urine output", () => {
    expect([1.19, 1.2, 1.99, 2.0, 3.49, 3.5, 4.99, 5.0].map((c) => sofaRenal(c, undefined))).toEqual([0, 1, 1, 2, 2, 3, 3, 4])
    expect(sofaRenal(1.0, 499)).toBe(3)
    expect(sofaRenal(1.0, 199)).toBe(4)
    expect(sofaRenal(1.0, 500)).toBe(0)
    expect(sofaRenal(4.0, 100)).toBe(4)
  })
})

describe("SOFA calculator", () => {
  it("sums the scored systems and reports how many were scored", () => {
    const r = sofaCalculator.calculate({ platelets: 45, bilirubin: 7, bilirubinUnit: "mgdl", gcs: 12 })
    expect(r.value).toBe(3 + 3 + 2)
    expect(r.display).toMatch(/3 of 6 systems/)
    expect(r.warnings?.[0]).toMatch(/not assumed normal/)
  })
  it("a full set of six has no partial warning (worked example, total 11)", () => {
    const r = sofaCalculator.calculate({
      pao2: 70, fio2: 0.5, support: "yes",      // ratio 140, ventilated -> 3
      platelets: 90,                             // 2
      bilirubin: 3, bilirubinUnit: "mgdl",       // 2
      map: 65, cardioSupport: "tier3",           // 3
      gcs: 14,                                   // 1
      creatinine: 2.5, creatinineUnit: "mgdl",   // 2   -> 13
    })
    expect(r.value).toBe(3 + 2 + 2 + 3 + 1 + 2)
    expect(r.warnings).toBeUndefined()
  })
  it("converts µmol/L explicitly: 171 µmol/L creatinine is about 1.93 mg/dL -> 1; 177 -> 2.0 -> 2", () => {
    expect(sofaCalculator.calculate({ creatinine: 171, creatinineUnit: "umol" }).value).toBe(1)
    expect(sofaCalculator.calculate({ creatinine: 177, creatinineUnit: "umol" }).value).toBe(2)
  })
  it("refuses to guess units, pairs or an empty form", () => {
    expect(() => sofaCalculator.calculate({ creatinine: 150 })).toThrow(/unit/)
    expect(() => sofaCalculator.calculate({ bilirubin: 20 })).toThrow(/unit/)
    expect(() => sofaCalculator.calculate({ pao2: 80 })).toThrow(/both/)
    expect(() => sofaCalculator.calculate({ pao2: 80, fio2: 0.4 })).toThrow(/ventilatory support/)
    expect(() => sofaCalculator.calculate({})).toThrow(/at least one/)
  })
  it("every field is optional and nothing has a hidden default", () => {
    expect(sofaCalculator.inputs.every((i) => i.optional)).toBe(true)
    expect(sofaCalculator.inputs.some((i) => i.defaultValue !== undefined)).toBe(false)
  })
})

describe("PECARN", () => {
  const ok = { blunt: "yes", gcs: "15", exclusion: "no" }
  const under2 = (o: Record<string, string>) => pecarnUnder2Calculator.calculate({ ...ok, otherAms: "no", palpableFracture: "no", nonFrontalHematoma: "no", loc5s: "no", severeMechanism: "no", notActingNormally: "no", ...o })
  const over2 = (o: Record<string, string>) => pecarn2To17Calculator.calculate({ ...ok, otherAms: "no", basilarFracture: "no", loc: "no", vomiting: "no", severeHeadache: "no", severeMechanism: "no", ...o })

  it("<2y: none -> very low (<0.02%), CT not recommended", () => {
    const r = under2({})
    expect(r.value).toBe("Very-low-risk group")
    expect(JSON.stringify(r.secondary)).toMatch(/below 0\.02%/)
  })
  it.each([["palpableFracture"], ["otherAms"]])("<2y: %s -> high (about 4.4%)", (k) => {
    expect(under2({ [k]: "yes" }).value).toBe("High-risk group")
    expect(JSON.stringify(under2({ [k]: "yes" }).secondary)).toMatch(/4\.4%/)
  })
  it("<2y: GCS 14 alone -> high", () => expect(under2({ gcs: "14" }).value).toBe("High-risk group"))
  it.each([["nonFrontalHematoma"], ["loc5s"], ["severeMechanism"], ["notActingNormally"]])("<2y: %s alone -> intermediate (about 0.9%)", (k) => {
    expect(under2({ [k]: "yes" }).value).toBe("Intermediate-risk group")
  })
  it("<2y: a high-risk finding wins over intermediate ones", () => expect(under2({ palpableFracture: "yes", loc5s: "yes" }).value).toBe("High-risk group"))

  it("2-17y: none -> very low (<0.05%)", () => {
    const r = over2({})
    expect(r.value).toBe("Very-low-risk group")
    expect(JSON.stringify(r.secondary)).toMatch(/below 0\.05%/)
  })
  it.each([["basilarFracture"], ["otherAms"]])("2-17y: %s -> high (about 4.3%)", (k) => {
    expect(JSON.stringify(over2({ [k]: "yes" }).secondary)).toMatch(/4\.3%/)
  })
  it.each([["loc"], ["vomiting"], ["severeHeadache"], ["severeMechanism"]])("2-17y: %s alone -> intermediate", (k) => {
    expect(over2({ [k]: "yes" }).value).toBe("Intermediate-risk group")
  })

  it.each([
    [{ blunt: "no" }, /blunt head trauma/],
    [{ gcs: "below14" }, /GCS 14 to 15/],
    [{ exclusion: "yes" }, /exclusion/],
  ])("gives NO result outside the rule's population: %j", (override, message) => {
    expect(() => under2(override)).toThrow(message)
    expect(() => over2(override)).toThrow(message)
  })
  it("never defaults an unanswered question to 'no'", () => {
    expect(() => pecarnUnder2Calculator.calculate({ ...ok })).toThrow()
    expect(pecarnUnder2Calculator.inputs.some((i) => i.defaultValue !== undefined)).toBe(false)
  })
  it("mentions CT only as what the rule says, and never as an order", () => {
    expect(under2({ palpableFracture: "yes" }).interpretation).toMatch(/does not replace clinical judgement|supports, and does not replace/)
  })
})

describe("Sampson LDL", () => {
  // Independent form of the published equation (different grouping) so a typo in the tool cannot hide.
  const ref = (tc: number, hdl: number, tg: number) => {
    const non = tc - hdl
    return tc * (1 / 0.948) - hdl * (1 / 0.971) - tg * (1 / 8.56) - (tg * non) / 2140 + (tg * tg) / 16100 - 9.44
  }
  it("matches the published worked example: TC 200, HDL 50, TG 150 mg/dL -> about 123 mg/dL", () => {
    const out = sampsonLdlCalculator.calculate({ unit: "mg/dL", tc: 200, hdl: 50, tg: 150 })
    expect(out.value).toBeCloseTo(123.4, 1)
    expect(Math.abs(sampsonLdlMgDl(200, 50, 150) - 123)).toBeLessThan(0.5)
  })
  it.each([[180, 40, 120], [250, 35, 600], [150, 60, 90], [300, 30, 800]])("matches the independent form (TC %i, HDL %i, TG %i)", (tc, hdl, tg) => {
    expect(Math.abs(Number(sampsonLdlCalculator.calculate({ unit: "mg/dL", tc, hdl, tg }).value) - ref(tc, hdl, tg))).toBeLessThan(0.1)
  })
  it("converts mmol/L on the way in and out: the same sample gives the same LDL", () => {
    const mg = Number(sampsonLdlCalculator.calculate({ unit: "mg/dL", tc: 200, hdl: 50, tg: 150 }).value)
    const mmol = Number(sampsonLdlCalculator.calculate({ unit: "mmol/L", tc: 200 / 38.67, hdl: 50 / 38.67, tg: 150 / 88.57 }).value)
    expect(Math.abs(mmol * 38.67 - mg)).toBeLessThan(0.5)
  })
  it("allows triglycerides of exactly 800 mg/dL and refuses anything above, in either unit", () => {
    expect(() => sampsonLdlCalculator.calculate({ unit: "mg/dL", tc: 250, hdl: 35, tg: SAMPSON_MAX_TG_MGDL })).not.toThrow()
    expect(() => sampsonLdlCalculator.calculate({ unit: "mg/dL", tc: 250, hdl: 35, tg: 800.1 })).toThrow(/direct LDL/)
    expect(() => sampsonLdlCalculator.calculate({ unit: "mmol/L", tc: 6.5, hdl: 0.9, tg: 9.04 })).toThrow(/direct LDL/)
    expect(() => sampsonLdlCalculator.calculate({ unit: "mmol/L", tc: 6.5, hdl: 0.9, tg: 9.03 })).not.toThrow()
  })
  it("never assumes a unit and rejects impossible input", () => {
    expect(() => sampsonLdlCalculator.calculate({ tc: 200, hdl: 50, tg: 150 })).toThrow(/unit/)
    expect(() => sampsonLdlCalculator.calculate({ unit: "mg/dL", tc: 100, hdl: 150, tg: 100 })).toThrow(/HDL cannot be higher/)
    expect(sampsonLdlCalculator.inputs.some((i) => i.defaultValue !== undefined)).toBe(false)
  })
})

describe("Blood volume", () => {
  const run = (o: Record<string, string | number>) => bloodVolumeCalculator.calculate({ ageYears: 40, ...o })
  it("Nadler, man 180 cm 80 kg: 5319 mL (published worked example, 5.319 L)", () => {
    expect(run({ method: "nadler", sex: "male", heightCm: 180, weightKg: 80 }).value).toBe(5319)
    expect(nadlerLitres("male", 1.8, 80)).toBeCloseTo(5.319, 3)
  })
  it("Nadler, woman 165 cm 60 kg: 3768 mL (3.768 L)", () => {
    expect(run({ method: "nadler", sex: "female", heightCm: 165, weightKg: 60 }).value).toBe(3768)
  })
  it("Lemmens: 70 / sqrt(BMI/22) mL/kg, checked against an independent calculation", () => {
    const bmi = 80 / 1.8 ** 2
    const expected = (70 / Math.sqrt(bmi / 22)) * 80
    expect(Math.abs(Number(run({ method: "lemmens", heightCm: 180, weightKg: 80 }).value) - expected)).toBeLessThan(1)
    expect(lemmensMlPerKg(1.8, 80)).toBeCloseTo(70 / Math.sqrt(bmi / 22), 6)
  })
  it("PCV 40%: red cell volume is 40% and plasma volume 60% of the total", () => {
    const out = run({ method: "nadler", sex: "male", heightCm: 180, weightKg: 80, pcv: 40 })
    const get = (label: string) => out.secondary!.find((s) => s.label === label)!.value
    expect(get("Red cell volume")).toBe("2128 mL")
    expect(get("Plasma volume")).toBe("3191 mL")
    expect(out.warnings?.[0]).toMatch(/approximate/)
  })
  it("gives no red cell or plasma volume without a PCV", () => {
    const out = run({ method: "nadler", sex: "male", heightCm: 180, weightKg: 80 })
    expect(out.secondary!.map((s) => s.label)).toEqual(["Per kg"])
  })
  it("Nadler without a sex is refused; Lemmens does not need one; no method is refused", () => {
    expect(() => run({ method: "nadler", heightCm: 180, weightKg: 80 })).toThrow(/sex/)
    expect(() => run({ method: "lemmens", heightCm: 180, weightKg: 80 })).not.toThrow()
    expect(() => run({ heightCm: 180, weightKg: 80 })).toThrow(/method/i)
  })
  it("is adult-only and has no hidden defaults", () => {
    expect(bloodVolumeCalculator.inputs.find((i) => i.id === "ageYears")!.min).toBe(18)
    expect(bloodVolumeCalculator.inputs.some((i) => i.defaultValue !== undefined)).toBe(false)
  })
})
