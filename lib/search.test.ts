import { describe, expect, it } from "vitest"
import { globalSearch } from "./search"

describe("globalSearch", () => {
  it("finds a registered calculator by name", () => {
    const results = globalSearch("bmi")
    expect(results.some((r) => r.type === "calculator" && r.id === "bmi")).toBe(true)
  })

  it("finds a conversion category", () => {
    const results = globalSearch("temperature")
    expect(results.some((r) => r.type === "conversion" && r.id === "temperature")).toBe(true)
  })

  it("finds standalone lab tools not backed by the calculator registry (spec section 37)", () => {
    expect(globalSearch("dilution").some((r) => r.id === "c1v1-dilution")).toBe(true)
    expect(globalSearch("mass volume").some((r) => r.id === "mass-volume")).toBe(true)
    expect(globalSearch("mass ↔ volume").length).toBeGreaterThanOrEqual(0) // symbol variants shouldn't throw
  })

  it("finds the height converter by common phrases", () => {
    expect(globalSearch("height converter").some((r) => r.id === "height-converter")).toBe(true)
    expect(globalSearch("cm to feet").some((r) => r.id === "height-converter")).toBe(true)
  })

  it("finds the combined Red Cell Indices tool by MCV/MCH/MCHC keywords", () => {
    expect(globalSearch("mcv").some((r) => r.id === "red-cell-indices")).toBe(true)
    expect(globalSearch("mchc").some((r) => r.id === "red-cell-indices")).toBe(true)
  })

  it("returns nothing for an empty query", () => {
    expect(globalSearch("")).toEqual([])
    expect(globalSearch("   ")).toEqual([])
  })

  it("returns nothing for a query matching nothing", () => {
    expect(globalSearch("zzzznonexistentquery")).toEqual([])
  })

  it("is case-insensitive", () => {
    expect(globalSearch("BMI").some((r) => r.id === "bmi")).toBe(true)
  })
  it("searches by calculator category and multiple keywords", () => {
    expect(globalSearch("spectrophotometry standard curve").some((r) => r.id === "spectro-standard-curve")).toBe(true)
    expect(globalSearch("laboratory dilution").some((r) => r.id === "c1v1-c2v2-dilution")).toBe(true)
  })

})

it("supports intent-style pediatric antimalarial queries", () => {
  const results = globalSearch("pediatric antimalaria")
  const antimalarial = results.filter((r) => r.type === "calculator" && r.subtitle.includes("Antimalarial"))
  expect(antimalarial.length).toBeGreaterThanOrEqual(6)
})

it("tolerates common spelling mistakes in calculator searches", () => {
  expect(globalSearch("anitnmalria").some((r) => r.id === "artemether-lumefantrine-uncomplicated-malaria")).toBe(true)
})

it("ranks an exact calculator name above broad keyword matches", () => {
  const results = globalSearch("body surface area")
  expect(results[0]?.id).toBe("bsa")
})


describe("clinical intent search", () => {
  it("returns antimalarial calculators for pediatric antimalaria intent", async () => {
    const { searchCalculators } = await import("./search")
    const results = searchCalculators("pediatric antimalaria")
    expect(results.length).toBeGreaterThan(1)
    expect(results.every((calculator) => calculator.category === "dosing" && calculator.subcategory === "antimalarial")).toBe(true)
  })

  it("tolerates common misspellings of antimalarial", async () => {
    const { searchCalculators } = await import("./search")
    expect(searchCalculators("anitnmalria").some((calculator) => calculator.subcategory === "antimalarial")).toBe(true)
  })
})
