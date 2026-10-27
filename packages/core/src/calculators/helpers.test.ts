import { describe, expect, it } from "vitest"
import { num, optionalNum, str, assertPositive, assertNonNegative, safeDivide, round, fmt, CalculatorInputError } from "./helpers"

describe("num", () => {
  it("parses a numeric input", () => {
    expect(num({ weight: 70 }, "weight")).toBe(70)
    expect(num({ weight: "70" }, "weight")).toBe(70)
  })

  it("throws for a missing value", () => {
    expect(() => num({}, "weight")).toThrow(CalculatorInputError)
    expect(() => num({ weight: "" }, "weight")).toThrow(CalculatorInputError)
  })

  it("throws for a non-numeric string", () => {
    expect(() => num({ weight: "abc" }, "weight")).toThrow(CalculatorInputError)
  })

  it("handles decimals", () => {
    expect(num({ weight: 70.5 }, "weight")).toBe(70.5)
  })

  it("handles negative and zero values (validity is the caller's job)", () => {
    expect(num({ x: -5 }, "x")).toBe(-5)
    expect(num({ x: 0 }, "x")).toBe(0)
  })
})

describe("optionalNum", () => {
  it("returns undefined when absent", () => {
    expect(optionalNum({}, "albumin")).toBeUndefined()
    expect(optionalNum({ albumin: "" }, "albumin")).toBeUndefined()
  })

  it("returns the parsed value when present", () => {
    expect(optionalNum({ albumin: 4 }, "albumin")).toBe(4)
  })
})

describe("str", () => {
  it("returns the string value", () => {
    expect(str({ sex: "male" }, "sex")).toBe("male")
  })

  it("throws for a missing value", () => {
    expect(() => str({}, "sex")).toThrow(CalculatorInputError)
  })
})

describe("assertPositive / assertNonNegative", () => {
  it("assertPositive throws on zero and negative", () => {
    expect(() => assertPositive(0, "Weight")).toThrow(CalculatorInputError)
    expect(() => assertPositive(-1, "Weight")).toThrow(CalculatorInputError)
    expect(() => assertPositive(1, "Weight")).not.toThrow()
  })

  it("assertNonNegative throws only on negative", () => {
    expect(() => assertNonNegative(-1, "Count")).toThrow(CalculatorInputError)
    expect(() => assertNonNegative(0, "Count")).not.toThrow()
  })
})

describe("safeDivide", () => {
  it("divides normally", () => {
    expect(safeDivide(10, 2)).toBe(5)
  })

  it("throws on division by zero", () => {
    expect(() => safeDivide(10, 0)).toThrow(CalculatorInputError)
  })
})

describe("round / fmt", () => {
  it("rounds to the given decimals", () => {
    expect(round(1.2345, 2)).toBe(1.23)
    expect(round(1.005, 2)).toBe(1.01)
  })

  it("formats with a unit", () => {
    expect(fmt(1.5, 1, "kg")).toBe("1.5 kg")
    expect(fmt(1.5, 1)).toBe("1.5")
  })
})
