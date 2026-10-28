import { describe, expect, it } from "vitest"
import type { CalculatorDefinition } from "../calculators/types"
import { getCalculatorById } from "../calculators/registry"
import { defaultUnitResolver, parseInputValue, parsePrefill, type UnitResolver } from "./prefill"

const def: CalculatorDefinition = {
  id: "t",
  name: "T",
  category: "general",
  description: "t",
  inputs: [
    { id: "age", label: "Age", kind: "number", unit: "years", min: 0, max: 120 },
    { id: "weight", label: "Weight", kind: "number", unit: "kg", min: 0 },
    { id: "creatinine", label: "Creatinine", kind: "number", unit: "mg/dL", min: 0 },
    { id: "sex", label: "Sex", kind: "select", options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }] },
    { id: "visit", label: "Visit", kind: "date" },
  ],
  calculate: () => ({ value: 1, display: "1" }),
}

describe("parsePrefill", () => {
  it("applies valid values and canonicalises numbers", () => {
    const r = parsePrefill(def, new URLSearchParams("age=54&weight=70.50&creatinine=1.2&sex=male"))
    expect(r.values).toEqual({ age: "54", weight: "70.5", creatinine: "1.2", sex: "male" })
    expect(r.applied).toEqual(["age", "weight", "creatinine", "sex"])
    expect(r.calculate).toBe(false)
  })

  it("never auto-calculates unless calculate=1 (or true)", () => {
    expect(parsePrefill(def, new URLSearchParams("age=54")).calculate).toBe(false)
    expect(parsePrefill(def, new URLSearchParams("age=54&calculate=0")).calculate).toBe(false)
    expect(parsePrefill(def, new URLSearchParams("age=54&calculate=yes")).calculate).toBe(false)
    expect(parsePrefill(def, new URLSearchParams("age=54&calculate=1")).calculate).toBe(true)
    expect(parsePrefill(def, new URLSearchParams("calculate=true")).calculate).toBe(true)
  })

  it("ignores out-of-range numbers", () => {
    const r = parsePrefill(def, new URLSearchParams("age=500&weight=-3&creatinine=1.1"))
    expect(r.values).toEqual({ creatinine: "1.1" })
    expect(r.ignored).toEqual(expect.arrayContaining(["age", "weight"]))
  })

  it("ignores malformed numbers (hex, exponent, commas, text, empty, Infinity)", () => {
    for (const bad of ["0x10", "1e3", "1,2", "abc", "", " ", "Infinity", "NaN", "--1", "1.2.3"]) {
      expect(parseInputValue(def.inputs[0], bad)).toBeNull()
    }
  })

  it("ignores over-long values", () => {
    expect(parseInputValue(def.inputs[0], "1".repeat(200))).toBeNull()
  })

  it("ignores unknown params silently and reports only their names", () => {
    const r = parsePrefill(def, new URLSearchParams("age=54&mrn=12345&patient=Jane"))
    expect(r.values).toEqual({ age: "54" })
    expect(r.ignored).toEqual(expect.arrayContaining(["mrn", "patient"]))
    expect(JSON.stringify(r.ignored)).not.toContain("12345")
    expect(JSON.stringify(r.ignored)).not.toContain("Jane")
  })

  it("accepts select values exactly, case-insensitively, and rejects anything else", () => {
    expect(parsePrefill(def, new URLSearchParams("sex=female")).values.sex).toBe("female")
    expect(parsePrefill(def, new URLSearchParams("sex=FEMALE")).values.sex).toBe("female")
    expect(parsePrefill(def, new URLSearchParams("sex=other")).values.sex).toBeUndefined()
    expect(parsePrefill(def, new URLSearchParams("sex=Male%20")).values.sex).toBe("male")
  })

  it("validates dates as real calendar dates", () => {
    expect(parsePrefill(def, new URLSearchParams("visit=2026-02-28")).values.visit).toBe("2026-02-28")
    expect(parsePrefill(def, new URLSearchParams("visit=2026-02-30")).values.visit).toBeUndefined()
    expect(parsePrefill(def, new URLSearchParams("visit=28/02/2026")).values.visit).toBeUndefined()
  })

  it("takes the first value of a repeated param and reads plain objects (server searchParams)", () => {
    expect(parsePrefill(def, new URLSearchParams("age=40&age=50")).values.age).toBe("40")
    expect(parsePrefill(def, { age: ["41", "99"], sex: "male", x: undefined }).values).toEqual({ age: "41", sex: "male" })
  })

  it("does not read inherited object properties", () => {
    const r = parsePrefill(def, {} as Record<string, string>)
    expect(r.values).toEqual({})
  })

  it("reads view params: theme, postMessage, parentOrigin", () => {
    const r = parsePrefill(def, new URLSearchParams("theme=dark&postMessage=1&parentOrigin=https%3A%2F%2Femr.example.org%2Fpath"))
    expect(r.theme).toBe("dark")
    expect(r.postMessage).toBe(true)
    expect(r.parentOrigin).toBe("https://emr.example.org")
    const bad = parsePrefill(def, new URLSearchParams("theme=blue&postMessage=true&parentOrigin=javascript:alert(1)"))
    expect(bad.theme).toBeNull()
    expect(bad.postMessage).toBe(false)
    expect(bad.parentOrigin).toBeNull()
  })
})

describe("unit-aware params (parser hook)", () => {
  it("accepts a unit equal to the input's own unit, ignoring case and spacing", () => {
    expect(parsePrefill(def, new URLSearchParams("creatinine=1.2&creatinine_unit=MG/dL")).values.creatinine).toBe("1.2")
    expect(parsePrefill(def, new URLSearchParams("weight=70&weight_unit=kg")).values.weight).toBe("70")
  })

  it("the default resolver does not guess: another unit is ignored", () => {
    const r = parsePrefill(def, new URLSearchParams("creatinine=88&creatinine_unit=umol/L"))
    expect(r.values.creatinine).toBeUndefined()
    expect(r.ignored).toContain("creatinine")
    expect(r.ignored).not.toContain("creatinine_unit")
  })

  it("uses a custom resolver (what Phase 2 plugs in) and range-checks AFTER conversion", () => {
    const resolver: UnitResolver = (input, value, unit) =>
      unit === "umol/L" ? { ok: true, value: Math.round((value / 88.4) * 100) / 100 } : defaultUnitResolver(input, value, unit)
    expect(parsePrefill(def, new URLSearchParams("creatinine=88.4&creatinine_unit=umol/L"), { unitResolver: resolver }).values.creatinine).toBe("1")
    const strict: UnitResolver = () => ({ ok: true, value: -5 })
    expect(parsePrefill(def, new URLSearchParams("creatinine=5&creatinine_unit=x"), { unitResolver: strict }).values.creatinine).toBeUndefined()
  })

  it("treats a real input whose id ends in _unit as an input, not a unit", () => {
    const d: CalculatorDefinition = {
      ...def,
      inputs: [{ id: "dose", label: "Dose", kind: "number" }, { id: "dose_unit", label: "Unit", kind: "select", options: [{ value: "mg", label: "mg" }] }],
    }
    const r = parsePrefill(d, new URLSearchParams("dose=5&dose_unit=mg"))
    expect(r.values).toEqual({ dose: "5", dose_unit: "mg" })
  })
})

describe("prefill against a real calculator", () => {
  it("fills Cockcroft-Gault by input id and drops what is invalid", () => {
    const crcl = getCalculatorById("creatinine-clearance")!
    const r = parsePrefill(crcl, new URLSearchParams("age=54&weight=70&creatinine=1.2&sex=male&height=170&age_unit=years"))
    expect(r.values).toEqual({ age: "54", weight: "70", creatinine: "1.2", sex: "male" })
    expect(r.ignored).toContain("height")
    expect(r.calculate).toBe(false)
  })
})
