import { describe, expect, it } from "vitest"
import { bmiCalculator, bsaCalculator, idealBodyWeightCalculator, bmrCalculator, adjustedBodyWeightCalculator, estimatedCalorieRequirementCalculator, waistToHeightRatioCalculator, waistToHipRatioCalculator } from "./clinical"

describe("bmiCalculator", () => {
  it("computes a normal BMI", () => {
    const result = bmiCalculator.calculate({ weight: 70, weightUnit: "kg", height: 175, heightUnit: "cm" })
    expect(result.value).toBeCloseTo(22.9, 1)
  })

  it("classifies underweight, normal, overweight, and obese", () => {
    const under = bmiCalculator.calculate({ weight: 45, weightUnit: "kg", height: 175, heightUnit: "cm" })
    const normal = bmiCalculator.calculate({ weight: 70, weightUnit: "kg", height: 175, heightUnit: "cm" })
    const over = bmiCalculator.calculate({ weight: 85, weightUnit: "kg", height: 175, heightUnit: "cm" })
    const obese = bmiCalculator.calculate({ weight: 100, weightUnit: "kg", height: 175, heightUnit: "cm" })
    expect(under.secondary?.[0].value).toBe("Underweight")
    expect(normal.secondary?.[0].value).toBe("Normal weight")
    expect(over.secondary?.[0].value).toBe("Overweight")
    expect(obese.secondary?.[0].value).toBe("Obesity")
  })

  it("handles pound and inch units", () => {
    const result = bmiCalculator.calculate({ weight: 154, weightUnit: "lb", height: 68.9, heightUnit: "in" })
    expect(result.value).toBeCloseTo(22.9, 0)
  })

  it("throws for zero or negative weight/height", () => {
    expect(() => bmiCalculator.calculate({ weight: 0, weightUnit: "kg", height: 175, heightUnit: "cm" })).toThrow()
    expect(() => bmiCalculator.calculate({ weight: -70, weightUnit: "kg", height: 175, heightUnit: "cm" })).toThrow()
    expect(() => bmiCalculator.calculate({ weight: 70, weightUnit: "kg", height: 0, heightUnit: "cm" })).toThrow()
  })

  it("throws for missing required inputs", () => {
    expect(() => bmiCalculator.calculate({ weightUnit: "kg", height: 175, heightUnit: "cm" })).toThrow()
  })

  it("handles decimal values", () => {
    const result = bmiCalculator.calculate({ weight: 68.4, weightUnit: "kg", height: 172.3, heightUnit: "cm" })
    expect(result.value).toBeGreaterThan(0)
  })
})

describe("bsaCalculator", () => {
  it("computes BSA using the Mosteller formula", () => {
    const result = bsaCalculator.calculate({ height: 180, weight: 80 })
    expect(result.value).toBeCloseTo(Math.sqrt((180 * 80) / 3600), 2)
  })

  it("throws for zero or negative inputs", () => {
    expect(() => bsaCalculator.calculate({ height: 0, weight: 80 })).toThrow()
    expect(() => bsaCalculator.calculate({ height: 180, weight: -1 })).toThrow()
  })

  it("throws for missing inputs", () => {
    expect(() => bsaCalculator.calculate({ height: 180 })).toThrow()
  })
})

describe("idealBodyWeightCalculator", () => {
  it("computes IBW for a male at exactly 5 feet (60 in)", () => {
    const result = idealBodyWeightCalculator.calculate({ sex: "male", height: 152.4 })
    expect(result.value).toBeCloseTo(50, 0)
  })

  it("computes IBW for a female", () => {
    const result = idealBodyWeightCalculator.calculate({ sex: "female", height: 165 })
    expect(result.value).toBeGreaterThan(0)
  })

  it("warns when height is below the formula's defined range", () => {
    const result = idealBodyWeightCalculator.calculate({ sex: "male", height: 140 })
    expect(result.warnings?.length).toBeGreaterThan(0)
  })

  it("throws for zero/negative height", () => {
    expect(() => idealBodyWeightCalculator.calculate({ sex: "male", height: 0 })).toThrow()
  })
})

describe("bmrCalculator", () => {
  it("computes BMR for a male using Mifflin-St Jeor", () => {
    const result = bmrCalculator.calculate({ sex: "male", weight: 70, height: 175, age: 30 })
    expect(result.value).toBeCloseTo(10 * 70 + 6.25 * 175 - 5 * 30 + 5, 0)
  })

  it("computes BMR for a female using Mifflin-St Jeor", () => {
    const result = bmrCalculator.calculate({ sex: "female", weight: 60, height: 165, age: 25 })
    expect(result.value).toBeCloseTo(10 * 60 + 6.25 * 165 - 5 * 25 - 161, 0)
  })

  it("throws for zero/negative weight or height", () => {
    expect(() => bmrCalculator.calculate({ sex: "male", weight: 0, height: 175, age: 30 })).toThrow()
    expect(() => bmrCalculator.calculate({ sex: "male", weight: 70, height: -1, age: 30 })).toThrow()
  })

  it("throws for missing inputs", () => {
    expect(() => bmrCalculator.calculate({ sex: "male", weight: 70, height: 175 })).toThrow()
  })
})

describe("adjustedBodyWeightCalculator", () => {
  it("computes adjusted body weight above IBW", () => {
    const result = adjustedBodyWeightCalculator.calculate({ sex: "male", height: 175, actualWeight: 120 })
    expect(result.value).toBeCloseTo(90.3, 1)
    expect(result.secondary?.[0].label).toContain("Ideal body weight")
  })

  it("warns when actual weight is at or below IBW", () => {
    const result = adjustedBodyWeightCalculator.calculate({ sex: "male", height: 175, actualWeight: 60 })
    expect(result.warnings?.length).toBeGreaterThan(0)
  })

  it("throws for zero/negative height or actual weight", () => {
    expect(() => adjustedBodyWeightCalculator.calculate({ sex: "male", height: 0, actualWeight: 100 })).toThrow()
    expect(() => adjustedBodyWeightCalculator.calculate({ sex: "male", height: 175, actualWeight: -1 })).toThrow()
  })
})

describe("estimatedCalorieRequirementCalculator", () => {
  it("computes TDEE as BMR x activity factor", () => {
    const result = estimatedCalorieRequirementCalculator.calculate({
      sex: "male",
      weight: 70,
      height: 175,
      age: 30,
      activityLevel: "moderate",
    })
    const expectedBmr = 10 * 70 + 6.25 * 175 - 5 * 30 + 5
    expect(result.value).toBeCloseTo(expectedBmr * 1.55, 0)
    expect(result.secondary?.[0].label).toBe("BMR")
  })

  it("scales with activity level", () => {
    const sedentary = estimatedCalorieRequirementCalculator.calculate({
      sex: "female",
      weight: 60,
      height: 165,
      age: 25,
      activityLevel: "sedentary",
    })
    const active = estimatedCalorieRequirementCalculator.calculate({
      sex: "female",
      weight: 60,
      height: 165,
      age: 25,
      activityLevel: "active",
    })
    expect(active.value as number).toBeGreaterThan(sedentary.value as number)
  })

  it("throws for an unrecognized activity level", () => {
    expect(() =>
      estimatedCalorieRequirementCalculator.calculate({ sex: "male", weight: 70, height: 175, age: 30, activityLevel: "bogus" }),
    ).toThrow()
  })

  it("throws for zero/negative weight or height", () => {
    expect(() =>
      estimatedCalorieRequirementCalculator.calculate({ sex: "male", weight: 0, height: 175, age: 30, activityLevel: "sedentary" }),
    ).toThrow()
  })
})

describe("waistToHeightRatioCalculator", () => {
  it("computes the ratio", () => {
    const result = waistToHeightRatioCalculator.calculate({ waist: 90, height: 180 })
    expect(result.value).toBe(0.5)
  })

  it("flags at/above the 0.5 threshold", () => {
    const result = waistToHeightRatioCalculator.calculate({ waist: 100, height: 180 })
    expect(result.interpretation).toContain("0.5")
  })

  it("throws for zero/negative waist or height", () => {
    expect(() => waistToHeightRatioCalculator.calculate({ waist: 0, height: 180 })).toThrow()
    expect(() => waistToHeightRatioCalculator.calculate({ waist: 90, height: 0 })).toThrow()
  })
})

describe("waistToHipRatioCalculator", () => {
  it("computes the ratio", () => {
    const result = waistToHipRatioCalculator.calculate({ sex: "male", waist: 100, hip: 100 })
    expect(result.value).toBe(1)
  })

  it("uses sex-specific thresholds", () => {
    const male = waistToHipRatioCalculator.calculate({ sex: "male", waist: 95, hip: 100 })
    const female = waistToHipRatioCalculator.calculate({ sex: "female", waist: 88, hip: 100 })
    expect(male.interpretation).toContain("0.9")
    expect(female.interpretation).toContain("0.85")
  })

  it("throws for zero/negative waist or hip", () => {
    expect(() => waistToHipRatioCalculator.calculate({ sex: "male", waist: 0, hip: 100 })).toThrow()
    expect(() => waistToHipRatioCalculator.calculate({ sex: "male", waist: 90, hip: 0 })).toThrow()
  })
})
