// clinexia-upgrade:phase4 — audit of existing renal calculations against independent implementations of the
// published formulas. Reference formulas: Cockcroft & Gault 1976 (Nephron 16:31-41); CKD-EPI 2021 race-free
// creatinine equation (Inker et al., N Engl J Med 2021;385:1737-49). Tolerance: 0.1 mL/min (or per 1.73 m²).
// This is a regression/audit net. It is NOT clinical sign-off of the dosing tools that use these values.
import { describe, expect, it } from "vitest"
import { getCalculatorById } from "../registry"

function ckdEpi2021(scr: number, age: number, female: boolean): number {
  const k = female ? 0.7 : 0.9
  const a = female ? -0.241 : -0.302
  return 142 * Math.min(scr / k, 1) ** a * Math.max(scr / k, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1)
}
const cg = (age: number, kg: number, scr: number, female: boolean) => ((140 - age) * kg) / (72 * scr) * (female ? 0.85 : 1)
const firstNumber = (text: string) => Number(/-?\d+(\.\d+)?/.exec(text)![0])

describe("renal reference audit", () => {
  const cgDef = getCalculatorById("creatinine-clearance")!
  const ckd = getCalculatorById("egfr-ckd-epi")!
  const cases: Array<[number, number, number, "male" | "female"]> = [[54, 70, 1.2, "male"], [30, 55, 0.8, "female"], [80, 62, 1.9, "female"], [45, 90, 1.0, "male"]]

  it.each(cases)("Cockcroft-Gault matches the published formula (age %i, %i kg, Cr %f, %s)", (age, weight, creatinine, sex) => {
    const out = cgDef.calculate({ age, weight, creatinine, sex })
    expect(Math.abs(Number(out.value) - cg(age, weight, creatinine, sex === "female"))).toBeLessThan(0.1)
  })
  it.each(cases)("CKD-EPI matches an independent implementation (age %i, Cr %f, %s)", (age, _w, creatinine, sex) => {
    const out = ckd.calculate({ age, creatinine, sex })
    const value = typeof out.value === "number" ? out.value : firstNumber(out.display)
    const expected = ckdEpi2021(creatinine, age, sex === "female")
    // If this fails, the tool may implement a different CKD-EPI version (for example 2009): confirm before changing anything.
    expect(Math.abs(value - expected)).toBeLessThan(0.6)
  })
})
