// clinexia-upgrade:phase8 tests — guard rails for patient-facing wording. These do not replace a clinician's review.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { calculators } from "../calculators/registry"
import { CLINICAL_REVIEWS } from "./review"
import { PATIENT_DISCLAIMER, PATIENT_EXPLANATIONS, fillResult, getPatientExplanation } from "./patient-explanations"

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", ""))
afterEach(() => vi.unstubAllEnvs())

const syllables = (word: string) => {
  let w = word.toLowerCase().replace(/[^a-z]/g, "")
  if (w.length <= 3) return 1
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "")
  return Math.max(1, (w.match(/[aeiouy]{1,2}/g) ?? []).length)
}
/** Flesch-Kincaid grade level. */
export function gradeLevel(text: string): number {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w))
  const syl = words.reduce((n, w) => n + syllables(w), 0)
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59
}
const allText = (e: (typeof PATIENT_EXPLANATIONS)[number]) => [e.whatItIs, e.howToRead, e.limits, ...e.questions].join(" ")

describe("patient explanations: content rules", () => {
  it("each tool has one explanation, for a tool that exists (or is a gated new tool)", () => {
    const ids = PATIENT_EXPLANATIONS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    const known = new Set([...calculators.map((c) => c.id), "ldl-sampson"])
    for (const id of ids) expect(known.has(id), id).toBe(true)
  })
  it("each explanation has its own approval record, pending by default", () => {
    for (const e of PATIENT_EXPLANATIONS) expect(CLINICAL_REVIEWS[`patient:${e.id}`], e.id).toBeDefined()
  })
  it("reads at school grade 9 or lower, with short sentences", () => {
    for (const e of PATIENT_EXPLANATIONS) {
      expect(gradeLevel(allText(e)), `${e.id} grade`).toBeLessThanOrEqual(9)
      for (const s of allText(e).split(/[.?]+/)) expect(s.trim().split(/\s+/).length, `${e.id}: "${s.trim().slice(0, 40)}"`).toBeLessThanOrEqual(30)
    }
  })
  it("never gives a dose, a number of units, or an instruction about treatment", () => {
    const banned = [/\d+(\.\d+)?\s?(mg|mcg|µg|ml|mL|units?|iu|tablets?|pills?)\b/i, /\b(you should|you must|you need to|stop taking|start taking|do not take|increase your|decrease your|take your|skip your)\b/i, /\byou have (cancer|diabetes|kidney disease|heart disease|a stroke)\b/i]
    for (const e of PATIENT_EXPLANATIONS) for (const re of banned) expect(allText(e), `${e.id} ${re}`).not.toMatch(re)
  })
  it("explains what the number is and shows the person's own result", () => {
    for (const e of PATIENT_EXPLANATIONS) expect(e.whatItIs, e.id).toContain("{result}")
  })
  it("has 2 to 4 questions to ask a clinician, each ending in a question mark", () => {
    for (const e of PATIENT_EXPLANATIONS) { expect(e.questions.length, e.id).toBeGreaterThanOrEqual(2); expect(e.questions.length).toBeLessThanOrEqual(4); for (const q of e.questions) expect(q.endsWith("?"), q).toBe(true) }
  })
  it("the disclaimer says it is not advice and never to change medicine", () => {
    expect(PATIENT_DISCLAIMER).toMatch(/not medical advice/)
    expect(PATIENT_DISCLAIMER).toMatch(/Do not start, stop or change any medicine/)
  })
})

describe("patient explanations: release gate and rendering", () => {
  it("shows nothing until a clinician approves it", () => {
    for (const e of PATIENT_EXPLANATIONS) expect(getPatientExplanation(e.id, { display: "x" }), e.id).toBeNull()
  })
  it("renders in preview builds with the result filled in and the disclaimer always attached", () => {
    vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", "1")
    const r = getPatientExplanation("bmi", { display: "BMI: 24.2 kg/m²" })!
    expect(r.sections[0].text).toContain("BMI: 24.2 kg/m²")
    expect(r.sections[0].text).not.toContain("{result}")
    expect(r.disclaimer).toBe(PATIENT_DISCLAIMER)
    expect(r.copyText).toContain(PATIENT_DISCLAIMER)
  })
  it("falls back to value and unit, then to 'shown above'", () => {
    expect(fillResult("R: {result}", { value: 5, unit: "mmol/L" })).toBe("R: 5 mmol/L")
    expect(fillResult("R: {result}", {})).toBe("R: shown above")
  })
  it("a tool without an explanation returns null even in preview", () => {
    vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", "1")
    expect(getPatientExplanation("anion-gap", { display: "x" })).toBeNull()
  })
})
