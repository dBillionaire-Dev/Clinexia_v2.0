import { describe, expect, it } from "vitest"
import { breakdownFromCm, cmToFeetInches, convertHeight, feetInchesToCm, formatFeetInches } from "./height"

describe("height conversion", () => {
  it("uses exactly 2.54 cm per inch", () => {
    expect(convertHeight(1, "in", "cm")).toBeCloseTo(2.54, 10)
    expect(convertHeight(1, "ft", "cm")).toBeCloseTo(30.48, 10)
  })

  it("converts between metric units", () => {
    expect(convertHeight(1.75, "m", "cm")).toBeCloseTo(175, 10)
    expect(convertHeight(1750, "mm", "m")).toBeCloseTo(1.75, 10)
  })

  it("converts feet and inches to centimeters", () => {
    expect(feetInchesToCm(5, 10)).toBeCloseTo(177.8, 10)
    expect(feetInchesToCm(6, 0)).toBeCloseTo(182.88, 10)
  })

  it("converts centimeters to feet and inches", () => {
    expect(cmToFeetInches(170)).toEqual({ feet: 5, inches: 6.9 })
    expect(cmToFeetInches(177.8)).toEqual({ feet: 5, inches: 10 })
  })

  it("carries 12 inches into the next foot instead of showing 5 ft 12 in", () => {
    expect(cmToFeetInches(182.87)).toEqual({ feet: 6, inches: 0 })
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 })
  })

  it("rejects negative and non-finite input", () => {
    expect(convertHeight(-1, "cm", "m")).toBeNull()
    expect(convertHeight(Number.NaN, "cm", "m")).toBeNull()
    expect(feetInchesToCm(-1, 2)).toBeNull()
    expect(cmToFeetInches(Number.POSITIVE_INFINITY)).toBeNull()
    expect(breakdownFromCm(-5)).toBeNull()
  })

  it("round-trips cm -> ft/in -> cm within half an inch step", () => {
    const fi = cmToFeetInches(163)!
    expect(Math.abs((feetInchesToCm(fi.feet, fi.inches) ?? 0) - 163)).toBeLessThan(0.15)
  })

  it("formats feet and inches", () => {
    expect(formatFeetInches({ feet: 5, inches: 6.9 })).toBe("5 ft 6.9 in")
  })
})
