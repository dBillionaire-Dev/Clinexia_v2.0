import type { CalculatorDefinition } from "../types"
import { CalculatorInputError, assertNonNegative, assertPositive, fmt, num, optionalNum, round, str } from "../helpers"
import { addDays, diffDays, formatDate, formatIsoDate, optionalIsoDate, parseIsoDate, todayUtcMs, weeksAndDays } from "../date-helpers"

/* ------------------------------------------------------------------ unit helpers */

const heightToCm = (value: number, unit: string) => {
  switch (unit) {
    case "m":
      return value * 100
    case "ft":
      return value * 30.48
    case "in":
      return value * 2.54
    default:
      return value
  }
}
const weightToKg = (value: number, unit: string) => (unit === "lb" ? value * 0.453592 : value)

function requireSex(inputs: Record<string, number | string>): "male" | "female" {
  const sex = str(inputs, "sex")
  if (sex !== "male" && sex !== "female") throw new CalculatorInputError("Select male or female")
  return sex
}

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
]

/* ------------------------------------------------------------------ pregnancy dating */

const PREGNANCY_DAYS = 280
const STANDARD_CYCLE = 28

/** Naegele's rule: LMP + 280 days, shifted by how far the cycle length is from 28 days. */
export function estimatedDueDateMs(lmpMs: number, cycleLength: number): number {
  return addDays(lmpMs, PREGNANCY_DAYS + (cycleLength - STANDARD_CYCLE))
}

/** Days of gestation on `asOfMs`, counted from the LMP with the same cycle-length shift. */
export function gestationDaysFromLmp(lmpMs: number, asOfMs: number, cycleLength: number): number {
  return diffDays(asOfMs, lmpMs) - (cycleLength - STANDARD_CYCLE)
}

/** Trimester boundaries from ACOG Committee Opinion 700: first to 13w6d, second 14w0d to 27w6d, third from 28w0d. */
export function trimesterLabel(gestationDays: number): string {
  if (gestationDays < 14 * 7) return "First trimester"
  if (gestationDays < 28 * 7) return "Second trimester"
  return "Third trimester"
}

function readCycleLength(inputs: Record<string, number | string>): number {
  const raw = optionalNum(inputs, "cycleLength")
  const cycle = Math.round(raw ?? STANDARD_CYCLE)
  if (cycle < 21 || cycle > 45) throw new CalculatorInputError("Cycle length must be between 21 and 45 days")
  return cycle
}

const PREGNANCY_LIMITATIONS = [
  "Dating from the last menstrual period is unreliable if cycles are irregular, the date is uncertain, or hormonal contraception was used recently.",
  "An early ultrasound is the most accurate way to date a pregnancy and takes precedence when it differs enough from the LMP (ACOG CO 700 sets the thresholds). A pregnancy not confirmed by ultrasound before 22 0/7 weeks is considered suboptimally dated.",
  "After assisted reproduction (IVF, IUI), use the date the ART procedure gives, not the LMP.",
  "An estimate, not a diagnosis. Only a clinician can confirm gestational age and the due date.",
]

/* ------------------------------------------------------------------ 1. daily water intake */

/** EFSA (2010) adequate intake of total water, mL/day: drinks plus water in food. */
function waterAdequateIntake(age: number, sex: "male" | "female"): { ml: number; basis: string } {
  if (age < 4) return { ml: 1300, basis: "children 2 to 3 years" }
  if (age < 9) return { ml: 1600, basis: "children 4 to 8 years" }
  if (age < 14) return sex === "male" ? { ml: 2100, basis: "boys 9 to 13 years" } : { ml: 1900, basis: "girls 9 to 13 years" }
  return sex === "male" ? { ml: 2500, basis: "men (14 years and over)" } : { ml: 2000, basis: "women (14 years and over)" }
}

export const dailyWaterIntakeCalculator: CalculatorDefinition = {
  id: "daily-water-intake",
  name: "Daily Water Intake",
  shortName: "Water Intake",
  category: "general",
  isEstimator: true,
  description: "Adequate daily total water intake for a healthy person by age and sex, with the extra needed in pregnancy and breastfeeding.",
  formula: "Total water (mL/day) = EFSA adequate intake for age and sex + 300 mL (pregnancy) or + 700 mL (breastfeeding)",
  keywords: ["water", "hydration", "fluid", "daily water", "drink", "pregnancy", "breastfeeding", "efsa"],
  relatedTools: ["bmi", "bmr", "estimated-calorie-requirement"],
  inputs: [
    { id: "age", label: "Age", kind: "number", unit: "years", min: 2, max: 120, placeholder: "e.g. 30" },
    { id: "sex", label: "Sex", kind: "select", options: SEX_OPTIONS },
    {
      id: "status",
      label: "Pregnancy or breastfeeding",
      kind: "select",
      options: [
        { value: "none", label: "Neither" },
        { value: "pregnant", label: "Pregnant" },
        { value: "lactating", label: "Breastfeeding" },
      ],
      defaultValue: "none",
    },
  ],
  calculate: (inputs) => {
    const age = num(inputs, "age")
    const sex = requireSex(inputs)
    const status = str(inputs, "status")
    if (age < 2) throw new CalculatorInputError("This calculator covers ages 2 and over. Infants and toddlers under 2 have different needs.")
    if (age > 120) throw new CalculatorInputError("Age must be 120 or less")
    if (status !== "none" && status !== "pregnant" && status !== "lactating") throw new CalculatorInputError("Select a valid pregnancy or breastfeeding option")
    if (status !== "none") {
      if (sex !== "female") throw new CalculatorInputError("Pregnancy and breastfeeding apply to females only")
      if (age < 14) throw new CalculatorInputError("The pregnancy and breastfeeding adjustments apply from age 14")
    }

    const base = waterAdequateIntake(age, sex)
    const extra = status === "pregnant" ? 300 : status === "lactating" ? 700 : 0
    const total = base.ml + extra

    const secondary = [
      { label: "Total water", value: `${total} mL per day` },
      { label: "Adequate intake for", value: `${base.basis}: ${base.ml} mL` },
    ]
    if (extra) secondary.push({ label: status === "pregnant" ? "Added for pregnancy" : "Added for breastfeeding", value: `+${extra} mL` })

    return {
      value: total,
      unit: "mL/day",
      display: fmt(total / 1000, 1, "L per day"),
      secondary,
      calculationSteps: [extra ? `${base.ml} mL + ${extra} mL = ${total} mL` : `${base.ml} mL (${base.basis})`],
      interpretation: "Adequate intake of total water, which includes all drinks and the water in food, for a healthy person at moderate temperature and moderate activity.",
      warnings: ["Needs rise with heat, hard exercise, fever, vomiting or diarrhoea. People told to limit fluids should follow their clinician's target instead."],
    }
  },
  notes: [
    "EFSA adequate intakes of total water (mL/day): 2 to 3 years 1300; 4 to 8 years 1600; 9 to 13 years boys 2100, girls 1900; 14 years and over men 2500, women 2000.",
    "The figure covers water from drinks and from food, so it is not the amount to drink on its own.",
  ],
  limitations: [
    "Adequate intakes apply to healthy people at moderate environmental temperature and moderate physical activity.",
    "Not for people on a fluid restriction or with heart, kidney, liver or sodium-balance conditions; their targets come from their clinician.",
    "Covers ages 2 and over; infants and toddlers under 2 have different needs.",
    "Adequate intake is a population reference value, not an individual requirement.",
  ],
}

/* ------------------------------------------------------------------ 2. estimated due date */

export const estimatedDueDateCalculator: CalculatorDefinition = {
  id: "estimated-due-date",
  name: "Estimated Due Date (EDD)",
  shortName: "Due Date (EDD)",
  category: "general",
  isEstimator: true,
  description: "Estimates the due date from the first day of the last menstrual period (Naegele's rule: 280 days), adjusted for cycle length.",
  formula: "EDD = LMP + 280 days + (cycle length − 28) days",
  keywords: ["edd", "due date", "estimated due date", "pregnancy", "naegele", "lmp", "last menstrual period", "expected delivery", "gestation"],
  relatedTools: ["gestational-age"],
  inputs: [
    { id: "lmp", label: "First day of last menstrual period (LMP)", kind: "date", helpText: "The first day of your last period." },
    { id: "cycleLength", label: "Average cycle length", kind: "number", unit: "days", min: 21, max: 45, placeholder: "28", optional: true, helpText: "Leave blank for a 28-day cycle." },
  ],
  calculate: (inputs) => {
    const lmp = parseIsoDate(inputs.lmp, "Last menstrual period")
    const cycle = readCycleLength(inputs)
    const today = todayUtcMs()
    if (lmp > today) throw new CalculatorInputError("The last menstrual period cannot be in the future")

    const edd = estimatedDueDateMs(lmp, cycle)
    const gaToday = gestationDaysFromLmp(lmp, today, cycle)
    const untilDue = diffDays(edd, today)
    const adjustment = cycle - STANDARD_CYCLE

    const warnings: string[] = []
    if (gaToday > 42 * 7) warnings.push("More than 42 weeks have passed since this LMP. Check the date, or whether the pregnancy has already ended.")

    return {
      value: formatIsoDate(edd),
      display: formatDate(edd),
      secondary: [
        { label: "Gestational age today", value: weeksAndDays(gaToday) },
        { label: "Trimester today", value: trimesterLabel(gaToday) },
        { label: untilDue >= 0 ? "Days until due date" : "Days past due date", value: String(Math.abs(untilDue)) },
        { label: "Cycle length used", value: `${cycle} days` },
      ],
      calculationSteps: [
        `${formatDate(lmp)} + ${PREGNANCY_DAYS} days${adjustment ? ` ${adjustment > 0 ? "+" : "−"} ${Math.abs(adjustment)} days (cycle ${cycle} vs 28)` : ""} = ${formatDate(edd)}`,
      ],
      interpretation: "Estimated due date by last-menstrual-period dating (Naegele's rule). Most pregnancies are dated or confirmed by an early ultrasound; the clinician's date is the one to use.",
      warnings: warnings.length ? warnings : undefined,
    }
  },
  notes: [
    "Gestational age is counted from the first day of the last menstrual period; an average pregnancy lasts 280 days (40 weeks).",
    "Naegele's rule is the same as adding 280 days to the LMP: add 7 days, subtract 3 months, add 1 year.",
    "A cycle longer or shorter than 28 days moves the date by the difference.",
  ],
  limitations: PREGNANCY_LIMITATIONS,
}

/* ------------------------------------------------------------------ 3. gestational age */

export const gestationalAgeCalculator: CalculatorDefinition = {
  id: "gestational-age",
  name: "Gestational Age",
  shortName: "Gestational Age",
  category: "general",
  isEstimator: true,
  description: "Weeks and days of pregnancy on a chosen date, from either the last menstrual period or the due date.",
  formula: "Gestational age = date − LMP (adjusted for cycle length), or 280 days − (EDD − date)",
  keywords: ["gestational age", "weeks pregnant", "pregnancy", "trimester", "lmp", "edd", "gestation", "how far along"],
  relatedTools: ["estimated-due-date"],
  inputs: [
    { id: "lmp", label: "First day of last menstrual period (LMP)", kind: "date", optional: true, helpText: "Enter either the LMP or the due date, not both." },
    { id: "edd", label: "Estimated due date (EDD)", kind: "date", optional: true, helpText: "Use this if you know the due date but not the LMP." },
    { id: "asOf", label: "Calculate for this date", kind: "date", optional: true, helpText: "Leave blank for today." },
    { id: "cycleLength", label: "Average cycle length (LMP method only)", kind: "number", unit: "days", min: 21, max: 45, placeholder: "28", optional: true },
  ],
  calculate: (inputs) => {
    const lmp = optionalIsoDate(inputs, "lmp", "Last menstrual period")
    const edd = optionalIsoDate(inputs, "edd", "Due date")
    if (lmp === undefined && edd === undefined) throw new CalculatorInputError("Enter either the last menstrual period or the due date")
    if (lmp !== undefined && edd !== undefined) throw new CalculatorInputError("Enter either the last menstrual period or the due date, not both")
    const asOf = optionalIsoDate(inputs, "asOf", "Calculation date") ?? todayUtcMs()
    const cycle = readCycleLength(inputs)

    let gestationDays: number
    let dueMs: number
    let method: string
    if (lmp !== undefined) {
      gestationDays = gestationDaysFromLmp(lmp, asOf, cycle)
      dueMs = estimatedDueDateMs(lmp, cycle)
      method = "last menstrual period"
    } else {
      dueMs = edd as number
      gestationDays = PREGNANCY_DAYS - diffDays(dueMs, asOf)
      method = "due date"
    }
    if (gestationDays < 0) throw new CalculatorInputError("The calculation date is before the start of the pregnancy for these dates")

    const untilDue = diffDays(dueMs, asOf)
    const warnings: string[] = []
    if (gestationDays > 42 * 7) warnings.push("This is beyond 42 weeks. Check the dates, or whether the pregnancy has already ended.")

    return {
      value: weeksAndDays(gestationDays),
      display: weeksAndDays(gestationDays),
      secondary: [
        { label: "Trimester", value: trimesterLabel(gestationDays) },
        { label: "Total days", value: String(gestationDays) },
        { label: "Estimated due date", value: formatDate(dueMs) },
        { label: untilDue >= 0 ? "Days until due date" : "Days past due date", value: String(Math.abs(untilDue)) },
        { label: "Calculated for", value: formatDate(asOf) },
      ],
      calculationSteps: [`Counted from the ${method}: ${gestationDays} days = ${weeksAndDays(gestationDays)}`],
      interpretation: "Gestational age by menstrual or due-date dating. Trimester boundaries follow ACOG: first trimester to 13 weeks 6 days, second 14 weeks 0 days to 27 weeks 6 days, third from 28 weeks 0 days.",
      warnings: warnings.length ? warnings : undefined,
    }
  },
  notes: [
    "Gestational age is counted from the first day of the last menstrual period, so it runs about two weeks ahead of the time since conception.",
    "When you enter a due date, the pregnancy is taken to start 280 days before it.",
  ],
  limitations: PREGNANCY_LIMITATIONS,
}

/* ------------------------------------------------------------------ 4. lean body mass (Boer) */

export const leanBodyMassCalculator: CalculatorDefinition = {
  id: "lean-body-mass",
  name: "Lean Body Mass (Boer)",
  shortName: "Lean Body Mass",
  category: "general",
  isEstimator: true,
  description: "Estimates lean body mass from sex, weight and height with the Boer equations.",
  formula: "Men: LBM = 0.407 × weight (kg) + 0.267 × height (cm) − 19.2.  Women: LBM = 0.252 × weight (kg) + 0.473 × height (cm) − 48.3",
  keywords: ["lean body mass", "lbm", "boer", "fat free mass", "body composition", "fat mass"],
  relatedTools: ["bmi", "bsa", "ideal-body-weight", "adjusted-body-weight"],
  inputs: [
    { id: "sex", label: "Sex", kind: "select", options: SEX_OPTIONS },
    { id: "weight", label: "Weight", kind: "number", unit: "kg", min: 0, placeholder: "e.g. 70" },
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
    { id: "height", label: "Height", kind: "number", unit: "cm", min: 0, placeholder: "e.g. 170" },
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
    const sex = requireSex(inputs)
    const weight = num(inputs, "weight")
    const height = num(inputs, "height")
    assertPositive(weight, "Weight")
    assertPositive(height, "Height")
    const weightKg = weightToKg(weight, str(inputs, "weightUnit"))
    const heightCm = heightToCm(height, str(inputs, "heightUnit"))

    const lbm = sex === "male" ? 0.407 * weightKg + 0.267 * heightCm - 19.2 : 0.252 * weightKg + 0.473 * heightCm - 48.3
    if (!(lbm > 0)) throw new CalculatorInputError("The equation gives no valid result for these values. Check weight and height.")

    const fat = weightKg - lbm
    const warnings: string[] = []
    if (lbm > weightKg) warnings.push("The estimated lean mass is higher than body weight, so the equation is outside its useful range for these values.")

    return {
      value: round(lbm, 1),
      unit: "kg",
      display: fmt(lbm, 1, "kg"),
      secondary: [
        { label: "Lean mass as % of weight", value: `${round((lbm / weightKg) * 100, 0)}%` },
        { label: "Estimated non-lean (fat) mass", value: fat > 0 ? fmt(fat, 1, "kg") : "0 kg" },
      ],
      calculationSteps: [
        sex === "male"
          ? `0.407 × ${round(weightKg, 1)} + 0.267 × ${round(heightCm, 1)} − 19.2`
          : `0.252 × ${round(weightKg, 1)} + 0.473 × ${round(heightCm, 1)} − 48.3`,
      ],
      interpretation: "Estimated lean body mass (everything except fat: muscle, bone, organs and water). It is calculated from size and sex, so it does not measure muscle.",
      warnings: warnings.length ? warnings : undefined,
    }
  },
  notes: [
    "Used to size some drug doses and to normalise body fluid volumes, because fat contributes little to them.",
    "James and Hume equations also exist and can differ from Boer by a few kilograms.",
  ],
  limitations: [
    "A prediction equation from adults; not for children.",
    "Two people of the same height, weight and sex get the same answer whatever their muscle or fat, and prediction equations are less reliable at the extremes of body size.",
    "Does not replace body composition measurement (for example DXA or bioimpedance) where that matters.",
  ],
}

/* ------------------------------------------------------------------ 5. target heart rate (Karvonen) */

const INTENSITIES = [0.5, 0.6, 0.7, 0.8, 0.9]

export const targetHeartRateCalculator: CalculatorDefinition = {
  id: "target-heart-rate",
  name: "Target Heart Rate (Karvonen)",
  shortName: "Target Heart Rate",
  category: "general",
  isEstimator: true,
  description: "Estimated maximum heart rate (Tanaka) and exercise target heart rates from heart rate reserve (Karvonen).",
  formula: "HRmax = 208 − 0.7 × age.  Target HR = resting HR + % × (HRmax − resting HR)",
  keywords: ["heart rate", "target heart rate", "max heart rate", "hrmax", "karvonen", "tanaka", "heart rate reserve", "exercise", "training zone"],
  relatedTools: ["mean-arterial-pressure", "pulse-pressure"],
  inputs: [
    { id: "age", label: "Age", kind: "number", unit: "years", min: 18, max: 100, placeholder: "e.g. 35" },
    { id: "restingHr", label: "Resting heart rate", kind: "number", unit: "bpm", min: 30, max: 120, placeholder: "e.g. 65", helpText: "Count the pulse for a full minute after resting, ideally first thing in the morning." },
  ],
  calculate: (inputs) => {
    const age = num(inputs, "age")
    const rest = num(inputs, "restingHr")
    if (age < 18 || age > 100) throw new CalculatorInputError("Age must be between 18 and 100 years")
    if (rest < 30 || rest > 120) throw new CalculatorInputError("Resting heart rate must be between 30 and 120 bpm")

    const hrMax = Math.round(208 - 0.7 * age)
    if (rest >= hrMax) throw new CalculatorInputError("Resting heart rate must be lower than the estimated maximum heart rate")
    const reserve = hrMax - rest

    return {
      value: hrMax,
      unit: "bpm",
      display: fmt(hrMax, 0, "bpm"),
      secondary: [
        { label: "Heart rate reserve", value: `${reserve} bpm` },
        ...INTENSITIES.map((p) => ({ label: `Target at ${Math.round(p * 100)}% of reserve`, value: `${Math.round(rest + p * reserve)} bpm` })),
      ],
      calculationSteps: [`HRmax = 208 − 0.7 × ${age} = ${hrMax} bpm`, `Reserve = ${hrMax} − ${rest} = ${reserve} bpm`],
      interpretation: "Estimated maximum heart rate with target rates at several intensities. Pick the intensity that suits your fitness and your clinician's advice.",
      warnings: ["Individual maximum heart rate can differ from the estimate by about 10 beats per minute or more."],
    }
  },
  notes: [
    "The Tanaka equation comes from a meta-analysis of 18,712 healthy adults (351 studies) and was independent of sex and habitual activity. It is used in place of the older 220 − age rule.",
    "The Karvonen method adds a percentage of the heart rate reserve to the resting rate, so a fitter person with a lower resting rate gets lower targets.",
  ],
  limitations: [
    "For healthy adults. Not for people with heart disease, arrhythmias or other conditions where an exercise heart rate limit has been set; follow your clinician.",
    "Beta-blockers and some other medicines lower heart rate, so the estimated targets are not valid on them.",
    "Based on age alone; it does not replace a maximal exercise test.",
  ],
}

/* ------------------------------------------------------------------ 6. pack-years */

export const packYearsCalculator: CalculatorDefinition = {
  id: "pack-years",
  name: "Pack-Years (Smoking)",
  shortName: "Pack-Years",
  category: "general",
  description: "Cumulative cigarette smoking exposure in pack-years.",
  formula: "Pack-years = (cigarettes per day ÷ cigarettes per pack) × years smoked",
  keywords: ["pack years", "pack-years", "smoking", "cigarettes", "tobacco", "smoking history", "lung cancer screening"],
  relatedTools: ["alcohol-units"],
  inputs: [
    { id: "cigarettesPerDay", label: "Cigarettes per day", kind: "number", min: 0, placeholder: "e.g. 10" },
    { id: "yearsSmoked", label: "Years smoked", kind: "number", unit: "years", min: 0, max: 90, placeholder: "e.g. 15" },
    { id: "cigarettesPerPack", label: "Cigarettes per pack", kind: "number", min: 1, placeholder: "20", optional: true, helpText: "Leave blank for a standard 20-cigarette pack." },
  ],
  calculate: (inputs) => {
    const perDay = num(inputs, "cigarettesPerDay")
    const years = num(inputs, "yearsSmoked")
    const perPack = optionalNum(inputs, "cigarettesPerPack") ?? 20
    assertPositive(perDay, "Cigarettes per day")
    assertPositive(years, "Years smoked")
    assertPositive(perPack, "Cigarettes per pack")
    if (years > 90) throw new CalculatorInputError("Years smoked must be 90 or less")

    const packYears = (perDay / perPack) * years
    return {
      value: round(packYears, 1),
      unit: "pack-years",
      display: fmt(packYears, 1, "pack-years"),
      secondary: [{ label: "20 pack-years or more", value: packYears >= 20 ? "Yes" : "No" }],
      calculationSteps: [`(${perDay} ÷ ${perPack}) × ${years} years = ${round(packYears, 1)}`],
      interpretation: "One pack-year equals smoking 20 cigarettes (one pack) a day for a year. A history of 20 or more pack-years is one of the criteria in the 2021 USPSTF lung cancer screening recommendation, which also requires age 50 to 80 and current smoking or quitting within the past 15 years.",
    }
  },
  notes: [
    "If the amount smoked changed over time, calculate each period separately and add the results.",
    "Screening eligibility rules differ between countries and change over time; check current local guidance.",
  ],
  limitations: [
    "Based on cigarettes only; pipes, cigars, shisha and other tobacco use are not converted.",
    "Relies on the person's recall of past smoking.",
    "Pack-years measure exposure, not risk by themselves; age, years since quitting and other factors matter.",
  ],
}

/* ------------------------------------------------------------------ 7. alcohol units */

const UK_UNIT_ML = 10
const UK_UNIT_GRAMS = 8
const UK_WEEKLY_GUIDELINE_UNITS = 14

export const alcoholUnitsCalculator: CalculatorDefinition = {
  id: "alcohol-units",
  name: "Alcohol Units (UK)",
  shortName: "Alcohol Units",
  category: "general",
  description: "UK alcohol units in a drink from its volume and strength, with the pure alcohol it contains.",
  formula: "Units = volume (mL) × ABV (%) ÷ 1000.  One UK unit = 10 mL (8 g) of pure alcohol",
  keywords: ["alcohol", "units", "abv", "drink", "drinking", "alcohol units", "beer", "wine", "spirits", "low risk drinking"],
  relatedTools: ["pack-years"],
  inputs: [
    { id: "volume", label: "Volume of one drink", kind: "number", unit: "mL", min: 0, placeholder: "e.g. 175" },
    { id: "abv", label: "Alcohol strength (ABV)", kind: "number", unit: "%", min: 0, max: 100, placeholder: "e.g. 13" },
    { id: "drinks", label: "Number of drinks", kind: "number", min: 0, placeholder: "1", optional: true, helpText: "Leave blank for one drink." },
  ],
  calculate: (inputs) => {
    const volume = num(inputs, "volume")
    const abv = num(inputs, "abv")
    const drinks = optionalNum(inputs, "drinks") ?? 1
    assertPositive(volume, "Volume")
    assertNonNegative(abv, "Alcohol strength")
    assertPositive(drinks, "Number of drinks")
    if (abv > 100) throw new CalculatorInputError("Alcohol strength (ABV) cannot be more than 100%")

    const units = ((volume * abv) / 1000) * drinks
    return {
      value: round(units, 1),
      unit: "UK units",
      display: fmt(units, 1, "UK units"),
      secondary: [
        { label: "Pure alcohol", value: `${fmt(units * UK_UNIT_ML, 0, "mL")} (about ${fmt(units * UK_UNIT_GRAMS, 0, "g")})` },
        { label: "Share of the UK weekly guideline (14 units)", value: `${round((units / UK_WEEKLY_GUIDELINE_UNITS) * 100, 0)}%` },
      ],
      calculationSteps: [`${volume} mL × ${abv}% ÷ 1000${drinks !== 1 ? ` × ${drinks} drinks` : ""} = ${round(units, 2)} units`],
      interpretation: "The UK Chief Medical Officers advise not regularly drinking more than 14 units a week, spread over three or more days. That is low-risk drinking, not safe drinking. If pregnant or planning a pregnancy, the safest approach is not to drink alcohol.",
    }
  },
  notes: [
    "A pint of 4% beer is about 2.3 units; a 175 mL glass of 13% wine is about 2.3 units; a 25 mL spirit measure at 40% is 1 unit.",
    "Home pours are often larger than bar measures, so units are easy to underestimate.",
  ],
  limitations: [
    "Uses the UK unit (10 mL or 8 g of pure alcohol). Other countries define units and standard drinks differently.",
    "Does not estimate blood alcohol concentration or fitness to drive.",
    "Not advice for anyone who is pregnant, on interacting medicines or with a health condition affected by alcohol.",
  ],
}

export const everydayCalculators: CalculatorDefinition[] = [
  dailyWaterIntakeCalculator,
  estimatedDueDateCalculator,
  gestationalAgeCalculator,
  leanBodyMassCalculator,
  targetHeartRateCalculator,
  packYearsCalculator,
  alcoholUnitsCalculator,
]
