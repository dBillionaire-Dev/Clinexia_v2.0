import { describe, expect, it } from "vitest"
import type { CalculatorDefinition } from "../calculators/types"
import { getCalculatorById } from "../calculators/registry"
import { parsePrefill } from "./prefill"
import { normaliseInputs, prefillUnitResolver } from "./normalise"

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol
const calc = (id: string) => getCalculatorById(id)!
const codes = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code)

describe("creatinine round trip through the calculator", () => {
  const crcl = calc("creatinine-clearance")

  it("88.4 umol/L is about 1.0 mg/dL", () => {
    const r = normaliseInputs(crcl, { age: 54, weight: 70, creatinine: { value: 88.4, unit: "umol/L" }, sex: "male" })
    expect(r.errors).toEqual([])
    expect(near(Number(r.inputs.creatinine), 1, 1e-3)).toBe(true)
    expect(r.conversions.length).toBe(1)
    expect(r.conversions[0].id).toBe("creatinine")
    expect(r.conversions[0].from).toEqual({ value: 88.4, unit: "umol/L" })
    expect(r.conversions[0].to.unit).toBe("mg/dL")
  })

  it("88 umol/L gives the same CrCl as the plain mg/dL path with the converted value", () => {
    const viaUnit = normaliseInputs(crcl, { age: 54, weight: 70, creatinine: { value: 88, unit: "umol/L" }, sex: "male" })
    expect(viaUnit.errors).toEqual([])
    const converted = Number(viaUnit.inputs.creatinine)
    expect(near(converted, 0.99546, 1e-4)).toBe(true)

    const plain = normaliseInputs(crcl, { age: 54, weight: 70, creatinine: converted, sex: "male" })
    expect(plain.errors).toEqual([])
    expect(plain.conversions).toEqual([])
    expect(crcl.calculate(viaUnit.inputs)).toEqual(crcl.calculate(plain.inputs))
  })

  it("the same value in the input's own unit is not converted and matches what the web form passes", () => {
    const r = normaliseInputs(crcl, { age: 54, weight: 70, creatinine: { value: 1.2, unit: "mg/dL" }, sex: "male" })
    expect(r.conversions).toEqual([])
    expect(crcl.calculate(r.inputs)).toEqual(crcl.calculate({ age: "54", weight: "70", creatinine: "1.2", sex: "male" }))
  })
})

describe("unit handling per input", () => {
  it("weight in lb and height in ft feed BMI via the companion unit selects, equal to the kg/cm path", () => {
    const bmi = calc("bmi")
    const r = normaliseInputs(bmi, { weight: { value: 154.32358, unit: "lb" }, height: { value: 5.5, unit: "ft" } })
    expect(r.errors).toEqual([])
    expect(r.inputs.weightUnit).toBe("kg")
    expect(r.inputs.heightUnit).toBe("cm")
    expect(near(Number(r.inputs.weight), 70, 1e-4)).toBe(true)
    expect(near(Number(r.inputs.height), 167.64)).toBe(true)
    const plain = normaliseInputs(bmi, { weight: Number(r.inputs.weight), height: Number(r.inputs.height) })
    expect(bmi.calculate(r.inputs)).toEqual(bmi.calculate(plain.inputs))
  })

  it("an explicit companion select with a plain value passes through for the calculator to interpret", () => {
    const r = normaliseInputs(calc("bmi"), { weight: 150, weightUnit: "lb", height: 66, heightUnit: "in" })
    expect(r.errors).toEqual([])
    expect(r.inputs).toEqual({ weight: "150", weightUnit: "lb", height: "66", heightUnit: "in" })
    expect(r.conversions).toEqual([])
  })

  it("a unit AND its own unit select together is a conflict, not a double conversion", () => {
    const r = normaliseInputs(calc("bmi"), { weight: { value: 150, unit: "lb" }, weightUnit: "lb", height: 170 })
    expect(codes(r)).toContain("unit_conflict")
  })

  it("glucose and calcium in mmol/L, albumin in g/L", () => {
    const osm = normaliseInputs(calc("estimated-osmolality"), { na: 140, glucose: { value: 5.5, unit: "mmol/L" }, bun: 14 })
    expect(osm.errors).toEqual([])
    expect(near(Number(osm.inputs.glucose), 99)).toBe(true)
    const ca = normaliseInputs(calc("corrected-calcium"), { calcium: { value: 2.5, unit: "mmol/L" }, albumin: { value: 40, unit: "g/L" } })
    expect(ca.errors).toEqual([])
    expect(near(Number(ca.inputs.calcium), 10.02)).toBe(true)
    expect(near(Number(ca.inputs.albumin), 4)).toBe(true)
    expect(ca.conversions.map((c) => c.id)).toEqual(["calcium", "albumin"])
  })

  it("temperature (synthetic definition, no registered calculator takes one)", () => {
    const def: CalculatorDefinition = {
      id: "t", name: "T", category: "general", description: "t",
      inputs: [{ id: "temp", label: "Temperature", kind: "number", unit: "°C", min: 20, max: 45 }],
      calculate: () => ({ value: 1, display: "1" }),
    }
    const r = normaliseInputs(def, { temp: { value: 98.6, unit: "F" } })
    expect(r.errors).toEqual([])
    expect(near(Number(r.inputs.temp), 37, 1e-9)).toBe(true)
    expect(codes(normaliseInputs(def, { temp: { value: 200, unit: "F" } }))).toEqual(["out_of_range"])
  })

  it("refuses an unknown unit and an incompatible unit instead of guessing", () => {
    const crcl = calc("creatinine-clearance")
    expect(codes(normaliseInputs(crcl, { age: 54, weight: 70, creatinine: { value: 1, unit: "furlongs" }, sex: "male" }))).toEqual(["unit_unknown"])
    expect(codes(normaliseInputs(crcl, { age: 54, weight: { value: 70, unit: "cm" }, creatinine: 1, sex: "male" }))).toEqual(["unit_mismatch"])
    expect(codes(normaliseInputs(calc("bun-creatinine-ratio"), { bun: { value: 5, unit: "mmol/L" }, creatinine: 1 }))).toEqual(["unit_unsupported"])
  })

  it("a calculator-level unit select (LDL Friedewald) takes plain values only", () => {
    const ldl = calc("ldl-friedewald")
    const ok = normaliseInputs(ldl, { unit: "mmol/L", tc: 5, hdl: 1.3, tg: 1.5 })
    expect(ok.errors).toEqual([])
    expect(codes(normaliseInputs(ldl, { unit: "mg/dL", tc: { value: 5, unit: "mmol/L" }, hdl: 50, tg: 150 }))).toEqual(["unit_unsupported"])
  })
})

describe("validation", () => {
  const crcl = calc("creatinine-clearance")
  const good = { age: 54, weight: 70, creatinine: 1.2, sex: "male" }

  it("accepts plain numbers and numeric strings", () => {
    const r = normaliseInputs(crcl, { ...good, creatinine: "1.20" })
    expect(r.errors).toEqual([])
    expect(r.inputs).toEqual({ age: "54", weight: "70", creatinine: "1.2", sex: "male" })
  })

  it("required inputs are errors and are never defaulted (no silent sex=male)", () => {
    const r = normaliseInputs(crcl, { age: 54, weight: 70, creatinine: 1.2 })
    expect(r.errors.map((e) => e.id)).toEqual(["sex"])
    expect(r.errors[0].code).toBe("required")
    expect(r.inputs.sex).toBeUndefined()
    expect(codes(normaliseInputs(crcl, {}))).toEqual(["required", "required", "required", "required"])
    expect(codes(normaliseInputs(crcl, { ...good, age: "" }))).toEqual(["required"])
  })

  it("optional inputs may be left out and come back as an empty string, like the web form", () => {
    const ag = calc("anion-gap")
    const r = normaliseInputs(ag, { na: 140, cl: 104, hco3: 24 })
    expect(r.errors).toEqual([])
    expect(r.inputs.albumin).toBe("")
    expect(ag.calculate(r.inputs)).toEqual(ag.calculate({ na: "140", cl: "104", hco3: "24", albumin: "" }))
  })

  it("select values: case-insensitive match is canonicalised; anything else is rejected", () => {
    expect(normaliseInputs(crcl, { ...good, sex: "FEMALE" }).inputs.sex).toBe("female")
    expect(codes(normaliseInputs(crcl, { ...good, sex: "other" }))).toEqual(["invalid_option"])
    expect(codes(normaliseInputs(crcl, { ...good, sex: 1 }))).toEqual(["invalid_type"])
    expect(codes(normaliseInputs(crcl, { ...good, sex: { value: "male", unit: "x" } }))).toEqual(["unit_unsupported"])
  })

  it("min and max are enforced, after conversion", () => {
    const egfr = calc("egfr-ckd-epi") // age min 18
    expect(codes(normaliseInputs(egfr, { age: 10, creatinine: 1, sex: "male" }))).toEqual(["out_of_range"])
    expect(codes(normaliseInputs(crcl, { ...good, creatinine: -1 }))).toEqual(["out_of_range"])
    expect(codes(normaliseInputs(crcl, { ...good, creatinine: { value: -5, unit: "umol/L" } }))).toEqual(["out_of_range"])
    const hgh = calc("mean-arterial-pressure") // sbp max 400
    expect(codes(normaliseInputs(hgh, { sbp: 500, dbp: 80 }))).toEqual(["out_of_range"])
  })

  it("rejects malformed numbers", () => {
    for (const bad of ["abc", "1e3", "0x10", "1,2", "NaN", "Infinity", {}, [], true]) {
      const r = normaliseInputs(crcl, { ...good, weight: bad })
      expect(r.errors.length, JSON.stringify(bad)).toBeGreaterThan(0)
    }
    expect(codes(normaliseInputs(crcl, { ...good, weight: Infinity }))).toEqual(["invalid_number"])
  })

  it("unknown inputs are errors (names only, never values)", () => {
    const r = normaliseInputs(crcl, { ...good, mrn: "SECRET-99", __proto__x: 1 })
    expect(r.errors.filter((e) => e.code === "unknown_input").map((e) => e.id)).toEqual(["mrn", "__proto__x"])
    expect(JSON.stringify(r)).not.toContain("SECRET-99")
  })

  it("error messages never echo the values that were sent", () => {
    const r = normaliseInputs(crcl, { age: "123456.789", weight: "-777.5", creatinine: { value: 424242, unit: "furlongs" }, sex: "zz-secret" })
    const text = JSON.stringify(r.errors)
    for (const secret of ["123456", "777.5", "424242", "zz-secret"]) expect(text).not.toContain(secret)
  })

  it("handles non-object input safely", () => {
    expect(codes(normaliseInputs(crcl, null as unknown as Record<string, unknown>)).length).toBe(4)
    expect(codes(normaliseInputs(crcl, [] as unknown as Record<string, unknown>)).length).toBe(4)
  })
})

describe("deep links with units (Phase 1 hook wired to the normaliser)", () => {
  const crcl = calc("creatinine-clearance")
  const opts = { unitResolver: prefillUnitResolver }

  it("creatinine=88&creatinine_unit=umol/L prefills the converted mg/dL value", () => {
    const r = parsePrefill(crcl, new URLSearchParams("age=54&weight=70&creatinine=88&creatinine_unit=umol/L&sex=male"), opts)
    expect(near(Number(r.values.creatinine), 0.99546, 1e-4)).toBe(true)
    expect(r.values.age).toBe("54")
  })
  it("weight_unit=lb converts; an unknown or incompatible unit is ignored silently", () => {
    expect(near(Number(parsePrefill(crcl, new URLSearchParams("weight=154.32358&weight_unit=lb"), opts).values.weight), 70, 1e-4)).toBe(true)
    expect(parsePrefill(crcl, new URLSearchParams("weight=70&weight_unit=cm"), opts).values.weight).toBeUndefined()
    expect(parsePrefill(crcl, new URLSearchParams("creatinine=1&creatinine_unit=furlongs"), opts).values.creatinine).toBeUndefined()
  })
  it("the range check runs on the converted value", () => {
    expect(parsePrefill(crcl, new URLSearchParams("age=-1&age_unit=years"), opts).values.age).toBeUndefined()
    expect(parsePrefill(calc("egfr-ckd-epi"), new URLSearchParams("age=17&age_unit=a"), opts).values.age).toBeUndefined()
  })
})
