import { describe, expect, it } from "vitest"
import { calculators } from "./registry"
import { auditCalculatorRegistry } from "./validation"

describe("calculator clinical-definition audit", () => {
  it("finds no structural definition issues", () => {
    expect(auditCalculatorRegistry(calculators)).toEqual([])
  })
})

describe("phase 49 calculator safety/validation", () => {
  it("audits registry uniqueness and structure without throwing", () => {
    expect(auditCalculatorRegistry(calculators).filter((issue) => issue.message.includes("Duplicate calculator id")).length).toBe(0)
  })
})
