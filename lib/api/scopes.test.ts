import { describe, expect, it } from "vitest"
import { calculators } from "@/lib/calculators/registry"
import { API_SCOPES, DEFAULT_SCOPES, DOSING_CATEGORIES, cleanScopes, hasScope, isApiScope, scopeForCalculator, scopeForCategory } from "./scopes"

describe("scopes", () => {
  it("the default scopes never include dosing", () => {
    expect(DEFAULT_SCOPES).toEqual(["read:catalog", "calculate:general", "convert"])
    expect(DEFAULT_SCOPES.includes("calculate:dosing")).toBe(false)
  })

  it("dosing and oncology need calculate:dosing; every other category needs calculate:general", () => {
    expect(DOSING_CATEGORIES).toEqual(["dosing", "oncology"])
    expect(scopeForCategory("dosing")).toBe("calculate:dosing")
    expect(scopeForCategory("oncology")).toBe("calculate:dosing")
    for (const c of ["general", "renal", "chemistry", "hematology", "cardiovascular", "lab-solutions", "microbiology", "spectrophotometry", "stem-cell-transplant"]) {
      expect(scopeForCategory(c), c).toBe("calculate:general")
    }
  })

  it("every registered calculator maps to exactly one of the two calculate scopes", () => {
    for (const c of calculators) expect(["calculate:general", "calculate:dosing"], c.id).toContain(scopeForCalculator(c))
    const dosing = calculators.filter((c) => scopeForCalculator(c) === "calculate:dosing")
    expect(dosing.length).toBeGreaterThanOrEqual(57)
    expect(dosing.every((c) => c.category === "dosing" || c.category === "oncology")).toBe(true)
  })

  it("cleanScopes keeps only known scopes, once, and ignores junk", () => {
    expect(cleanScopes(["convert", "convert", "admin", 5, "calculate:dosing"])).toEqual(["calculate:dosing", "convert"])
    expect(cleanScopes("calculate:dosing")).toEqual([])
    expect(cleanScopes(undefined)).toEqual([])
  })

  it("hasScope and isApiScope", () => {
    expect(hasScope(["convert"], "convert")).toBe(true)
    expect(hasScope([], "convert")).toBe(false)
    expect(API_SCOPES.every(isApiScope)).toBe(true)
    expect(isApiScope("read:everything")).toBe(false)
  })
})
