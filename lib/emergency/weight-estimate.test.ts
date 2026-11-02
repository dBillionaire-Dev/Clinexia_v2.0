// clinexia-upgrade:phase9 tests — worked by hand from the formulas in weight-estimate.ts (exact integers).
// They guard arithmetic and limits. They do not say the formulas are right for any given child.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ESTIMATE_SOURCES, ESTIMATE_WARNINGS, estimateWeights } from "./weight-estimate"
import { WEIGHT_LIMITS } from "./dose-data"
import { isReleased } from "../clinical/review"

const ok = (y: number, m: number) => {
  const r = estimateWeights(y, m)
  if (!r.ok) throw new Error(r.error)
  return r
}
const kgs = (y: number, m: number) => ok(y, m).estimates.map((e) => e.kg)

describe("estimates by age (hand-calculated)", () => {
  it.each([[1, 4.5], [6, 7], [11, 9.5]])("infant of %i months: APLS 0.5 x months + 4 = %f kg", (months, kg) => expect(kgs(0, months)).toEqual([kg]))
  it("1 year: APLS 2x1+8 = 10 and Luscombe 3x1+7 = 10", () => expect(kgs(1, 0)).toEqual([10, 10]))
  it("3 years: APLS 14, Luscombe 16, and the 2 kg disagreement is reported", () => {
    expect(kgs(3, 0)).toEqual([14, 16])
    expect(ok(3, 0).differenceKg).toBe(2)
    expect(ok(3, 0).warnings[0]).toMatch(/differ by 2 kg/)
  })
  it("5 years: APLS 18, Luscombe 22", () => expect(kgs(5, 0)).toEqual([18, 22]))
  it("6 to 10 years: one formula, 3 x years + 7 (6y = 25 kg, 10y = 37 kg), labelled as both", () => {
    expect(kgs(6, 0)).toEqual([25]); expect(kgs(10, 0)).toEqual([37])
    expect(ok(6, 0).estimates[0].id).toBe("both")
    expect(ok(6, 0).differenceKg).toBeNull()
  })
  it("11 and 12 years: APLS only (40 and 43 kg), Luscombe not offered", () => {
    expect(kgs(11, 0)).toEqual([40]); expect(kgs(12, 0)).toEqual([43])
    expect(ok(11, 0).estimates[0].label).toMatch(/not intended above 10/)
  })
  it("uses completed years: 12 years 11 months is still 43 kg; 3y 11m is still 14/16", () => {
    expect(kgs(12, 11)).toEqual([43]); expect(kgs(3, 11)).toEqual([14, 16])
  })
  it("12 months (1y 0m) continues smoothly from 11 months (9.5 to 10 kg)", () => expect(kgs(1, 0)[0] - kgs(0, 11)[0]).toBe(0.5))
})

describe("limits: no estimate where the formulas do not apply", () => {
  it.each([[0, 0], [13, 0], [20, 3]])("%i years %i months gives no estimate", (y, m) => expect(estimateWeights(y, m).ok).toBe(false))
  it("says to weigh a baby under 1 month", () => {
    const r = estimateWeights(0, 0); expect(!r.ok && r.error).toMatch(/Weigh the baby/)
  })
  it.each([[-1, 0], [1, 12], [1, -1], [1.5, 0], [Number.NaN, 0], ["3", 0], [null, 0]])("rejects bad input %j %j", (y, m) => expect(estimateWeights(y as number, m as number).ok).toBe(false))
  it("every estimate falls inside the pediatric weight range used by Emergency Mode", () => {
    for (let y = 0; y <= 12; y++) for (let m = 0; m <= 11; m++) {
      const r = estimateWeights(y, m)
      if (!r.ok) continue
      for (const e of r.estimates) { expect(e.kg).toBeGreaterThanOrEqual(WEIGHT_LIMITS.pediatric.min); expect(e.kg).toBeLessThanOrEqual(WEIGHT_LIMITS.pediatric.max) }
    }
  })
})

describe("warnings and sources are always present", () => {
  it("every estimate carries all the standing warnings", () => {
    for (const w of ESTIMATE_WARNINGS) expect(ok(4, 0).warnings).toContain(w)
  })
  it("the warnings name over-estimation and measured weight", () => {
    const text = ESTIMATE_WARNINGS.join(" ")
    expect(text).toMatch(/over-estimate/); expect(text).toMatch(/measured weight/)
  })
  it("every estimate cites sources that exist, and links are https", () => {
    for (let y = 0; y <= 12; y++) { const r = estimateWeights(y, y === 0 ? 3 : 0); if (r.ok) for (const e of r.estimates) for (const s of e.sourceIds) expect(ESTIMATE_SOURCES[s], `${y}y`).toBeDefined() }
    for (const s of ESTIMATE_SOURCES) expect(s.url).toMatch(/^https:\/\//)
  })
})

describe("release gate", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", ""))
  afterEach(() => vi.unstubAllEnvs())
  it("is hidden until a clinician approves it, separately from the doses themselves", () => expect(isReleased("emergency-weight-estimation")).toBe(false))
})
