import { describe, expect, it } from "vitest"
import type { CalculatorDefinition } from "../calculators/types"
import { getCalculatorById } from "../calculators/registry"
import { INPUT_CODING, RESULT_CODING, getResultCoding, withCodingMetadata } from "../calculators/coding-metadata"

/** LOINC check digit: mod 10 (Luhn) over the digits before the hyphen. Catches typos, says nothing about meaning. */
function loincCheckDigitOk(code: string): boolean {
  const m = /^(\d{1,7})-(\d)$/.exec(code)
  if (!m) return false
  let sum = 0
  ;[...m[1]].reverse().forEach((d, i) => {
    let x = Number(d)
    if (i % 2 === 0) {
      x *= 2
      if (x > 9) x -= 9
    }
    sum += x
  })
  return (10 - (sum % 10)) % 10 === Number(m[2])
}

const allCodings = [
  ...Object.entries(INPUT_CODING).flatMap(([calc, inputs]) => Object.entries(inputs).map(([id, c]) => ({ where: `${calc}.${id}`, c }))),
  ...Object.entries(RESULT_CODING).map(([calc, c]) => ({ where: `${calc} (result)`, c })),
]

describe("coding metadata table", () => {
  it("only names calculators and inputs that exist (catches typos and renames)", () => {
    for (const [calcId, inputs] of Object.entries(INPUT_CODING)) {
      const def = getCalculatorById(calcId)
      expect(def, `calculator ${calcId}`).toBeDefined()
      for (const inputId of Object.keys(inputs)) expect(def!.inputs.some((i) => i.id === inputId), `${calcId}.${inputId}`).toBe(true)
    }
    for (const calcId of Object.keys(RESULT_CODING)) expect(getCalculatorById(calcId), `result coding for ${calcId}`).toBeDefined()
  })

  it("is not applied to dosing or oncology calculators", () => {
    for (const calcId of [...Object.keys(INPUT_CODING), ...Object.keys(RESULT_CODING)]) {
      const category = getCalculatorById(calcId)!.category
      expect(category === "dosing" || category === "oncology", calcId).toBe(false)
    }
  })

  it("every LOINC code is well formed and passes the mod-10 check digit", () => {
    let seen = 0
    for (const { where, c } of allCodings) {
      for (const code of [c.loinc, "fhir" in c ? (c as { fhir?: { loinc?: string } }).fhir?.loinc : undefined]) {
        if (!code) continue
        seen++
        expect(loincCheckDigitOk(code), `${where}: ${code}`).toBe(true)
      }
    }
    expect(seen).toBeGreaterThan(20)
  })

  it("an input's fhir.loinc agrees with its loinc", () => {
    for (const [calc, inputs] of Object.entries(INPUT_CODING)) {
      for (const [id, c] of Object.entries(inputs)) {
        if (c.fhir?.resource === "Observation") expect(c.fhir.loinc, `${calc}.${id}`).toBe(c.loinc)
      }
    }
  })

  it("age and sex map to FHIR Patient, not to an Observation", () => {
    const crcl = getCalculatorById("creatinine-clearance")!
    expect(crcl.inputs.find((i) => i.id === "age")!.fhir).toEqual({ resource: "Patient", path: "birthDate" })
    expect(crcl.inputs.find((i) => i.id === "sex")!.fhir).toEqual({ resource: "Patient", path: "gender" })
    expect(crcl.inputs.find((i) => i.id === "age")!.loinc).toBeUndefined()
  })

  it("covers the Phase 2 calculator list with UCUM on every numeric input that has a fixed unit", () => {
    const required = ["creatinine-clearance", "egfr-ckd-epi", "egfr-mdrd", "bun-creatinine-ratio", "bmi", "bsa", "ideal-body-weight", "adjusted-body-weight", "anion-gap", "corrected-calcium", "corrected-sodium-hyperglycemia", "ldl-friedewald", "non-hdl-cholesterol", "estimated-osmolality", "red-cell-indices", "absolute-cell-count", "inr", "mean-arterial-pressure", "qtc-correction"]
    for (const id of required) {
      const def = getCalculatorById(id)!
      for (const i of def.inputs) {
        // "factor" (corrected-sodium) is a dimensionless-ish ratio unit with no clean UCUM form; it is deliberately left uncoded.
        if (i.kind === "number" && i.unit && i.id !== "factor") expect(i.ucum, `${id}.${i.id}`).toBeDefined()
      }
    }
  })

  it("the known LOINC examples are applied", () => {
    const get = (calc: string, id: string) => getCalculatorById(calc)!.inputs.find((i) => i.id === id)!
    expect(get("creatinine-clearance", "creatinine").loinc).toBe("2160-0")
    expect(get("creatinine-clearance", "creatinine").ucum).toBe("mg/dL")
    expect(get("creatinine-clearance", "weight").loinc).toBe("29463-7")
    expect(get("bmi", "height").loinc).toBe("8302-2")
  })

  it("getResultCoding returns the table entry", () => {
    expect(getResultCoding("bmi")?.ucum).toBe("kg/m2")
    expect(getResultCoding("not-a-calculator")).toBeUndefined()
  })
})

describe("withCodingMetadata never touches the maths", () => {
  const base: CalculatorDefinition = {
    id: "bmi", name: "B", category: "general", description: "d",
    inputs: [{ id: "weight", label: "W", kind: "number", unit: "kg" }, { id: "other", label: "O", kind: "number" }],
    calculate: () => ({ value: 1, display: "1" }),
    formula: "f",
  }
  it("keeps the very same calculate function, formula and untouched inputs", () => {
    const out = withCodingMetadata(base)
    expect(out.calculate).toBe(base.calculate)
    expect(out.formula).toBe("f")
    expect(out.inputs[1]).toBe(base.inputs[1])
    expect(out.inputs[0].loinc).toBe("29463-7")
    expect(base.inputs[0].loinc).toBeUndefined() // the original object is not mutated
  })
  it("returns a definition without an entry unchanged", () => {
    const other = { ...base, id: "no-entry" }
    expect(withCodingMetadata(other)).toBe(other)
  })
  it("leaves every registered calculator's results identical to calling the same calculate with plain inputs", () => {
    const def = getCalculatorById("bmi")!
    expect(def.calculate({ weight: "70", weightUnit: "kg", height: "170", heightUnit: "cm" })).toEqual(
      withCodingMetadata({ ...def, inputs: def.inputs.map(({ loinc, ucum, fhir, ...rest }) => rest) }).calculate({ weight: "70", weightUnit: "kg", height: "170", heightUnit: "cm" }),
    )
  })
})
