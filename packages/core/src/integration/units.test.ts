import { describe, expect, it } from "vitest"
import { canonicalUnit, resolveUnit } from "./units"

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol
const input = (id: string, unit: string | undefined, label = id) => ({ id, label, unit })

describe("canonicalUnit", () => {
  it("folds case, spacing, the micro sign and UCUM spellings", () => {
    expect(canonicalUnit("µmol/L")).toBe("umol/L")
    expect(canonicalUnit("μMOL/l")).toBe("umol/L")
    expect(canonicalUnit(" mg/dl ")).toBe("mg/dL")
    expect(canonicalUnit("[lb_av]")).toBe("lb")
    expect(canonicalUnit("[in_i]")).toBe("in")
    expect(canonicalUnit("Cel")).toBe("C")
    expect(canonicalUnit("a")).toBe("years")
  })
  it("keeps an unknown unit as its folded spelling so identical spellings still match", () => {
    expect(canonicalUnit("mL/min/1.73 m²")).toBe(canonicalUnit("ML/MIN/1.73M²"))
  })
})

describe("resolveUnit: conversions through the lib/conversions engine", () => {
  it("creatinine umol/L -> mg/dL (molar mass 113.12 from the engine)", () => {
    const r = resolveUnit(input("creatinine", "mg/dL"), 88.4, "umol/L")
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(near(r.value, 1, 1e-3)).toBe(true)
      expect(r.conversion?.from).toEqual({ value: 88.4, unit: "umol/L" })
      expect(r.conversion?.to.unit).toBe("mg/dL")
    }
  })
  it("creatinine mg/dL -> umol/L for an input declared in umol/L", () => {
    const r = resolveUnit(input("creatinine", "µmol/L"), 1, "mg/dL")
    expect(r.ok && near(r.value, 88.4017, 1e-3)).toBe(true)
  })
  it("weight: lb and g -> kg", () => {
    const lb = resolveUnit(input("weight", "kg"), 154.32358, "lb")
    expect(lb.ok && near(lb.value, 70, 1e-4)).toBe(true)
    const g = resolveUnit(input("weight", "kg"), 70000, "g")
    expect(g.ok && g.value).toBe(70)
  })
  it("height: m, in, ft -> cm (inch and foot are exact)", () => {
    const m = resolveUnit(input("height", "cm"), 1.7, "m")
    expect(m.ok && near(m.value, 170)).toBe(true)
    const inch = resolveUnit(input("height", "cm"), 66, "in")
    expect(inch.ok && near(inch.value, 167.64)).toBe(true)
    const ft = resolveUnit(input("height", "cm"), 5.5, "ft")
    expect(ft.ok && near(ft.value, 167.64)).toBe(true)
  })
  it("glucose and calcium mmol/L -> mg/dL, albumin g/L -> g/dL", () => {
    const glu = resolveUnit(input("glucose", "mg/dL"), 5.5, "mmol/L")
    expect(glu.ok && near(glu.value, 99, 1e-6)).toBe(true)
    const ca = resolveUnit(input("calcium", "mg/dL"), 2.5, "mmol/L")
    expect(ca.ok && near(ca.value, 10.02, 1e-6)).toBe(true)
    const alb = resolveUnit(input("albumin", "g/dL"), 40, "g/L")
    expect(alb.ok && near(alb.value, 4)).toBe(true)
  })
  it("temperature F and K -> C", () => {
    const f = resolveUnit(input("temp", "°C"), 98.6, "F")
    expect(f.ok && near(f.value, 37, 1e-9)).toBe(true)
    const k = resolveUnit(input("temp", "°C"), 310.15, "K")
    expect(k.ok && near(k.value, 37, 1e-9)).toBe(true)
  })
  it("the same unit is passed through untouched with no conversion entry", () => {
    const r = resolveUnit(input("creatinine", "mg/dL"), 1.2, "MG/DL")
    expect(r).toEqual({ ok: true, value: 1.2 })
    expect(resolveUnit(input("age", "years"), 54, "a")).toEqual({ ok: true, value: 54 })
    expect(resolveUnit(input("x", "mL/min"), 5, "ml/min")).toEqual({ ok: true, value: 5 })
  })
})

describe("resolveUnit: refusals (nothing is guessed)", () => {
  it("unknown unit", () => {
    const r = resolveUnit(input("creatinine", "mg/dL"), 1, "furlongs")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe("unit_unknown")
  })
  it("incompatible family (weight given in cm)", () => {
    const r = resolveUnit(input("weight", "kg"), 70, "cm")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe("unit_mismatch")
  })
  it("mass <-> molar without a defined molar mass (BUN, albumin)", () => {
    for (const id of ["bun", "albumin"]) {
      const r = resolveUnit(input(id, "mg/dL"), 5, "mmol/L")
      expect(r.ok, id).toBe(false)
      if (!r.ok) expect(r.code).toBe("unit_unsupported")
    }
  })
  it("drug-dose style inputs are not converted (mg given in g)", () => {
    const r = resolveUnit(input("dose", "mg"), 1, "g")
    expect(r.ok).toBe(false)
  })
  it("an input with no fixed unit refuses any unit", () => {
    const r = resolveUnit(input("tc", undefined), 5, "mmol/L")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe("unit_unsupported")
  })
  it("messages never contain the value", () => {
    const r = resolveUnit(input("creatinine", "mg/dL"), 987654.321, "furlongs")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).not.toContain("987654")
  })
})
