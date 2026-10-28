import { describe, expect, it } from "vitest"
import { calculators, getCalculatorById } from "./registry"
import { DOSE_VOLUME_IDS, LIQUID_MG_ID, LIQUID_ML_ID, liquidStrengthInputs } from "./dose-volume"

const calc = (id: string) => {
  const c = getCalculatorById(id)
  if (!c) throw new Error(`missing ${id}`)
  return c
}
const row = (r: { secondary?: { label: string; value: string }[] }, label: string) => r.secondary?.find((s) => s.label === label)?.value

describe("dose volume: mg per dose and mL per dose", () => {
  it("weight-based dose: 5 mg/kg x 20 kg = 100 mg; 50 mg per 5 mL gives 10 mL", () => {
    const r = calc("mg-per-kg-dose").calculate({ dosePerKg: 5, weight: 20, [LIQUID_MG_ID]: 50, [LIQUID_ML_ID]: 5 })
    expect(r.value).toBe(100)
    expect(r.display).toBe("100 mg")
    expect(row(r, "Volume per dose")).toBe("10 mL")
    expect(row(r, "Product strength used")).toBe("50 mg in 5 mL (10 mg/mL)")
    expect(r.secondary![0].label).toBe("Volume per dose")
    expect(row(r, "Dose per administration")).toBeUndefined()
  })

  it("ranges: amoxicillin 20 kg is 166.67-333.33 mg per dose; 125 mg/5 mL gives 6.67-13.33 mL", () => {
    const r = calc("amoxicillin-pediatric-dose").calculate({ weight: 20, [LIQUID_MG_ID]: 125, [LIQUID_ML_ID]: 5 })
    expect(row(r, "Volume per dose")).toBe("6.67–13.33 mL")
    expect(row(r, "Per-dose range")).toBe("166.7–333.3 mg/dose")
    // the mg per dose sits directly above the mL per dose
    expect(r.secondary!.slice(0, 2).map((x) => x.label)).toEqual(["Per-dose range", "Volume per dose"])
    expect(r.calculationSteps!.at(-1)).toContain("166.67–333.33 mg ÷ 25 mg/mL = 6.67–13.33 mL")
  })

  it("daily-dose calculators show the mg per administration as well", () => {
    const r = calc("ceftriaxone-pediatric-dose").calculate({ weight: 20, indication: "general", [LIQUID_MG_ID]: 1000, [LIQUID_ML_ID]: 10 })
    expect(row(r, "Dose per administration")).toBe("1000 mg")
    expect(row(r, "Volume per dose")).toBe("10 mL")
    const perDay = calc("mg-per-kg-per-day-dose").calculate({ dosePerKgDay: 30, weight: 10, dosesPerDay: 3, [LIQUID_MG_ID]: 100, [LIQUID_ML_ID]: 5 })
    expect(row(perDay, "Dose per administration")).toBe("100 mg")
    expect(perDay.secondary!.filter((s) => s.label === "Dose per administration")).toHaveLength(1)
    expect(perDay.secondary!.slice(0, 2).map((x) => x.label)).toEqual(["Dose per administration", "Volume per dose"])
    expect(row(perDay, "Volume per dose")).toBe("5 mL")
  })

  it("shows the mg per administration even when no strength is entered, and no volume", () => {
    const r = calc("ceftriaxone-pediatric-dose").calculate({ weight: 20, indication: "general" })
    expect(row(r, "Dose per administration")).toBe("1000 mg")
    expect(row(r, "Volume per dose")).toBeUndefined()
  })

  it("never assumes a strength: leaving it empty changes nothing about the mg result", () => {
    const base = calc("mg-per-kg-dose")
    const withNone = base.calculate({ dosePerKg: 5, weight: 20 })
    const withBlank = base.calculate({ dosePerKg: 5, weight: 20, [LIQUID_MG_ID]: "", [LIQUID_ML_ID]: "" })
    expect(withNone.value).toBe(100)
    expect(withBlank.secondary).toBeUndefined
    expect(row(withBlank, "Volume per dose")).toBeUndefined()
  })

  it("needs both parts of the strength, or neither", () => {
    expect(() => calc("mg-per-kg-dose").calculate({ dosePerKg: 5, weight: 20, [LIQUID_MG_ID]: 125 })).toThrow(/both parts/)
    expect(() => calc("mg-per-kg-dose").calculate({ dosePerKg: 5, weight: 20, [LIQUID_ML_ID]: 5 })).toThrow(/both parts/)
    expect(() => calc("mg-per-kg-dose").calculate({ dosePerKg: 5, weight: 20, [LIQUID_MG_ID]: 0, [LIQUID_ML_ID]: 5 })).toThrow(/greater than zero/)
  })

  it("warns about very large and very small volumes, and always asks to check the label", () => {
    const large = calc("mg-per-kg-dose").calculate({ dosePerKg: 50, weight: 40, [LIQUID_MG_ID]: 10, [LIQUID_ML_ID]: 5 })
    expect(large.warnings!.join(" ")).toMatch(/over 30 mL/)
    const small = calc("mg-per-kg-dose").calculate({ dosePerKg: 1, weight: 2, [LIQUID_MG_ID]: 500, [LIQUID_ML_ID]: 1 })
    expect(small.warnings!.join(" ")).toMatch(/under 0.1 mL/)
    expect(small.warnings!.join(" ")).toMatch(/product label/)
  })

  it("two-ingredient products ask for the strength of the component being dosed", () => {
    const r = calc("piperacillin-tazobactam-pediatric-dose").calculate({ weight: 20, [LIQUID_MG_ID]: 2000, [LIQUID_ML_ID]: 10 })
    expect(row(r, "Volume per dose")).toBe("10 mL")
    expect(r.warnings!.join(" ")).toMatch(/two active ingredients/)
  })

  it("every supported calculator gives a mg amount and a volume on its own sample inputs", () => {
    for (const id of DOSE_VOLUME_IDS) {
      const c = calc(id)
      const inputs: Record<string, number | string> = {}
      for (const f of c.inputs) {
        if (f.id === LIQUID_MG_ID || f.id === LIQUID_ML_ID) continue
        if (f.kind === "select") inputs[f.id] = String(f.defaultValue ?? f.options?.[0]?.value ?? "")
        else inputs[f.id] = String(f.defaultValue ?? (f.id.toLowerCase().includes("weight") ? 20 : f.min && f.min > 0 ? f.min * 2 : 10))
      }
      const r = c.calculate({ ...inputs, [LIQUID_MG_ID]: 100, [LIQUID_ML_ID]: 5 })
      expect(row(r, "Volume per dose"), `${id} has no volume row (${r.display})`).toMatch(/ mL$/)
      expect(r.secondary!.some((s) => /per[- ]dose|per administration/i.test(s.label)) || /^mg/.test(r.unit ?? ""), `${id} does not show mg per dose`).toBe(true)
    }
  })

  it("only adds the strength inputs to supported dosing calculators", () => {
    for (const c of calculators) {
      const has = c.inputs.some((i) => i.id === LIQUID_MG_ID)
      expect(has, c.id).toBe(DOSE_VOLUME_IDS.has(c.id))
      if (has) expect(c.inputs.filter((i) => i.id === LIQUID_MG_ID || i.id === LIQUID_ML_ID).every((i) => i.optional && i.defaultValue === undefined)).toBe(true)
    }
    for (const id of ["artemether-lumefantrine-uncomplicated-malaria", "tablet-capsule-count", "oral-liquid-dose-volume", "who-young-infant-sepsis-pneumonia", "who-pediatric-ors-plan-b", "infusion-rate"]) {
      expect(DOSE_VOLUME_IDS.has(id), id).toBe(false)
    }
  })

  it("the strength fields accept any value a label can show (no browser step/min mismatch)", () => {
    for (const f of liquidStrengthInputs) {
      expect(f.step, `${f.id} must not set a step: with min 0.001 a step of 0.1 makes 125 an invalid number`).toBeUndefined()
    }
  })

  it("every dose-volume id exists and is a dosing calculator", () => {
    for (const id of DOSE_VOLUME_IDS) expect(calc(id).category).toBe("dosing")
  })
})
