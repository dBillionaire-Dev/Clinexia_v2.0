import type { CalculatorDefinition } from "../types"
import { num, str, assertPositive, safeDivide, round, fmt } from "../helpers"

const heightToMeters = (value: number, unit: string) => {
  switch (unit) {
    case "cm":
      return value / 100
    case "m":
      return value
    case "ft":
      return value * 0.3048
    case "in":
      return value * 0.0254
    default:
      return value
  }
}

const weightToKg = (value: number, unit: string) => (unit === "lb" ? value * 0.453592 : value)

export const bmiCalculator: CalculatorDefinition = {
  id: "bmi",
  name: "BMI (Body Mass Index)",
  shortName: "BMI",
  category: "general",
  description: "Calculates body mass index from weight and height.",
  formula: "BMI = weight (kg) / height (m)²",
  keywords: ["bmi", "body mass index", "weight"],
  relatedTools: ["bsa", "ideal-body-weight", "bmr", "waist-to-height-ratio", "waist-to-hip-ratio"],
  inputs: [
    { id: "weight", label: "Weight", kind: "number", unit: "kg", min: 0, defaultValue: 70 },
    {
      id: "weightUnit",
      label: "Weight unit",
      kind: "select",
      options: [
        { value: "kg", label: "kg" },
        { value: "lb", label: "lb" },
      ],
      defaultValue: "kg",
    },
    { id: "height", label: "Height", kind: "number", unit: "cm", min: 0, defaultValue: 170 },
    {
      id: "heightUnit",
      label: "Height unit",
      kind: "select",
      options: [
        { value: "cm", label: "cm" },
        { value: "m", label: "m" },
        { value: "ft", label: "ft" },
        { value: "in", label: "in" },
      ],
      defaultValue: "cm",
    },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const height = num(inputs, "height")
    assertPositive(weight, "Weight")
    assertPositive(height, "Height")

    const weightKg = weightToKg(weight, str(inputs, "weightUnit"))
    const heightM = heightToMeters(height, str(inputs, "heightUnit"))

    const bmi = safeDivide(weightKg, heightM * heightM, "height²")
    const rounded = round(bmi, 1)

    let category = "Normal weight"
    if (bmi < 18.5) category = "Underweight"
    else if (bmi >= 25 && bmi < 30) category = "Overweight"
    else if (bmi >= 30) category = "Obesity"

    return {
      value: rounded,
      unit: "kg/m²",
      display: fmt(rounded, 1, "kg/m²"),
      secondary: [{ label: "Category", value: category }],
      calculationSteps: [`${round(weightKg, 1)} kg / (${round(heightM, 2)} m)²`],
      interpretation: `${category} range (WHO adult classification).`,
      warnings: bmi < 10 || bmi > 80 ? ["BMI is outside the typical human range  -  check inputs."] : undefined,
    }
  },
  notes: ["Standard WHO adult BMI categories are used; they may not apply to children, pregnant patients, or highly muscular individuals."],
  limitations: ["BMI does not account for body composition (fat vs. muscle mass) or fat distribution."],
}

export const bsaCalculator: CalculatorDefinition = {
  id: "bsa",
  name: "Body Surface Area",
  shortName: "BSA",
  category: "general",
  description: "Estimates body surface area using the Mosteller formula.",
  isEstimator: true,
  formula: "BSA (m²) = sqrt[(height(cm) x weight(kg)) / 3600]",
  keywords: ["bsa", "body surface area", "mosteller"],
  relatedTools: ["bmi", "ideal-body-weight"],
  inputs: [
    { id: "height", label: "Height", kind: "number", unit: "cm", min: 0, defaultValue: 170 },
    { id: "weight", label: "Weight", kind: "number", unit: "kg", min: 0, defaultValue: 70 },
  ],
  calculate: (inputs) => {
    const height = num(inputs, "height")
    const weight = num(inputs, "weight")
    assertPositive(height, "Height")
    assertPositive(weight, "Weight")

    const bsa = Math.sqrt((height * weight) / 3600)
    const rounded = round(bsa, 2)

    return {
      value: rounded,
      unit: "m²",
      display: fmt(rounded, 2, "m²"),
      calculationSteps: [`sqrt((${height} x ${weight}) / 3600)`],
      interpretation: "Mosteller formula  -  commonly used for drug dosing (e.g. chemotherapy) calculations.",
    }
  },
  notes: ["The Mosteller formula is the most widely used BSA estimate; DuBois & DuBois is a common alternative."],
  limitations: ["An estimate only  -  clinical dosing decisions should follow validated institutional protocols."],
}

export const idealBodyWeightCalculator: CalculatorDefinition = {
  id: "ideal-body-weight",
  name: "Ideal Body Weight",
  shortName: "IBW",
  category: "general",
  description: "Estimates ideal body weight using the Devine formula.",
  isEstimator: true,
  formula: "Male: 50 + 2.3 x (height in inches - 60)\nFemale: 45.5 + 2.3 x (height in inches - 60)",
  keywords: ["ibw", "ideal body weight", "devine"],
  relatedTools: ["bmi", "bsa", "adjusted-body-weight"],
  inputs: [
    {
      id: "sex",
      label: "Sex",
      kind: "select",
      options: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
      defaultValue: "male",
    },
    { id: "height", label: "Height", kind: "number", unit: "cm", min: 0, defaultValue: 170 },
  ],
  calculate: (inputs) => {
    const sex = str(inputs, "sex")
    const height = num(inputs, "height")
    assertPositive(height, "Height")

    const heightInches = height / 2.54
    const base = sex === "male" ? 50 : 45.5
    const inchesOver5Feet = Math.max(heightInches - 60, 0)
    const ibw = base + 2.3 * inchesOver5Feet
    const rounded = round(ibw, 1)

    return {
      value: rounded,
      unit: "kg",
      display: fmt(rounded, 1, "kg"),
      calculationSteps: [
        `Height: ${round(heightInches, 1)} in`,
        `${base} + 2.3 x (${round(heightInches, 1)} - 60)`,
      ],
      warnings: heightInches < 60 ? ["Devine formula is defined for heights ≥ 5 ft (152 cm); result is extrapolated below that."] : undefined,
    }
  },
  notes: ["The Devine formula is the most commonly used IBW equation in clinical dosing contexts."],
  limitations: ["Less accurate for very short or very tall individuals; several alternative formulas exist (Robinson, Miller, Hamwi)."],
}

export const bmrCalculator: CalculatorDefinition = {
  id: "bmr",
  name: "Basal Metabolic Rate",
  shortName: "BMR",
  category: "general",
  description: "Estimates basal metabolic rate using the Mifflin-St Jeor equation.",
  isEstimator: true,
  formula: "Male: 10W + 6.25H - 5A + 5\nFemale: 10W + 6.25H - 5A - 161",
  keywords: ["bmr", "basal metabolic rate", "mifflin"],
  relatedTools: ["bmi", "estimated-calorie-requirement"],
  inputs: [
    {
      id: "sex",
      label: "Sex",
      kind: "select",
      options: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
      defaultValue: "male",
    },
    { id: "weight", label: "Weight", kind: "number", unit: "kg", min: 0, defaultValue: 70 },
    { id: "height", label: "Height", kind: "number", unit: "cm", min: 0, defaultValue: 170 },
    { id: "age", label: "Age", kind: "number", unit: "years", min: 0, defaultValue: 30 },
  ],
  calculate: (inputs) => {
    const sex = str(inputs, "sex")
    const weight = num(inputs, "weight")
    const height = num(inputs, "height")
    const age = num(inputs, "age")
    assertPositive(weight, "Weight")
    assertPositive(height, "Height")

    const base = 10 * weight + 6.25 * height - 5 * age
    const bmr = sex === "male" ? base + 5 : base - 161
    const rounded = round(bmr, 0)

    return {
      value: rounded,
      unit: "kcal/day",
      display: fmt(rounded, 0, "kcal/day"),
      calculationSteps: [`(10 x ${weight}) + (6.25 x ${height}) - (5 x ${age}) ${sex === "male" ? "+ 5" : "- 161"}`],
      interpretation: "Estimated energy expenditure at complete rest (Mifflin-St Jeor equation).",
    }
  },
  notes: ["Mifflin-St Jeor is generally considered more accurate than the older Harris-Benedict equation."],
  limitations: ["Does not account for body composition, medical conditions, or activity level (see TDEE)."],
}

export const adjustedBodyWeightCalculator: CalculatorDefinition = {
  id: "adjusted-body-weight",
  name: "Adjusted Body Weight",
  shortName: "AdjBW",
  category: "general",
  description: "Estimates adjusted body weight for dosing in obese patients, using actual and ideal body weight.",
  isEstimator: true,
  formula: "AdjBW = IBW + 0.4 x (Actual Weight - IBW)",
  keywords: ["adjusted body weight", "abw", "dosing weight", "obesity"],
  relatedTools: ["ideal-body-weight", "bmi"],
  inputs: [
    {
      id: "sex",
      label: "Sex",
      kind: "select",
      options: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
      defaultValue: "male",
    },
    { id: "height", label: "Height", kind: "number", unit: "cm", min: 0, defaultValue: 170 },
    { id: "actualWeight", label: "Actual weight", kind: "number", unit: "kg", min: 0, defaultValue: 100 },
  ],
  calculate: (inputs) => {
    const sex = str(inputs, "sex")
    const height = num(inputs, "height")
    const actualWeight = num(inputs, "actualWeight")
    assertPositive(height, "Height")
    assertPositive(actualWeight, "Actual weight")

    const heightInches = height / 2.54
    const base = sex === "male" ? 50 : 45.5
    const inchesOver5Feet = Math.max(heightInches - 60, 0)
    const ibw = base + 2.3 * inchesOver5Feet

    const adjBW = ibw + 0.4 * (actualWeight - ibw)
    const rounded = round(adjBW, 1)

    return {
      value: rounded,
      unit: "kg",
      display: fmt(rounded, 1, "kg"),
      secondary: [{ label: "Ideal body weight (Devine)", value: fmt(round(ibw, 1), 1, "kg") }],
      calculationSteps: [`IBW = ${round(ibw, 1)} kg`, `${round(ibw, 1)} + 0.4 x (${actualWeight} - ${round(ibw, 1)})`],
      warnings:
        actualWeight <= ibw
          ? ["Actual weight is at or below ideal body weight  -  adjusted body weight is typically only used when actual weight exceeds IBW (e.g. obesity)."]
          : undefined,
    }
  },
  notes: ["Commonly used for dosing certain medications (e.g. some antibiotics) in patients with actual weight well above ideal body weight."],
  limitations: ["The 0.4 correction factor is a widely used convention, not a universally validated constant  -  follow your institution's dosing protocol."],
}

const ACTIVITY_MULTIPLIERS: { value: string; label: string; factor: number }[] = [
  { value: "sedentary", label: "Sedentary (little or no exercise)", factor: 1.2 },
  { value: "light", label: "Lightly active (1-3 days/week)", factor: 1.375 },
  { value: "moderate", label: "Moderately active (3-5 days/week)", factor: 1.55 },
  { value: "active", label: "Very active (6-7 days/week)", factor: 1.725 },
  { value: "extra", label: "Extra active (physical job or 2x/day training)", factor: 1.9 },
]

export const estimatedCalorieRequirementCalculator: CalculatorDefinition = {
  id: "estimated-calorie-requirement",
  name: "Estimated Calorie Requirement (TDEE)",
  shortName: "TDEE",
  category: "general",
  description: "Estimates total daily energy expenditure from BMR and activity level.",
  isEstimator: true,
  formula: "TDEE = BMR (Mifflin-St Jeor) x Activity Factor",
  keywords: ["tdee", "calorie requirement", "energy expenditure", "activity factor"],
  relatedTools: ["bmr", "bmi"],
  inputs: [
    {
      id: "sex",
      label: "Sex",
      kind: "select",
      options: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
      defaultValue: "male",
    },
    { id: "weight", label: "Weight", kind: "number", unit: "kg", min: 0, defaultValue: 70 },
    { id: "height", label: "Height", kind: "number", unit: "cm", min: 0, defaultValue: 170 },
    { id: "age", label: "Age", kind: "number", unit: "years", min: 0, defaultValue: 30 },
    {
      id: "activityLevel",
      label: "Activity level",
      kind: "select",
      options: ACTIVITY_MULTIPLIERS.map((a) => ({ value: a.value, label: a.label })),
      defaultValue: "sedentary",
    },
  ],
  calculate: (inputs) => {
    const sex = str(inputs, "sex")
    const weight = num(inputs, "weight")
    const height = num(inputs, "height")
    const age = num(inputs, "age")
    const activityLevel = str(inputs, "activityLevel")
    assertPositive(weight, "Weight")
    assertPositive(height, "Height")

    const activity = ACTIVITY_MULTIPLIERS.find((a) => a.value === activityLevel)
    if (!activity) throw new Error("Unknown activity level")

    const base = 10 * weight + 6.25 * height - 5 * age
    const bmr = sex === "male" ? base + 5 : base - 161
    const tdee = bmr * activity.factor
    const rounded = round(tdee, 0)

    return {
      value: rounded,
      unit: "kcal/day",
      display: fmt(rounded, 0, "kcal/day"),
      secondary: [{ label: "BMR", value: fmt(round(bmr, 0), 0, "kcal/day") }],
      calculationSteps: [`BMR = ${round(bmr, 0)} kcal/day`, `${round(bmr, 0)} x ${activity.factor} (${activity.label})`],
      interpretation: "Approximate calories needed to maintain current weight at the selected activity level.",
    }
  },
  notes: ["Activity multipliers are the standard Harris-Benedict/Mifflin activity factors; individual energy needs vary."],
  limitations: ["Does not account for illness, injury, pregnancy, or significant body composition differences."],
}

export const waistToHeightRatioCalculator: CalculatorDefinition = {
  id: "waist-to-height-ratio",
  name: "Waist-to-Height Ratio",
  shortName: "WHtR",
  category: "general",
  description: "Calculates the ratio of waist circumference to height, a marker of central adiposity.",
  formula: "WHtR = Waist circumference / Height (same units)",
  keywords: ["waist to height ratio", "whtr", "central adiposity", "abdominal obesity"],
  relatedTools: ["bmi", "waist-to-hip-ratio"],
  inputs: [
    { id: "waist", label: "Waist circumference", kind: "number", unit: "cm", min: 0, defaultValue: 80 },
    { id: "height", label: "Height", kind: "number", unit: "cm", min: 0, defaultValue: 170 },
  ],
  calculate: (inputs) => {
    const waist = num(inputs, "waist")
    const height = num(inputs, "height")
    assertPositive(waist, "Waist circumference")
    assertPositive(height, "Height")

    const ratio = safeDivide(waist, height, "height")
    const rounded = round(ratio, 2)

    let interpretation = "Below the commonly cited 0.5 threshold."
    if (ratio >= 0.5) interpretation = "At or above the commonly cited 0.5 threshold, sometimes used as a simple screening cutoff for increased cardiometabolic risk."

    return {
      value: rounded,
      display: fmt(rounded, 2),
      calculationSteps: [`${waist} / ${height}`],
      interpretation,
    }
  },
  notes: ["\"Keep your waist to less than half your height\" (WHtR < 0.5) is a commonly cited rule of thumb, though cutoffs vary by population and guideline."],
  limitations: ["Does not account for sex, age, or body composition differences; not a diagnostic measure on its own."],
}

export const waistToHipRatioCalculator: CalculatorDefinition = {
  id: "waist-to-hip-ratio",
  name: "Waist-to-Hip Ratio",
  shortName: "WHR",
  category: "general",
  description: "Calculates the ratio of waist circumference to hip circumference, a marker of fat distribution.",
  formula: "WHR = Waist circumference / Hip circumference (same units)",
  keywords: ["waist to hip ratio", "whr", "fat distribution", "abdominal obesity"],
  relatedTools: ["bmi", "waist-to-height-ratio"],
  inputs: [
    {
      id: "sex",
      label: "Sex",
      kind: "select",
      options: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
      defaultValue: "male",
    },
    { id: "waist", label: "Waist circumference", kind: "number", unit: "cm", min: 0, defaultValue: 80 },
    { id: "hip", label: "Hip circumference", kind: "number", unit: "cm", min: 0, defaultValue: 100 },
  ],
  calculate: (inputs) => {
    const sex = str(inputs, "sex")
    const waist = num(inputs, "waist")
    const hip = num(inputs, "hip")
    assertPositive(waist, "Waist circumference")
    assertPositive(hip, "Hip circumference")

    const ratio = safeDivide(waist, hip, "hip circumference")
    const rounded = round(ratio, 2)

    const threshold = sex === "male" ? 0.9 : 0.85
    const interpretation =
      ratio >= threshold
        ? `At or above the commonly cited WHO threshold for ${sex === "male" ? "men" : "women"} (${threshold}), sometimes used as a screening indicator for increased health risk.`
        : `Below the commonly cited WHO threshold for ${sex === "male" ? "men" : "women"} (${threshold}).`

    return {
      value: rounded,
      display: fmt(rounded, 2),
      calculationSteps: [`${waist} / ${hip}`],
      interpretation,
    }
  },
  notes: ["WHO commonly cites 0.90 (men) and 0.85 (women) as screening thresholds; other guidelines use different cutoffs."],
  limitations: ["Measurement technique (where waist/hip are measured) significantly affects results; not a diagnostic measure on its own."],
}
