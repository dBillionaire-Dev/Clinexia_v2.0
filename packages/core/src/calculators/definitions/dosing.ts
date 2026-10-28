import type { CalculatorDefinition } from "../types"
import { num, str, assertPositive, assertNonNegative, round, fmt } from "../helpers"

/**
 * Generic dose arithmetic. These tools intentionally do not choose a drug,
 * indication, dose regimen, or maximum dose for the user.
 */
export const mgPerKgDoseCalculator: CalculatorDefinition = {
  id: "mg-per-kg-dose",
  name: "Weight-Based Dose (mg/kg)",
  shortName: "mg/kg Dose",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates a dose from a prescribed mg/kg dose and the patient's actual weight.",
  formula: "Dose (mg) = prescribed dose (mg/kg) × weight (kg)",
  keywords: ["mg/kg", "weight based dose", "dose", "drug dosing"],
  relatedTools: ["bmi", "bsa", "creatinine-clearance"],
  inputs: [
    { id: "dosePerKg", label: "Prescribed dose", kind: "number", unit: "mg/kg", min: 0, step: 0.01 },
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0, step: 0.1 },
  ],
  calculate: (inputs) => {
    const dosePerKg = num(inputs, "dosePerKg")
    const weight = num(inputs, "weight")
    assertPositive(dosePerKg, "Prescribed dose")
    assertPositive(weight, "Patient weight")
    const dose = round(dosePerKg * weight, 2)
    return {
      value: dose,
      unit: "mg",
      display: fmt(dose, 2, "mg"),
      calculationSteps: [`${dosePerKg} mg/kg × ${weight} kg = ${dose} mg`],
      interpretation: "Mathematical dose calculation only. Use the drug-specific regimen, route, maximum dose and formulation instructions that apply to the patient.",
    }
  },
  notes: ["Use actual, ideal, adjusted or another dosing weight only when the applicable drug protocol specifically calls for it."],
}

export const mgPerKgDayCalculator: CalculatorDefinition = {
  id: "mg-per-kg-per-day-dose",
  name: "Weight-Based Daily Dose (mg/kg/day)",
  shortName: "mg/kg/day",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates a total daily dose from a prescribed mg/kg/day regimen.",
  formula: "Daily dose (mg/day) = prescribed dose (mg/kg/day) × weight (kg)",
  keywords: ["mg/kg/day", "daily dose", "weight based", "drug dosing"],
  relatedTools: ["mg-per-kg-dose", "dose-per-administration"],
  inputs: [
    { id: "dosePerKgDay", label: "Prescribed daily dose", kind: "number", unit: "mg/kg/day", min: 0, step: 0.01 },
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0, step: 0.1 },
    { id: "dosesPerDay", label: "Doses per day", kind: "number", unit: "doses/day", min: 1, step: 1, defaultValue: 1 },
  ],
  calculate: (inputs) => {
    const dosePerKgDay = num(inputs, "dosePerKgDay")
    const weight = num(inputs, "weight")
    const dosesPerDay = num(inputs, "dosesPerDay")
    assertPositive(dosePerKgDay, "Prescribed daily dose")
    assertPositive(weight, "Patient weight")
    assertPositive(dosesPerDay, "Doses per day")
    const daily = round(dosePerKgDay * weight, 2)
    const perDose = round(daily / dosesPerDay, 2)
    return {
      perDoseMg: { low: daily / dosesPerDay },
      value: daily,
      unit: "mg/day",
      display: fmt(daily, 2, "mg/day"),
      secondary: [{ label: "Dose per administration", value: fmt(perDose, 2, "mg") }],
      calculationSteps: [
        `${dosePerKgDay} mg/kg/day × ${weight} kg = ${daily} mg/day`,
        `${daily} mg/day ÷ ${dosesPerDay} doses/day = ${perDose} mg/dose`,
      ],
    }
  },
}

export const mgPerM2DoseCalculator: CalculatorDefinition = {
  id: "mg-per-m2-dose",
  name: "Body Surface Area Dose (mg/m²)",
  shortName: "mg/m² Dose",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates a dose from a prescribed mg/m² dose and an existing BSA value.",
  formula: "Dose (mg) = prescribed dose (mg/m²) × BSA (m²)",
  keywords: ["mg/m2", "mg/m²", "bsa dose", "body surface area dosing", "chemotherapy"],
  relatedTools: ["bsa"],
  inputs: [
    { id: "dosePerM2", label: "Prescribed dose", kind: "number", unit: "mg/m²", min: 0, step: 0.01 },
    { id: "bsa", label: "Patient BSA", kind: "number", unit: "m²", min: 0, step: 0.01 },
  ],
  calculate: (inputs) => {
    const dosePerM2 = num(inputs, "dosePerM2")
    const bsa = num(inputs, "bsa")
    assertPositive(dosePerM2, "Prescribed dose")
    assertPositive(bsa, "Patient BSA")
    const dose = round(dosePerM2 * bsa, 2)
    return {
      value: dose,
      unit: "mg",
      display: fmt(dose, 2, "mg"),
      calculationSteps: [`${dosePerM2} mg/m² × ${bsa} m² = ${dose} mg`],
      interpretation: "Mathematical dose calculation only. Follow the drug-specific protocol for dose caps, rounding and formulation constraints.",
    }
  },
}

export const dosePerAdministrationCalculator: CalculatorDefinition = {
  id: "dose-per-administration",
  name: "Dose per Administration",
  shortName: "Dose/Frequency",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Divides a prescribed total daily dose across the specified number of administrations.",
  formula: "Dose per administration = total daily dose ÷ administrations per day",
  keywords: ["dose frequency", "dose per administration", "daily dose", "frequency"],
  relatedTools: ["mg-per-kg-per-day-dose"],
  inputs: [
    { id: "dailyDose", label: "Total daily dose", kind: "number", unit: "mg/day", min: 0, step: 0.01 },
    { id: "administrations", label: "Administrations per day", kind: "number", unit: "doses/day", min: 1, step: 1 },
  ],
  calculate: (inputs) => {
    const dailyDose = num(inputs, "dailyDose")
    const administrations = num(inputs, "administrations")
    assertPositive(dailyDose, "Total daily dose")
    assertPositive(administrations, "Administrations per day")
    const dose = round(dailyDose / administrations, 2)
    return {
      value: dose,
      unit: "mg/dose",
      display: fmt(dose, 2, "mg/dose"),
      calculationSteps: [`${dailyDose} mg/day ÷ ${administrations} doses/day = ${dose} mg/dose`],
    }
  },
}

export const doseVolumeCalculator: CalculatorDefinition = {
  id: "dose-volume",
  name: "Dose to Volume",
  shortName: "Dose  to  Volume",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Converts a required drug dose into a volume when the available concentration is known.",
  formula: "Volume (mL) = required dose (mg) ÷ concentration (mg/mL)",
  keywords: ["dose volume", "mg/ml", "mg/mL", "liquid dose", "injection volume"],
  relatedTools: ["drug-concentration"],
  inputs: [
    { id: "dose", label: "Required dose", kind: "number", unit: "mg", min: 0, step: 0.01 },
    { id: "concentration", label: "Available concentration", kind: "number", unit: "mg/mL", min: 0, step: 0.01 },
  ],
  calculate: (inputs) => {
    const dose = num(inputs, "dose")
    const concentration = num(inputs, "concentration")
    assertPositive(dose, "Required dose")
    assertPositive(concentration, "Available concentration")
    const volume = round(dose / concentration, 3)
    return {
      value: volume,
      unit: "mL",
      display: fmt(volume, 3, "mL"),
      calculationSteps: [`${dose} mg ÷ ${concentration} mg/mL = ${volume} mL`],
      warnings: volume < 0.1 ? ["Very small volume, kindly verify the concentration, syringe accuracy and applicable administration protocol."] : undefined,
    }
  },
}

export const drugConcentrationCalculator: CalculatorDefinition = {
  id: "drug-concentration",
  name: "Drug Concentration",
  shortName: "Drug Concentration",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates drug concentration from the amount of drug and final solution volume.",
  formula: "Concentration (mg/mL) = drug amount (mg) ÷ final volume (mL)",
  keywords: ["drug concentration", "mg/ml", "mg/mL", "solution concentration"],
  relatedTools: ["dose-volume", "infusion-rate"],
  inputs: [
    { id: "drugAmount", label: "Drug amount", kind: "number", unit: "mg", min: 0, step: 0.01 },
    { id: "finalVolume", label: "Final volume", kind: "number", unit: "mL", min: 0, step: 0.1 },
  ],
  calculate: (inputs) => {
    const drugAmount = num(inputs, "drugAmount")
    const finalVolume = num(inputs, "finalVolume")
    assertPositive(drugAmount, "Drug amount")
    assertPositive(finalVolume, "Final volume")
    const concentration = round(drugAmount / finalVolume, 3)
    return {
      value: concentration,
      unit: "mg/mL",
      display: fmt(concentration, 3, "mg/mL"),
      calculationSteps: [`${drugAmount} mg ÷ ${finalVolume} mL = ${concentration} mg/mL`],
    }
  },
}

export const infusionRateCalculator: CalculatorDefinition = {
  id: "infusion-rate",
  name: "Infusion Rate",
  shortName: "mL/hr",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates an infusion rate from volume and infusion time.",
  formula: "Rate (mL/hr) = volume (mL) ÷ time (hr)",
  keywords: ["infusion rate", "iv rate", "mL/hr", "ml/hr", "drip rate"],
  inputs: [
    { id: "volume", label: "Infusion volume", kind: "number", unit: "mL", min: 0, step: 0.1 },
    { id: "time", label: "Infusion time", kind: "number", unit: "hours", min: 0, step: 0.1 },
  ],
  calculate: (inputs) => {
    const volume = num(inputs, "volume")
    const time = num(inputs, "time")
    assertPositive(volume, "Infusion volume")
    assertPositive(time, "Infusion time")
    const rate = round(volume / time, 2)
    return {
      value: rate,
      unit: "mL/hr",
      display: fmt(rate, 2, "mL/hr"),
      calculationSteps: [`${volume} mL ÷ ${time} hr = ${rate} mL/hr`],
    }
  },
}

export const dropsPerMinuteCalculator: CalculatorDefinition = {
  id: "drops-per-minute",
  name: "IV Drops per Minute",
  shortName: "Drops/min",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates an approximate gravity infusion rate using the tubing drop factor.",
  formula: "Drops/min = volume(mL) × drop factor(gtt/mL) ÷ time(min)",
  keywords: ["drops per minute", "gtt/min", "drip rate", "iv", "drop factor"],
  inputs: [
    { id: "volume", label: "Volume", kind: "number", unit: "mL", min: 0, step: 0.1 },
    { id: "dropFactor", label: "Drop factor", kind: "number", unit: "gtt/mL", min: 1, step: 1 },
    { id: "time", label: "Time", kind: "number", unit: "minutes", min: 0, step: 1 },
  ],
  calculate: (inputs) => {
    const volume = num(inputs, "volume")
    const dropFactor = num(inputs, "dropFactor")
    const time = num(inputs, "time")
    assertPositive(volume, "Volume")
    assertPositive(dropFactor, "Drop factor")
    assertPositive(time, "Time")
    const exact = (volume * dropFactor) / time
    const rounded = Math.round(exact)
    return {
      value: rounded,
      unit: "gtt/min",
      display: fmt(rounded, 0, "gtt/min"),
      secondary: [{ label: "Unrounded rate", value: fmt(exact, 2, "gtt/min") }],
      calculationSteps: [`(${volume} mL × ${dropFactor} gtt/mL) ÷ ${time} min = ${round(exact, 2)} gtt/min`],
      warnings: ["Gravity drip rates are approximate; verify the tubing drop factor and monitor the actual infusion."] ,
    }
  },
}

export const maximumDoseCheckCalculator: CalculatorDefinition = {
  id: "maximum-dose-check",
  name: "Maximum Dose Check",
  shortName: "Max Dose",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Compares a calculated dose with a specified maximum single or daily dose.",
  formula: "Final dose = min(calculated dose, specified maximum)",
  keywords: ["maximum dose", "dose cap", "dose limit", "max dose"],
  inputs: [
    { id: "calculatedDose", label: "Calculated dose", kind: "number", unit: "mg", min: 0, step: 0.01 },
    { id: "maximumDose", label: "Specified maximum", kind: "number", unit: "mg", min: 0, step: 0.01 },
  ],
  calculate: (inputs) => {
    const calculatedDose = num(inputs, "calculatedDose")
    const maximumDose = num(inputs, "maximumDose")
    assertNonNegative(calculatedDose, "Calculated dose")
    assertPositive(maximumDose, "Specified maximum")
    const capped = Math.min(calculatedDose, maximumDose)
    const cappedByLimit = calculatedDose > maximumDose
    return {
      value: capped,
      unit: "mg",
      display: fmt(capped, 2, "mg"),
      secondary: [{ label: "Maximum exceeded", value: cappedByLimit ? "Yes" : "No" }],
      calculationSteps: [`min(${calculatedDose} mg, ${maximumDose} mg) = ${capped} mg`],
      warnings: cappedByLimit ? ["The calculated dose exceeds the maximum supplied to this calculator. Confirm the drug-specific protocol before applying a dose cap."] : undefined,
    }
  },
}



export const artesunateAmodiaquineCalculator: CalculatorDefinition = {
  id: "artesunate-amodiaquine-uncomplicated-malaria",
  name: "Artesunate–Amodiaquine  to  Uncomplicated Malaria",
  shortName: "Artesunate–Amodiaquine",
  category: "dosing",
  subcategory: "antimalarial",
  description: "Provides the WHO weight-band daily dose of artesunate–amodiaquine for uncomplicated malaria over 3 days.",
  formula: "Weight band  to  fixed-dose combination per day for 3 days",
  keywords: ["artesunate", "amodiaquine", "AS-AQ", "ACT", "malaria", "weight band"],
  relatedTools: ["mg-per-kg-dose", "artemether-lumefantrine-uncomplicated-malaria"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 4.5, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")

    let dose: string
    let tabletStrength: string
    let tabletsPerDay: number
    if (weight < 9) {
      dose = "25 mg artesunate + 67.5 mg amodiaquine"
      tabletStrength = "25/67.5 mg"
      tabletsPerDay = 1
    } else if (weight < 18) {
      dose = "50 mg artesunate + 135 mg amodiaquine"
      tabletStrength = "50/135 mg"
      tabletsPerDay = 1
    } else if (weight < 36) {
      dose = "100 mg artesunate + 270 mg amodiaquine"
      tabletStrength = "100/270 mg"
      tabletsPerDay = 1
    } else {
      dose = "200 mg artesunate + 540 mg amodiaquine"
      tabletStrength = "100/270 mg"
      tabletsPerDay = 2
    }

    return {
      value: dose,
      unit: "daily dose",
      display: dose,
      secondary: [
        { label: "Frequency", value: "Once daily" },
        { label: "Duration", value: "3 days" },
        { label: "Tablet strength", value: tabletStrength },
        { label: "Tablets per day", value: `${tabletsPerDay}` },
        { label: "Total tablets", value: `${tabletsPerDay * 3}` },
      ],
      calculationSteps: [`${weight} kg  to  ${dose} once daily for 3 days`],
      interpretation: "Weight-band regimen for uncomplicated malaria using fixed-dose artesunate–amodiaquine. This calculator does not diagnose malaria or determine whether this regimen is appropriate for the patient.",
      warnings: [
        "Verify the exact marketed formulation and national malaria guideline before administration.",
        "Consider patient-specific contraindications, interactions and clinical factors; this is not a prescribing tool.",
      ],
    }
  },
  notes: [
    "WHO guidance lists 25/67.5 mg, 50/135 mg and 100/270 mg fixed-dose combinations and weight bands of 4.5–<9 kg, 9–<18 kg, 18–<36 kg and ≥36 kg.",
    "The regimen is given once daily for 3 days.",
  ],
  limitations: ["Local/national malaria treatment protocols and the exact product formulation must be checked before use."],
}

export const artesunateMefloquineCalculator: CalculatorDefinition = {
  id: "artesunate-mefloquine-uncomplicated-malaria",
  name: "Artesunate–Mefloquine  to  Uncomplicated Malaria",
  shortName: "Artesunate–Mefloquine",
  category: "dosing",
  subcategory: "antimalarial",
  description: "Provides the WHO weight-band daily dose of artesunate–mefloquine for uncomplicated malaria over 3 days.",
  formula: "Weight band  to  fixed-dose combination per day for 3 days",
  keywords: ["artesunate", "mefloquine", "AS-MQ", "ACT", "malaria", "weight band"],
  relatedTools: ["mg-per-kg-dose", "artesunate-amodiaquine-uncomplicated-malaria"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 5, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")

    let dose: string
    let tabletStrength: string
    if (weight < 9) {
      dose = "25 mg artesunate + 55 mg mefloquine"
      tabletStrength = "25/55 mg"
    } else if (weight < 18) {
      dose = "50 mg artesunate + 110 mg mefloquine"
      tabletStrength = "25/55 mg"
    } else if (weight < 30) {
      dose = "100 mg artesunate + 220 mg mefloquine"
      tabletStrength = "100/220 mg"
    } else {
      dose = "200 mg artesunate + 440 mg mefloquine"
      tabletStrength = "100/220 mg"
    }

    const tabletsPerDay = weight < 9 ? 1 : weight < 18 ? 2 : weight < 30 ? 1 : 2

    return {
      value: dose,
      unit: "daily dose",
      display: dose,
      secondary: [
        { label: "Frequency", value: "Once daily" },
        { label: "Duration", value: "3 days" },
        { label: "Tablet strength", value: tabletStrength },
        { label: "Tablets per day", value: `${tabletsPerDay}` },
        { label: "Total tablets", value: `${tabletsPerDay * 3}` },
      ],
      calculationSteps: [`${weight} kg  to  ${dose} once daily for 3 days`],
      interpretation: "Weight-band regimen for uncomplicated malaria using fixed-dose artesunate–mefloquine. This calculator does not diagnose malaria or determine whether this regimen is appropriate for the patient.",
      warnings: [
        "Mefloquine has important contraindications and precautions; verify the current product information and national malaria guideline before administration.",
        "Verify the exact marketed formulation and tablet strength before use.",
      ],
    }
  },
  notes: [
    "WHO guidance lists weight bands of 5–<9 kg, 9–<18 kg, 18–<30 kg and ≥30 kg with daily doses of 25/55 mg, 50/110 mg, 100/220 mg and 200/440 mg respectively.",
    "The total mefloquine dose is preferably split over the 3 treatment days in fixed-dose combinations.",
  ],
  limitations: ["Local/national malaria treatment protocols and the exact product formulation must be checked before use."],
}

export const dihydroartemisininPiperaquineCalculator: CalculatorDefinition = {
  id: "dihydroartemisinin-piperaquine-uncomplicated-malaria",
  name: "Dihydroartemisinin–Piperaquine  to  Uncomplicated Malaria",
  shortName: "DHA–Piperaquine",
  category: "dosing",
  subcategory: "antimalarial",
  description: "Provides the WHO weight-band daily dose of dihydroartemisinin–piperaquine for uncomplicated malaria over 3 days.",
  formula: "Weight band  to  fixed-dose combination once daily for 3 days",
  keywords: ["dihydroartemisinin", "piperaquine", "DHA-PPQ", "ACT", "malaria", "weight band"],
  relatedTools: ["mg-per-kg-dose", "artemether-lumefantrine-uncomplicated-malaria"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 5, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")

    let dha: number
    let piperaquine: number
    let tablets: number
    let tabletStrength: string

    if (weight < 8) {
      dha = 20; piperaquine = 160; tablets = 1; tabletStrength = "20/160 mg paediatric tablet"
    } else if (weight < 11) {
      dha = 30; piperaquine = 240; tablets = 1.5; tabletStrength = "20/160 mg paediatric tablet"
    } else if (weight < 17) {
      dha = 40; piperaquine = 320; tablets = 1; tabletStrength = "40/320 mg tablet"
    } else if (weight < 25) {
      dha = 60; piperaquine = 480; tablets = 1.5; tabletStrength = "40/320 mg tablet"
    } else if (weight < 36) {
      dha = 80; piperaquine = 640; tablets = 2; tabletStrength = "40/320 mg tablet"
    } else if (weight < 60) {
      dha = 120; piperaquine = 960; tablets = 3; tabletStrength = "40/320 mg tablet"
    } else if (weight < 80) {
      dha = 160; piperaquine = 1280; tablets = 4; tabletStrength = "40/320 mg tablet"
    } else {
      dha = 200; piperaquine = 1600; tablets = 5; tabletStrength = "40/320 mg tablet"
    }

    return {
      value: `${dha} mg + ${piperaquine} mg`,
      unit: "daily dose",
      display: `${dha} mg DHA + ${piperaquine} mg piperaquine`,
      secondary: [
        { label: "Frequency", value: "Once daily" },
        { label: "Duration", value: "3 days" },
        { label: "Tablet strength", value: tabletStrength },
        { label: "Tablets per day", value: `${tablets}` },
        { label: "Total tablets", value: `${tablets * 3}` },
      ],
      calculationSteps: [`${weight} kg  to  ${dha} mg DHA + ${piperaquine} mg piperaquine once daily for 3 days`],
      interpretation: "Weight-band regimen for uncomplicated malaria using fixed-dose dihydroartemisinin–piperaquine. This calculator does not diagnose malaria or determine whether this regimen is appropriate for the patient.",
      warnings: [
        "Avoid high-fat meals around piperaquine dosing because increased absorption can increase QT-prolongation risk.",
        "Do not use this calculator to infer dosing for products with different tablet strengths or formulations.",
        "Verify QT-prolonging medicines, contraindications, the exact product and the current national malaria guideline before administration.",
      ],
    }
  },
  notes: [
    "WHO guidance recommends daily dosing for 3 days. For patients <25 kg, at least 2.5 mg/kg/day DHA and 20 mg/kg/day piperaquine should be achieved.",
    "The WHO weight-band regimen uses 20/160 mg paediatric tablets and 40/320 mg tablets across the listed weight bands.",
  ],
  limitations: ["Local/national malaria treatment protocols and the exact product formulation must be checked before use."],
}


export const artemetherLumefantrineCalculator: CalculatorDefinition = {
  id: "artemether-lumefantrine-uncomplicated-malaria",
  name: "Artemether–Lumefantrine  to  Uncomplicated Malaria",
  shortName: "Artemether–Lumefantrine",
  category: "dosing",
  subcategory: "antimalarial",
  description: "Provides the standard six-dose artemether–lumefantrine tablet regimen by patient weight for uncomplicated malaria.",
  formula: "Weight band  to  tablets per dose; 6 doses at 0, 8, 24, 36, 48 and 60 hours",
  keywords: ["artemether", "lumefantrine", "AL", "ACT", "malaria", "uncomplicated malaria", "weight band"],
  relatedTools: ["mg-per-kg-dose", "artesunate-severe-malaria"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 5, step: 0.1 },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")

    // Standard WHO 20 mg/120 mg tablet weight bands for the six-dose regimen.
    // The calculator intentionally starts at 5 kg; very young infants require
    // product-/guideline-specific protocols and should not be inferred here.
    const tabletsPerDose = weight < 15 ? 1 : weight < 25 ? 2 : weight < 35 ? 3 : 4
    const totalTablets = tabletsPerDose * 6
    const artemetherPerDose = tabletsPerDose * 20
    const lumefantrinePerDose = tabletsPerDose * 120

    return {
      value: tabletsPerDose,
      unit: "tablet(s)/dose",
      display: `${tabletsPerDose} tablet${tabletsPerDose === 1 ? "" : "s"} per dose`,
      secondary: [
        { label: "Tablet strength", value: "20 mg artemether + 120 mg lumefantrine" },
        { label: "Doses", value: "6 doses over 3 days" },
        { label: "Schedule", value: "0, 8, 24, 36, 48 and 60 hours" },
        { label: "Total tablets", value: `${totalTablets}` },
        { label: "Active ingredients per dose", value: `${artemetherPerDose} mg + ${lumefantrinePerDose} mg` },
      ],
      calculationSteps: [
        `${weight} kg  to  ${tabletsPerDose} tablet${tabletsPerDose === 1 ? "" : "s"} per dose`,
        `${tabletsPerDose} tablet${tabletsPerDose === 1 ? "" : "s"} × 6 doses = ${totalTablets} tablets total`,
      ],
      interpretation: "Weight-band regimen for uncomplicated malaria using 20 mg/120 mg artemether–lumefantrine tablets. This calculator does not diagnose malaria or determine whether this regimen is appropriate for the patient.",
      warnings: [
        "Use only for uncomplicated malaria when an artemether–lumefantrine regimen is appropriate; severe malaria requires a different treatment pathway.",
        "Verify the exact product strength, national malaria guideline, contraindications, interactions and patient-specific factors before administration.",
        "Patients weighing below 5 kg are not handled by this calculator; use the current product-specific and national/WHO guidance for young infants.",
      ],
    }
  },
  notes: [
    "WHO treatment guidance identifies artemether–lumefantrine as an ACT used for uncomplicated falciparum malaria.",
    "The standard 20 mg/120 mg tablet regimen uses weight bands of 5–<15 kg, 15–<25 kg, 25–<35 kg and ≥35 kg, with 1, 2, 3 and 4 tablets respectively per dose, given as six doses over 3 days.",
    "A newer WHO-prequalified formulation specifically for some infants weighing 2–5 kg means young-infant dosing should be handled with its product-specific instructions rather than extrapolated from the standard weight bands.",
  ],
  limitations: [
    "This is a protocol reference calculator, not a prescribing tool.",
    "Local/national treatment protocols and the exact marketed formulation must be checked before use.",
  ],
}



export const artesunateSulfadoxinePyrimethamineCalculator: CalculatorDefinition = {
  id: "artesunate-sulfadoxine-pyrimethamine-uncomplicated-malaria",
  name: "Artesunate–Sulfadoxine/Pyrimethamine  to  Uncomplicated Malaria",
  shortName: "Artesunate–SP",
  category: "dosing",
  subcategory: "antimalarial",
  description: "Provides the WHO weight-band regimen of artesunate plus sulfadoxine–pyrimethamine for uncomplicated malaria.",
  formula: "Weight band  to  artesunate daily for 3 days + single SP dose on day 1",
  keywords: ["artesunate", "sulfadoxine", "pyrimethamine", "AS-SP", "ASSP", "ACT", "malaria", "weight band"],
  relatedTools: ["mg-per-kg-dose", "artemether-lumefantrine-uncomplicated-malaria"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 5, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")

    let artesunate: number
    let sulfadoxine: number
    let pyrimethamine: number
    if (weight < 10) {
      artesunate = 25; sulfadoxine = 250; pyrimethamine = 12.5
    } else if (weight < 25) {
      artesunate = 50; sulfadoxine = 500; pyrimethamine = 25
    } else if (weight < 50) {
      artesunate = 100; sulfadoxine = 1000; pyrimethamine = 50
    } else {
      artesunate = 200; sulfadoxine = 1500; pyrimethamine = 75
    }

    return {
      value: artesunate,
      unit: "mg artesunate/day",
      display: `${artesunate} mg artesunate daily + ${sulfadoxine}/${pyrimethamine} mg SP on day 1`,
      secondary: [
        { label: "Artesunate", value: `${artesunate} mg once daily for 3 days` },
        { label: "Sulfadoxine + pyrimethamine", value: `${sulfadoxine} mg + ${pyrimethamine} mg once on day 1` },
        { label: "Frequency", value: "Artesunate once daily; SP once on day 1" },
        { label: "Duration", value: "3 days of artesunate" },
      ],
      calculationSteps: [
        `${weight} kg  to  ${artesunate} mg artesunate once daily for 3 days`,
        `${weight} kg  to  ${sulfadoxine}/${pyrimethamine} mg SP as a single dose on day 1`,
      ],
      interpretation: "Weight-band regimen for uncomplicated malaria using artesunate plus sulfadoxine–pyrimethamine. This calculator does not diagnose malaria or determine whether this regimen is appropriate for the patient.",
      warnings: [
        "SP is a single dose on day 1; do not treat it as a three-day component.",
        "Verify local/national malaria policy because SP resistance affects where this regimen is appropriate.",
        "Verify the exact formulation and patient-specific contraindications before administration.",
      ],
    }
  },
  notes: [
    "WHO guidance uses artesunate once daily for 3 days plus a single sulfadoxine–pyrimethamine dose on day 1, with weight bands of <10 kg, 10–<25 kg, 25–<50 kg and ≥50 kg.",
    "The WHO 2025 table specifies 25/250/12.5 mg, 50/500/25 mg, 100/1000/50 mg and 200/1500/75 mg for artesunate/sulfadoxine/pyrimethamine respectively.",
    "Higher-dose folic acid can reduce SP efficacy; follow the current guideline and local protocol where relevant.",
  ],
  limitations: ["Local/national treatment protocols, resistance patterns and the exact marketed formulation must be checked before use."],
}

export const artesunatePyronaridineCalculator: CalculatorDefinition = {
  id: "artesunate-pyronaridine-uncomplicated-malaria",
  name: "Artesunate–Pyronaridine  to  Uncomplicated Malaria",
  shortName: "Artesunate–Pyronaridine",
  category: "dosing",
  subcategory: "antimalarial",
  description: "Provides a weight-band artesunate–pyronaridine regimen for uncomplicated malaria using the available oral suspension and tablet strengths.",
  formula: "Weight band  to  fixed-dose combination once daily for 3 days",
  keywords: ["artesunate", "pyronaridine", "AS-PY", "ASPY", "ACT", "malaria", "weight band"],
  relatedTools: ["mg-per-kg-dose", "artesunate-amodiaquine-uncomplicated-malaria"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 5, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")

    let dose: string
    let dosageForm: string
    let unitsPerDay: number
    if (weight < 8) {
      dose = "20 mg artesunate + 60 mg pyronaridine tetraphosphate"
      dosageForm = "1 sachet (20/60 mg oral suspension granules)"
      unitsPerDay = 1
    } else if (weight < 15) {
      dose = "40 mg artesunate + 120 mg pyronaridine tetraphosphate"
      dosageForm = "2 sachets (20/60 mg oral suspension granules)"
      unitsPerDay = 2
    } else if (weight < 20) {
      dose = "60 mg artesunate + 180 mg pyronaridine tetraphosphate"
      dosageForm = "3 sachets (20/60 mg oral suspension granules)"
      unitsPerDay = 3
    } else if (weight < 24) {
      dose = "60 mg artesunate + 180 mg pyronaridine tetraphosphate"
      dosageForm = "1 tablet (60/180 mg)"
      unitsPerDay = 1
    } else if (weight < 45) {
      dose = "120 mg artesunate + 360 mg pyronaridine tetraphosphate"
      dosageForm = "2 tablets (60/180 mg)"
      unitsPerDay = 2
    } else if (weight < 65) {
      dose = "180 mg artesunate + 540 mg pyronaridine tetraphosphate"
      dosageForm = "3 tablets (60/180 mg)"
      unitsPerDay = 3
    } else {
      dose = "240 mg artesunate + 720 mg pyronaridine tetraphosphate"
      dosageForm = "4 tablets (60/180 mg)"
      unitsPerDay = 4
    }

    return {
      value: unitsPerDay,
      unit: dosageForm.includes("sachet") ? "sachet(s)/day" : "tablet(s)/day",
      display: dose,
      secondary: [
        { label: "Frequency", value: "Once daily" },
        { label: "Duration", value: "3 days" },
        { label: "Dosage form", value: dosageForm },
        { label: "Total units", value: `${unitsPerDay * 3}` },
      ],
      calculationSteps: [`${weight} kg  to  ${dosageForm} once daily for 3 days`],
      interpretation: "Weight-band regimen for uncomplicated malaria using artesunate–pyronaridine. This calculator does not diagnose malaria or determine whether this regimen is appropriate for the patient.",
      warnings: [
        "Verify the exact product strength and formulation before administration; pediatric granules and tablets are not interchangeable by unit count.",
        "Avoid use in patients with relevant hepatic disease or severe renal impairment unless the current product/national protocol specifically permits it.",
        "Follow the current national malaria guideline and product information before administration.",
      ],
    }
  },
  notes: [
    "WHO has stated that artesunate–pyronaridine can be considered for uncomplicated malaria in adults and children weighing 5 kg and over; current national protocols determine implementation.",
    "The dose bands here use 20/60 mg oral-suspension sachets for 5–<20 kg and 60/180 mg tablets from 20 kg upward.",
    "The regimen is once daily for 3 days.",
  ],
  limitations: ["Product availability, formulation and national treatment policy vary; verify the current local protocol before use."],
}


export const oralLiquidDoseVolumeCalculator: CalculatorDefinition = {
  id: "oral-liquid-dose-volume",
  name: "Oral Liquid Dose Volume",
  shortName: "Liquid Dose  to  mL",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Converts a required oral liquid dose in mg to mL when the product concentration is stated as mg per 5 mL.",
  formula: "Volume (mL) = required dose (mg) ÷ concentration (mg/mL)",
  keywords: ["oral liquid", "mg/5 mL", "mg/5mL", "syrup dose", "dose volume", "mL dose"],
  relatedTools: ["dose-volume", "drug-concentration"],
  inputs: [
    { id: "dose", label: "Required dose", kind: "number", unit: "mg", min: 0, step: 0.1 },
    { id: "concentration", label: "Product strength", kind: "number", unit: "mg/5 mL", min: 0, step: 0.1 },
  ],
  calculate: (inputs) => {
    const dose = num(inputs, "dose")
    const concentration = num(inputs, "concentration")
    assertPositive(dose, "Required dose")
    assertPositive(concentration, "Product strength")
    const mgPerMl = concentration / 5
    const volume = round(dose / mgPerMl, 3)
    return {
      value: volume,
      unit: "mL",
      display: fmt(volume, 3, "mL"),
      secondary: [{ label: "Equivalent concentration", value: fmt(mgPerMl, 3, "mg/mL") }],
      calculationSteps: [
        `${concentration} mg ÷ 5 mL = ${round(mgPerMl, 3)} mg/mL`,
        `${dose} mg ÷ ${round(mgPerMl, 3)} mg/mL = ${volume} mL`,
      ],
      interpretation: "Mathematical conversion only. Verify the exact product label, concentration after reconstitution and measuring device before administration.",
      warnings: ["Oral liquid concentrations can differ between products. Do not assume a familiar mg/5 mL strength."],
    }
  },
}

export const tabletCapsuleCountCalculator: CalculatorDefinition = {
  id: "tablet-capsule-count",
  name: "Tablet/Capsule Dose Count",
  shortName: "Dose  to  Units",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates the number of tablets or capsules needed for a required dose when the unit strength is known.",
  formula: "Units = required dose ÷ strength per unit",
  keywords: ["tablet count", "capsule count", "tablet dose", "capsule dose", "unit strength"],
  inputs: [
    { id: "dose", label: "Required dose", kind: "number", unit: "mg", min: 0, step: 0.1 },
    { id: "strength", label: "Strength per tablet/capsule", kind: "number", unit: "mg", min: 0, step: 0.1 },
  ],
  calculate: (inputs) => {
    const dose = num(inputs, "dose")
    const strength = num(inputs, "strength")
    assertPositive(dose, "Required dose")
    assertPositive(strength, "Strength per tablet/capsule")
    const units = round(dose / strength, 3)
    const wholeUnits = Number.isInteger(units)
    return {
      value: units,
      unit: "units",
      display: fmt(units, 3, "tablets/capsules"),
      calculationSteps: [`${dose} mg ÷ ${strength} mg per unit = ${units} units`],
      interpretation: wholeUnits
        ? "The calculated dose corresponds to a whole number of units."
        : "The calculated dose is not a whole number of units. Verify whether the dosage form is designed for splitting and follow the product-specific instructions.",
      warnings: wholeUnits ? undefined : ["Do not assume tablets or capsules can be split or opened. Check the dosage form and product instructions."],
    }
  },
}

export const doseVolumeRoundingCalculator: CalculatorDefinition = {
  id: "dose-volume-rounding",
  name: "Dose Volume Rounding",
  shortName: "Round Dose Volume",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Rounds a calculated liquid dose volume to a selected measurable increment without changing the prescribed concentration.",
  formula: "Rounded volume = exact volume adjusted to the selected measuring increment",
  keywords: ["dose rounding", "volume rounding", "oral syringe", "measuring increment", "dose volume"],
  inputs: [
    { id: "volume", label: "Exact calculated volume", kind: "number", unit: "mL", min: 0, step: 0.001 },
    {
      id: "increment",
      label: "Measuring increment",
      kind: "select",
      options: [
        { value: "0.01", label: "0.01 mL" },
        { value: "0.1", label: "0.1 mL" },
        { value: "0.2", label: "0.2 mL" },
        { value: "0.5", label: "0.5 mL" },
        { value: "1", label: "1 mL" },
      ],
      defaultValue: "0.1",
    },
    {
      id: "direction",
      label: "Rounding direction",
      kind: "select",
      options: [
        { value: "nearest", label: "Nearest" },
        { value: "down", label: "Down" },
        { value: "up", label: "Up" },
      ],
      defaultValue: "nearest",
    },
  ],
  calculate: (inputs) => {
    const volume = num(inputs, "volume")
    const increment = num(inputs, "increment")
    const direction = str(inputs, "direction")
    assertNonNegative(volume, "Exact calculated volume")
    assertPositive(increment, "Measuring increment")
    if (!["nearest", "down", "up"].includes(direction)) {
      throw new Error("Invalid rounding direction")
    }
    const ratio = volume / increment
    const roundedRatio = direction === "up" ? Math.ceil(ratio) : direction === "down" ? Math.floor(ratio) : Math.round(ratio)
    const roundedVolume = round(roundedRatio * increment, 3)
    const difference = round(roundedVolume - volume, 3)
    return {
      value: roundedVolume,
      unit: "mL",
      display: fmt(roundedVolume, 3, "mL"),
      secondary: [{ label: "Change from exact volume", value: `${difference >= 0 ? "+" : ""}${fmt(difference, 3, "mL")}` }],
      calculationSteps: [`${volume} mL adjusted to ${increment} mL increments (${direction}) = ${roundedVolume} mL`],
      interpretation: "Rounding is a mathematical aid, not a dosing instruction. The appropriate measurable volume and rounding direction depend on the drug, formulation, device and clinical protocol.",
    }
  },
}

export const artesunateSevereMalariaCalculator: CalculatorDefinition = {
  id: "artesunate-severe-malaria",
  name: "Artesunate  to  Severe Malaria",
  shortName: "Artesunate",
  category: "dosing",
  subcategory: "antimalarial",
  description: "Calculates the weight-based parenteral artesunate dose used for severe malaria and shows the initial 0, 12 and 24-hour schedule.",
  formula: "WHO dose: 3 mg/kg per dose for children <20 kg; 2.4 mg/kg per dose for patients ≥20 kg",
  keywords: ["artesunate", "severe malaria", "malaria", "antimalarial", "3 mg/kg", "2.4 mg/kg"],
  relatedTools: ["mg-per-kg-dose", "dose-volume"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0, step: 0.1 },
    {
      id: "route",
      label: "Route",
      kind: "select",
      options: [
        { value: "iv", label: "IV" },
        { value: "im", label: "IM" },
      ],
      defaultValue: "iv",
    },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const route = str(inputs, "route").toUpperCase()
    assertPositive(weight, "Patient weight")
    const dosePerKg = weight < 20 ? 3 : 2.4
    const dose = round(weight * dosePerKg, 1)
    return {
      value: dose,
      unit: "mg/dose",
      display: fmt(dose, 1, "mg/dose"),
      secondary: [
        { label: "Dose basis", value: `${dosePerKg} mg/kg per dose` },
        { label: "Route", value: route },
        { label: "Initial schedule", value: "0, 12 and 24 hours" },
        { label: "After initial course", value: "Once daily as clinically indicated until oral therapy can be taken" },
      ],
      calculationSteps: [`${dosePerKg} mg/kg × ${weight} kg = ${dose} mg per dose`],
      interpretation: "This is a severe-malaria dosing calculation. A complete oral antimalarial regimen is required after parenteral therapy when the patient can take oral treatment. Follow the current WHO/local protocol and product-specific preparation instructions.",
      warnings: [
        "This calculator does not determine whether malaria is severe, select follow-on therapy, calculate reconstitution volume, or replace clinical assessment.",
        "Verify the current national malaria guideline and the exact injectable artesunate product before administration.",
      ],
    }
  },
  notes: [
    "WHO guidance recommends 3 mg/kg per dose for children weighing <20 kg and 2.4 mg/kg per dose for patients weighing ≥20 kg for severe malaria.",
    "Initial parenteral doses are given at 0, 12 and 24 hours; further once-daily doses may be required until oral therapy is tolerated.",
    "Product-specific reconstitution, concentration, route and administration instructions must be followed separately.",
  ],
  limitations: [
    "This calculator is not a prescribing tool and does not account for every national guideline, formulation, clinical circumstance or follow-on regimen.",
  ],
}

export const amoxicillinPediatricCalculator: CalculatorDefinition = {
  id: "amoxicillin-pediatric-dose",
  name: "Amoxicillin  to  Pediatric Dose",
  shortName: "Amoxicillin",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates a WHO reference pediatric amoxicillin dose range for children older than 28 days.",
  formula: "Daily dose = 25–50 mg/kg/day × weight; divided into 3 doses/day",
  keywords: ["amoxicillin", "antibiotic", "pediatric", "mg/kg/day", "Access"],
  relatedTools: ["mg-per-kg-per-day-dose", "creatinine-clearance"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")
    const lowDaily = round(weight * 25, 1)
    const highDaily = round(weight * 50, 1)
    const lowDose = round(lowDaily / 3, 1)
    const highDose = round(highDaily / 3, 1)
    return {
      perDoseMg: { low: lowDaily / 3, high: highDaily / 3 },
      value: lowDaily,
      unit: "mg/day",
      display: `${lowDaily}–${highDaily} mg/day`,
      secondary: [
        { label: "Dose frequency", value: "3 times daily (about every 8 hours)" },
        { label: "Per-dose range", value: `${lowDose}–${highDose} mg/dose` },
      ],
      calculationSteps: [
        `25 mg/kg/day × ${weight} kg = ${lowDaily} mg/day`,
        `50 mg/kg/day × ${weight} kg = ${highDaily} mg/day`,
        `Divide each daily dose by 3  to  ${lowDose}–${highDose} mg/dose`,
      ],
      interpretation: "WHO reference dosing for children older than 28 days. The appropriate dose depends on the infection and clinical guideline; this calculator does not select the indication-specific regimen.",
      warnings: [
        "Do not use this general pediatric reference for newborns younger than 28 days.",
        "Confirm the indication, formulation, maximum dose and local antimicrobial guideline before administration.",
      ],
    }
  },
  notes: ["WHO antibiotic guidance lists 25–50 mg/kg/day for children older than 28 days, generally divided 3 times daily; some indications use different schedules or doses."],
  limitations: ["This is a reference calculation aid, not an indication-specific prescription calculator."],
}

export const amoxicillinClavulanatePediatricCalculator: CalculatorDefinition = {
  id: "amoxicillin-clavulanate-pediatric-dose",
  name: "Amoxicillin/Clavulanate  to  Pediatric Dose",
  shortName: "Amox/Clav",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates a pediatric amoxicillin-component dose range for amoxicillin/clavulanate.",
  formula: "Amoxicillin component = 25–50 mg/kg/day × weight; divided 3 times daily",
  keywords: ["amoxicillin clavulanate", "co-amoxiclav", "antibiotic", "pediatric"],
  relatedTools: ["amoxicillin-pediatric-dose", "creatinine-clearance"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")
    const lowDaily = round(weight * 25, 1)
    const highDaily = round(weight * 50, 1)
    const lowDose = round(lowDaily / 3, 1)
    const highDose = round(highDaily / 3, 1)
    return {
      perDoseMg: { low: lowDaily / 3, high: highDaily / 3 },
      value: lowDaily,
      unit: "mg/day amoxicillin component",
      display: `${lowDaily}–${highDaily} mg/day amoxicillin component`,
      secondary: [
        { label: "Dose frequency", value: "3 times daily (about every 8 hours)" },
        { label: "Per-dose range", value: `${lowDose}–${highDose} mg amoxicillin component/dose` },
      ],
      calculationSteps: [
        `25 mg/kg/day × ${weight} kg = ${lowDaily} mg/day amoxicillin component`,
        `50 mg/kg/day × ${weight} kg = ${highDaily} mg/day amoxicillin component`,
        `Divide by 3  to  ${lowDose}–${highDose} mg amoxicillin component/dose`,
      ],
      interpretation: "Dose is expressed using the amoxicillin component. The clavulanate amount depends on the selected product formulation.",
      warnings: [
        "Do not calculate using the combined amoxicillin + clavulanate label strength when the protocol specifies an amoxicillin-component dose.",
        "Verify the exact formulation, clavulanate exposure, indication, maximum dose and renal guidance before administration.",
      ],
    }
  },
  notes: ["WHO reference guidance lists 25–50 mg/kg/day of the amoxicillin component for children older than 28 days, divided 3 times daily."],
  limitations: ["Product formulations have different amoxicillin:clavulanate ratios; this calculator does not select a product."],
}

export const azithromycinPediatricCalculator: CalculatorDefinition = {
  id: "azithromycin-pediatric-dose",
  name: "Azithromycin  to  Pediatric Dose",
  shortName: "Azithromycin",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO reference pediatric azithromycin dose for children older than 28 days.",
  formula: "Dose = 10 mg/kg once daily",
  keywords: ["azithromycin", "antibiotic", "macrolide", "pediatric"],
  relatedTools: ["mg-per-kg-dose", "creatinine-clearance"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")
    const dose = round(weight * 10, 1)
    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg once daily`,
      secondary: [{ label: "Dose basis", value: "10 mg/kg/dose" }, { label: "Frequency", value: "Once daily" }],
      calculationSteps: [`10 mg/kg × ${weight} kg = ${dose} mg/dose`],
      interpretation: "WHO reference pediatric dose. The indication determines duration and whether this regimen is appropriate.",
      warnings: ["Confirm indication, duration, formulation and maximum dose from the current local guideline/product information."],
    }
  },
  notes: ["WHO antibiotic guidance lists azithromycin 10 mg/kg once daily for children older than 28 days in its general dosing table."],
}

export const ceftriaxonePediatricCalculator: CalculatorDefinition = {
  id: "ceftriaxone-pediatric-dose",
  name: "Ceftriaxone  to  Pediatric Dose",
  shortName: "Ceftriaxone",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates a WHO reference ceftriaxone dose for children older than 28 days, with a meningitis option.",
  formula: "General dose = 50 mg/kg/day; meningitis = 100 mg/kg/day",
  keywords: ["ceftriaxone", "cephalosporin", "antibiotic", "meningitis", "pediatric"],
  relatedTools: ["mg-per-kg-dose", "creatinine-clearance"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 },
    { id: "indication", label: "Regimen", kind: "select", options: [{ value: "general", label: "General reference dose" }, { value: "meningitis", label: "Meningitis" }], defaultValue: "general" },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const indication = str(inputs, "indication")
    assertPositive(weight, "Patient weight")
    const mgPerKg = indication === "meningitis" ? 100 : 50
    const dose = round(weight * mgPerKg, 1)
    return {
      perDoseMg: { low: dose },
      value: dose,
      unit: "mg/day",
      display: `${dose} mg once daily`,
      secondary: [{ label: "Dose basis", value: `${mgPerKg} mg/kg/day` }, { label: "Route", value: "Parenteral; verify IV/IM product instructions" }],
      calculationSteps: [`${mgPerKg} mg/kg/day × ${weight} kg = ${dose} mg/day`],
      interpretation: "WHO reference dosing for children older than 28 days. Meningitis and other serious infections require indication-specific clinical management.",
      warnings: ["Verify age, indication, route, product concentration, maximum dose and current meningitis/infection guideline before administration."],
    }
  },
  notes: ["WHO guidance lists 50 mg/kg/day for general pediatric dosing and 100 mg/kg/day for meningitis in children older than 28 days."],
}

export const cephalexinPediatricCalculator: CalculatorDefinition = {
  id: "cephalexin-pediatric-dose",
  name: "Cephalexin  to  Pediatric Dose",
  shortName: "Cephalexin",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO reference pediatric cephalexin daily dose range.",
  formula: "Daily dose = 50–100 mg/kg/day × weight; divided into 4 doses",
  keywords: ["cephalexin", "cefalexin", "antibiotic", "pediatric"],
  relatedTools: ["mg-per-kg-per-day-dose", "creatinine-clearance"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")
    const lowDaily = round(weight * 50, 1)
    const highDaily = round(weight * 100, 1)
    return {
      perDoseMg: { low: lowDaily / 4, high: highDaily / 4 },
      value: lowDaily,
      unit: "mg/day",
      display: `${lowDaily}–${highDaily} mg/day`,
      secondary: [{ label: "Frequency", value: "4 times daily (about every 6 hours)" }, { label: "Per-dose range", value: `${round(lowDaily / 4, 1)}–${round(highDaily / 4, 1)} mg/dose` }],
      calculationSteps: [`50 mg/kg/day × ${weight} kg = ${lowDaily} mg/day`, `100 mg/kg/day × ${weight} kg = ${highDaily} mg/day`, `Divide by 4  to  ${round(lowDaily / 4, 1)}–${round(highDaily / 4, 1)} mg/dose`],
      interpretation: "WHO reference pediatric dose range. The appropriate dose depends on infection and severity.",
      warnings: ["Verify the indication, formulation, maximum dose and renal adjustment before administration."],
    }
  },
  notes: ["WHO antibiotic guidance lists cephalexin 50–100 mg/kg/day, divided 4 times daily, for children older than 28 days."],
}

export const metronidazolePediatricCalculator: CalculatorDefinition = {
  id: "metronidazole-pediatric-dose",
  name: "Metronidazole  to  Pediatric Dose",
  shortName: "Metronidazole",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO reference pediatric metronidazole dose range for children older than 28 days.",
  formula: "Daily dose = 15–30 mg/kg/day × weight; divided into 2 doses",
  keywords: ["metronidazole", "anaerobic", "antibiotic", "pediatric"],
  relatedTools: ["mg-per-kg-per-day-dose", "creatinine-clearance"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")
    const lowDaily = round(weight * 15, 1)
    const highDaily = round(weight * 30, 1)
    return {
      perDoseMg: { low: lowDaily / 2, high: highDaily / 2 },
      value: lowDaily,
      unit: "mg/day",
      display: `${lowDaily}–${highDaily} mg/day`,
      secondary: [{ label: "Frequency", value: "2 times daily (about every 12 hours)" }, { label: "Per-dose range", value: `${round(lowDaily / 2, 1)}–${round(highDaily / 2, 1)} mg/dose` }],
      calculationSteps: [`15 mg/kg/day × ${weight} kg = ${lowDaily} mg/day`, `30 mg/kg/day × ${weight} kg = ${highDaily} mg/day`, `Divide by 2  to  ${round(lowDaily / 2, 1)}–${round(highDaily / 2, 1)} mg/dose`],
      interpretation: "WHO reference pediatric dose range. Indication-specific regimens can differ substantially.",
      warnings: ["Confirm the infection, route, duration, maximum dose and hepatic considerations before administration."],
    }
  },
  notes: ["WHO antibiotic guidance lists metronidazole 15–30 mg/kg/day divided twice daily for children older than 28 days."],
}

export const cefuroximeSurgicalProphylaxisCalculator: CalculatorDefinition = {
  id: "cefuroxime-surgical-prophylaxis",
  name: "Cefuroxime  to  Surgical Prophylaxis",
  shortName: "Cefuroxime",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO reference pediatric cefuroxime single-dose regimen for surgical prophylaxis.",
  formula: "Dose = 50 mg/kg × weight",
  keywords: ["cefuroxime", "antibiotic", "surgical prophylaxis", "pediatric"],
  relatedTools: ["mg-per-kg-dose", "maximum-dose-check"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")
    const dose = round(weight * 50, 1)
    return {
      value: dose,
      unit: "mg",
      display: `${dose} mg IV single dose`,
      secondary: [{ label: "Dose basis", value: "50 mg/kg" }, { label: "Frequency", value: "Single pre-operative dose" }],
      calculationSteps: [`50 mg/kg × ${weight} kg = ${dose} mg`],
      interpretation: "WHO reference pediatric surgical-prophylaxis calculation. This is not a general cefuroxime treatment regimen.",
      warnings: ["Confirm the procedure, timing, route, maximum dose and local surgical-prophylaxis protocol before administration."],
    }
  },
  notes: ["WHO AWaRe guidance lists cefuroxime 50 mg/kg as a second-choice single-dose IV option for selected surgical prophylaxis."],
  limitations: ["This calculator is limited to the cited surgical-prophylaxis regimen and should not be used as a general cefuroxime treatment calculator."],
}

export const ampicillinPediatricCalculator: CalculatorDefinition = {
  id: "ampicillin-pediatric-dose",
  name: "Ampicillin  to  Pediatric Dose",
  shortName: "Ampicillin",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO reference ampicillin dose for neonates and children using age-group-specific frequency.",
  formula: "Dose = 50 mg/kg per administration",
  keywords: ["ampicillin", "antibiotic", "pediatric", "neonate"],
  relatedTools: ["mg-per-kg-dose", "creatinine-clearance"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 },
    { id: "ageGroup", label: "Age group", kind: "select", options: [
      { value: "first-week", label: "First week of life" },
      { value: "after-first-week", label: "After first week of life" },
    ] },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const ageGroup = str(inputs, "ageGroup")
    assertPositive(weight, "Patient weight")
    const dose = round(weight * 50, 1)
    const frequency = ageGroup === "first-week" ? "every 12 hours" : "every 8 hours"
    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg IV/IM ${frequency}`,
      secondary: [{ label: "Dose basis", value: "50 mg/kg/dose" }, { label: "Frequency", value: frequency }],
      calculationSteps: [`50 mg/kg × ${weight} kg = ${dose} mg/dose`],
      interpretation: "WHO reference dosing for selected serious bacterial infections. The appropriate regimen depends on age, indication, route and clinical setting.",
      warnings: ["WHO reference tables specify normal renal function; verify the indication, renal status, formulation and local protocol before administration."],
    }
  },
  notes: ["WHO AWaRe guidance lists 50 mg/kg/dose IV/IM every 12 hours in the first week of life and every 8 hours after the first week for selected pediatric infections."],
}

export const cefotaximePediatricCalculator: CalculatorDefinition = {
  id: "cefotaxime-pediatric-dose",
  name: "Cefotaxime  to  Pediatric Dose",
  shortName: "Cefotaxime",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates a WHO reference cefotaxime dose for children, with a meningitis frequency option.",
  formula: "Dose = 50 mg/kg per administration",
  keywords: ["cefotaxime", "cephalosporin", "antibiotic", "meningitis", "pediatric"],
  relatedTools: ["mg-per-kg-dose", "creatinine-clearance"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 },
    { id: "indication", label: "Regimen", kind: "select", options: [
      { value: "general", label: "General pediatric reference" },
      { value: "meningitis", label: "Meningitis" },
    ] },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const indication = str(inputs, "indication")
    assertPositive(weight, "Patient weight")
    const dose = round(weight * 50, 1)
    const frequency = indication === "meningitis" ? "every 6 hours" : "every 8 hours"
    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg IV/IM ${frequency}`,
      secondary: [{ label: "Dose basis", value: "50 mg/kg/dose" }, { label: "Frequency", value: frequency }],
      calculationSteps: [`50 mg/kg × ${weight} kg = ${dose} mg/dose`],
      interpretation: "WHO reference pediatric dosing. Meningitis requires the higher-frequency regimen shown here; other infections may use different protocols.",
      warnings: ["This calculator is not for neonates; neonatal cefotaxime schedules differ by age. Verify renal status, indication and local protocol."],
    }
  },
  notes: ["WHO AWaRe guidance lists cefotaxime 50 mg/kg/dose every 8 hours for several pediatric hospital infections and every 6 hours in the cited meningitis regimen for children who are not neonates."],
}

export const cloxacillinPediatricCalculator: CalculatorDefinition = {
  id: "cloxacillin-pediatric-dose",
  name: "Cloxacillin  to  Pediatric Dose",
  shortName: "Cloxacillin",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO reference cloxacillin dose for neonates and children in selected serious bacterial infections.",
  formula: "Neonates: 25–50 mg/kg/dose q12h; children: 25 mg/kg/dose q6h",
  keywords: ["cloxacillin", "flucloxacillin", "antistaphylococcal", "antibiotic", "pediatric"],
  relatedTools: ["mg-per-kg-dose", "creatinine-clearance"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 },
    { id: "ageGroup", label: "Age group", kind: "select", options: [
      { value: "neonate", label: "Neonate" },
      { value: "child", label: "Child" },
    ] },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const ageGroup = str(inputs, "ageGroup")
    assertPositive(weight, "Patient weight")
    if (ageGroup === "neonate") {
      const low = round(weight * 25, 1)
      const high = round(weight * 50, 1)
      return {
        perDoseMg: { low, high },
        value: low,
        unit: "mg/dose",
        display: `${low}–${high} mg IV every 12 hours`,
        secondary: [{ label: "Dose basis", value: "25–50 mg/kg/dose" }, { label: "Frequency", value: "Every 12 hours" }],
        calculationSteps: [`25 mg/kg × ${weight} kg = ${low} mg`, `50 mg/kg × ${weight} kg = ${high} mg`],
        interpretation: "WHO reference neonatal regimen for selected serious bacterial infections.",
        warnings: ["Verify gestational/postnatal age, indication, renal/hepatic status and local neonatal protocol before administration."],
      }
    }
    const dose = round(weight * 25, 1)
    return {
      perDoseMg: { low: dose },
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg IV every 6 hours`,
      secondary: [{ label: "Dose basis", value: "25 mg/kg/dose" }, { label: "Frequency", value: "Every 6 hours" }],
      calculationSteps: [`25 mg/kg × ${weight} kg = ${dose} mg/dose`],
      interpretation: "WHO reference pediatric regimen for selected serious bacterial infections.",
      warnings: ["Verify the indication, renal/hepatic status and local protocol before administration."],
    }
  },
  notes: ["WHO AWaRe guidance lists cloxacillin 25–50 mg/kg/dose every 12 hours for neonates and 25 mg/kg/dose every 6 hours for children in selected infections."],
}

export const ciprofloxacinPediatricCalculator: CalculatorDefinition = {
  id: "ciprofloxacin-pediatric-dose",
  name: "Ciprofloxacin  to  Pediatric Dose",
  shortName: "Ciprofloxacin",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Provides WHO oral weight-band ciprofloxacin dosing used in selected pediatric hospital infections.",
  formula: "Weight band  to  fixed dose every 12 hours",
  keywords: ["ciprofloxacin", "antibiotic", "quinolone", "pediatric", "weight band"],
  relatedTools: ["creatinine-clearance"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 3, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")
    let dose: number
    if (weight < 6) dose = 50
    else if (weight < 10) dose = 100
    else if (weight < 15) dose = 150
    else if (weight < 20) dose = 200
    else if (weight < 30) dose = 300
    else dose = 500
    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg orally every 12 hours`,
      secondary: [{ label: "Approximate basis", value: "15 mg/kg/dose" }, { label: "Route", value: "Oral" }],
      calculationSteps: [`${weight} kg  to  ${dose} mg weight-band dose every 12 hours`],
      interpretation: "WHO weight-band regimen for selected pediatric hospital infections. Ciprofloxacin use in children should be indication-specific.",
      warnings: ["Do not extrapolate this calculator to every pediatric indication. Verify susceptibility, indication, interactions, renal function and local guidance."],
    }
  },
  notes: ["WHO AWaRe infographics provide 3–<6, 6–<10, 10–<15, 15–<20, 20–<30 and ≥30 kg oral weight bands of 50, 100, 150, 200, 300 and 500 mg every 12 hours for selected infections."],
}

export const gentamicinPediatricCalculator: CalculatorDefinition = {
  id: "gentamicin-pediatric-dose",
  name: "Gentamicin  to  Pediatric Dose",
  shortName: "Gentamicin",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO reference once-daily gentamicin dose for neonates and children with normal renal function.",
  formula: "Neonates: 5 mg/kg/dose; children: 7.5 mg/kg/dose",
  keywords: ["gentamicin", "aminoglycoside", "antibiotic", "neonate", "pediatric", "renal"],
  relatedTools: ["mg-per-kg-dose", "creatinine-clearance"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 },
    { id: "ageGroup", label: "Age group", kind: "select", options: [
      { value: "neonate", label: "Neonate" },
      { value: "child", label: "Child" },
    ] },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const ageGroup = str(inputs, "ageGroup")
    assertPositive(weight, "Patient weight")
    const dosePerKg = ageGroup === "neonate" ? 5 : 7.5
    const dose = round(weight * dosePerKg, 1)
    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg IV/IM once daily`,
      secondary: [{ label: "Dose basis", value: `${dosePerKg} mg/kg/dose` }, { label: "Frequency", value: "Once daily" }],
      calculationSteps: [`${dosePerKg} mg/kg × ${weight} kg = ${dose} mg/dose`],
      interpretation: "WHO reference gentamicin dose for selected pediatric infections with normal renal function.",
      warnings: ["Gentamicin is renally cleared and potentially nephrotoxic/ototoxic. This calculator does not perform renal adjustment or therapeutic drug monitoring; use the dedicated renal/TDM protocol before administration."],
    }
  },
  notes: ["WHO AWaRe guidance lists 5 mg/kg once daily for neonates and 7.5 mg/kg once daily for children in selected serious bacterial infections."],
  limitations: ["Not a therapeutic-drug-monitoring calculator and not a renal-dose-adjustment calculator."],
}

export const meropenemPediatricCalculator: CalculatorDefinition = {
  id: "meropenem-pediatric-dose",
  name: "Meropenem  to  Pediatric Dose",
  shortName: "Meropenem",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO reference meropenem dose used in selected pediatric hospital infections.",
  formula: "Dose = 20 mg/kg per administration every 8 hours",
  keywords: ["meropenem", "carbapenem", "antibiotic", "pediatric", "hospital"],
  relatedTools: ["mg-per-kg-dose", "creatinine-clearance"],
  inputs: [{ id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 }],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")
    const dose = round(weight * 20, 1)
    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg IV every 8 hours`,
      secondary: [{ label: "Dose basis", value: "20 mg/kg/dose" }, { label: "Frequency", value: "Every 8 hours" }],
      calculationSteps: [`20 mg/kg × ${weight} kg = ${dose} mg/dose`],
      interpretation: "WHO reference hospital dosing for selected pediatric infections. Higher or different regimens may be required for specific indications such as meningitis or critical illness.",
      warnings: ["Use only when meropenem is clinically indicated. Verify infection severity, indication, renal function, susceptibility data and local antimicrobial-stewardship guidance."],
    }
  },
  notes: ["WHO AWaRe hospital guidance lists meropenem 20 mg/kg/dose every 8 hours for selected severe pediatric infections, particularly when resistant Gram-negative infection is suspected."],
  limitations: ["This is not a universal meropenem regimen and does not cover meningitis, extended-infusion protocols or renal adjustment."],
}

export const vancomycinPediatricCalculator: CalculatorDefinition = {
  id: "vancomycin-pediatric-dose",
  name: "Vancomycin  to  Pediatric Dose",
  shortName: "Vancomycin",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO reference IV vancomycin dose for neonates and children with normal renal function.",
  formula: "Dose = 15 mg/kg per administration",
  keywords: ["vancomycin", "glycopeptide", "antibiotic", "MRSA", "pediatric", "renal", "TDM"],
  relatedTools: ["mg-per-kg-dose", "creatinine-clearance"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 },
    { id: "ageGroup", label: "Age group", kind: "select", options: [
      { value: "neonate", label: "Neonate" },
      { value: "child", label: "Child" },
    ] },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const ageGroup = str(inputs, "ageGroup")
    assertPositive(weight, "Patient weight")
    const dose = round(weight * 15, 1)
    const frequency = ageGroup === "neonate" ? "every 12 hours" : "every 8 hours"
    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg IV ${frequency}`,
      secondary: [{ label: "Dose basis", value: "15 mg/kg/dose" }, { label: "Frequency", value: frequency }],
      calculationSteps: [`15 mg/kg × ${weight} kg = ${dose} mg/dose`],
      interpretation: "WHO reference IV vancomycin dosing for selected pediatric infections with normal renal function.",
      warnings: ["Vancomycin dosing requires renal assessment and therapeutic drug monitoring according to the clinical protocol. This calculator does not calculate renal adjustment, infusion rate or TDM targets."],
    }
  },
  notes: ["WHO AWaRe guidance lists vancomycin 15 mg/kg/dose every 12 hours for neonates and every 8 hours for children in selected hospital infections."],
  limitations: ["Not a therapeutic-drug-monitoring or renal-dose-adjustment calculator."],
}

/**
 * Renal dose-adjustment tools are deliberately drug- and regimen-specific.
 * They require an existing renal-function estimate; they do not recalculate
 * Cockcroft–Gault or substitute a universal "reduce by X%" rule.
 */
export const amoxicillinClavulanateRenalAdjustmentCalculator: CalculatorDefinition = {
  id: "amoxicillin-clavulanate-renal-adjustment",
  name: "Amoxicillin/Clavulanate  to  Renal Adjustment",
  shortName: "Amox/Clav Renal",
  category: "dosing",
  subcategory: "renal-adjustment",
  description: "Applies the product-label renal restrictions and interval changes for immediate-release amoxicillin/clavulanate oral formulations.",
  formula: "GFR >30: usual regimen; GFR 10–30: 250 or 500 mg q12h; GFR <10: 250 or 500 mg q24h",
  keywords: ["amoxicillin", "clavulanate", "augmentin", "renal", "renal adjustment", "GFR"],
  relatedTools: ["egfr-ckd-epi", "creatinine-clearance", "amoxicillin-clavulanate-pediatric-dose"],
  inputs: [
    { id: "gfr", label: "GFR", kind: "number", unit: "mL/min", min: 0, step: 0.1 },
    {
      id: "strength",
      label: "Amoxicillin component per dose",
      kind: "select",
      options: [
        { value: "250", label: "250 mg" },
        { value: "500", label: "500 mg" },
        { value: "875", label: "875 mg" },
      ],
    },
    {
      id: "dialysis",
      label: "Hemodialysis",
      kind: "select",
      options: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes" },
      ],
    },
  ],
  calculate: (inputs) => {
    const gfr = num(inputs, "gfr")
    const strength = num(inputs, "strength")
    const dialysis = str(inputs, "dialysis") === "yes"
    assertNonNegative(gfr, "GFR")

    if (gfr > 30) {
      return {
        value: strength,
        unit: "mg/dose",
        display: `${strength} mg amoxicillin component every 12 hours (usual regimen)`,
        secondary: [{ label: "Renal band", value: "GFR ≥30 mL/min" }],
        calculationSteps: [`GFR ${gfr} mL/min  to  no renal dose reduction required by the product label`],
        interpretation: "Immediate-release amoxicillin/clavulanate generally does not require renal dose reduction above 30 mL/min.",
        warnings: ["Confirm the indication, formulation, amoxicillin/clavulanate ratio and maximum daily dose. The 875 mg dose is not for severe renal impairment."],
      }
    }

    if (strength === 875) {
      return {
        value: "not recommended",
        display: "875 mg dose not recommended at GFR <30 mL/min",
        secondary: [{ label: "Renal band", value: gfr >= 10 ? "GFR 10–<30 mL/min" : "GFR <10 mL/min" }],
        interpretation: "The product label states that patients with GFR <30 mL/min should not receive the 875 mg amoxicillin-component dose.",
        warnings: ["Select an appropriate 250 mg or 500 mg regimen only after confirming indication and formulation-specific instructions."],
      }
    }

    if (gfr >= 10) {
      return {
        value: strength,
        unit: "mg/dose",
        display: `${strength} mg amoxicillin component every 12 hours`,
        secondary: [{ label: "Renal band", value: "GFR 10–<30 mL/min" }],
        calculationSteps: [`GFR ${gfr} mL/min  to  ${strength} mg every 12 hours`],
        interpretation: "Product-label regimen for severe renal impairment, with dose selected according to infection severity.",
        warnings: ["The label allows 250 mg or 500 mg every 12 hours depending on infection severity. Do not use the 875 mg strength in this renal band."],
      }
    }

    return {
      value: strength,
      unit: "mg/dose",
      display: `${strength} mg amoxicillin component every 24 hours`,
      secondary: [{ label: "Renal band", value: "GFR <10 mL/min" }],
      calculationSteps: [`GFR ${gfr} mL/min  to  ${strength} mg every 24 hours`],
      interpretation: "Product-label regimen for severe renal impairment with GFR <10 mL/min.",
      warnings: [
        "For hemodialysis, the product label specifies an additional dose during and at the end of dialysis.",
        dialysis ? "Hemodialysis selected: verify dialysis timing and the exact product label before administration." : "If the patient is on hemodialysis, select that status and verify dialysis-specific dosing.",
      ],
    }
  },
  notes: ["Source: current DailyMed labeling for immediate-release amoxicillin/clavulanate. GFR <30 mL/min: do not use the 875 mg amoxicillin-component dose; 250 or 500 mg every 12 hours at GFR 10–30 and every 24 hours below 10, depending on infection severity."],
}

export const ciprofloxacinRenalAdjustmentCalculator: CalculatorDefinition = {
  id: "ciprofloxacin-renal-adjustment",
  name: "Ciprofloxacin  to  Renal Adjustment",
  shortName: "Ciprofloxacin Renal",
  category: "dosing",
  subcategory: "renal-adjustment",
  description: "Applies the adult oral ciprofloxacin renal dosing intervals from the current product label.",
  formula: "CrCl >50: q12h; 30–50: q12h; 5–29: q18h; dialysis: q24h after dialysis",
  keywords: ["ciprofloxacin", "renal", "renal adjustment", "creatinine clearance", "Cipro"],
  relatedTools: ["creatinine-clearance", "ciprofloxacin-pediatric-dose"],
  inputs: [
    { id: "crcl", label: "Creatinine clearance", kind: "number", unit: "mL/min", min: 0, step: 0.1 },
    {
      id: "dose",
      label: "Usual individual dose",
      kind: "select",
      options: [
        { value: "250", label: "250 mg" },
        { value: "500", label: "500 mg" },
      ],
    },
    {
      id: "dialysis",
      label: "Dialysis",
      kind: "select",
      options: [
        { value: "no", label: "No" },
        { value: "yes", label: "Hemodialysis or peritoneal dialysis" },
      ],
    },
  ],
  calculate: (inputs) => {
    const crcl = num(inputs, "crcl")
    const dose = num(inputs, "dose")
    const dialysis = str(inputs, "dialysis") === "yes"
    assertNonNegative(crcl, "Creatinine clearance")
    const interval = dialysis ? "every 24 hours (after dialysis)" : crcl > 50 ? "every 12 hours" : crcl >= 30 ? "every 12 hours" : crcl >= 5 ? "every 18 hours" : "not specified"

    if (!dialysis && crcl < 5) {
      return {
        value: "not specified",
        display: "No label-based regimen for CrCl <5 mL/min without dialysis",
        secondary: [{ label: "Input dose", value: `${dose} mg` }],
        interpretation: "The current oral ciprofloxacin label provides renal dosing for CrCl 5–29 mL/min and dialysis, but does not provide a separate non-dialysis regimen below 5 mL/min.",
        warnings: ["Use a renal/pharmacy protocol rather than extrapolating the label."],
      }
    }

    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg orally ${interval}`,
      secondary: [{ label: "CrCl band", value: dialysis ? "Dialysis" : crcl > 50 ? ">50 mL/min" : crcl >= 30 ? "30–50 mL/min" : "5–29 mL/min" }],
      calculationSteps: [
        dialysis ? "Dialysis  to  dose every 24 hours after dialysis" : `${crcl} mL/min CrCl  to  ${interval}`,
      ],
      interpretation: "Adult oral renal-adjustment reference from the product label. Dose selection still depends on infection and indication.",
      warnings: ["This calculator is for adult oral-label renal adjustment. Pediatric patients with moderate/severe renal insufficiency require separate guidance."],
    }
  },
  notes: ["Source: current DailyMed ciprofloxacin labeling. Adult renal bands: >50 mL/min usual dosing; 30–50 mL/min 250–500 mg every 12 hours; 5–29 mL/min 250–500 mg every 18 hours; hemodialysis/peritoneal dialysis 250–500 mg every 24 hours after dialysis."],
}

export const cefotaximeRenalAdjustmentCalculator: CalculatorDefinition = {
  id: "cefotaxime-renal-adjustment",
  name: "Cefotaxime  to  Renal Adjustment",
  shortName: "Cefotaxime Renal",
  category: "dosing",
  subcategory: "renal-adjustment",
  description: "Applies the cefotaxime product-label recommendation to halve the dose when estimated creatinine clearance is below 20 mL/min/1.73 m².",
  formula: "CrCl ≥20: usual dose; CrCl <20: 50% of usual dose",
  keywords: ["cefotaxime", "renal", "renal adjustment", "creatinine clearance"],
  relatedTools: ["creatinine-clearance", "cefotaxime-pediatric-dose"],
  inputs: [
    { id: "crcl", label: "Estimated creatinine clearance", kind: "number", unit: "mL/min/1.73 m²", min: 0, step: 0.1 },
    { id: "usualDose", label: "Usual dose", kind: "number", unit: "mg/dose", min: 0, step: 10 },
  ],
  calculate: (inputs) => {
    const crcl = num(inputs, "crcl")
    const usualDose = num(inputs, "usualDose")
    assertNonNegative(crcl, "Creatinine clearance")
    assertPositive(usualDose, "Usual dose")
    const adjustedDose = crcl < 20 ? round(usualDose / 2, 1) : usualDose
    const reduced = crcl < 20
    return {
      value: adjustedDose,
      unit: "mg/dose",
      display: `${adjustedDose} mg/dose${reduced ? " (50% of usual dose)" : " (usual dose)"}`,
      secondary: [{ label: "Renal band", value: reduced ? "CrCl <20 mL/min/1.73 m²" : "CrCl ≥20 mL/min/1.73 m²" }],
      calculationSteps: reduced ? [`${usualDose} mg × 50% = ${adjustedDose} mg/dose`] : [`CrCl ${crcl} mL/min/1.73 m²  to  retain usual dose of ${usualDose} mg/dose`],
      interpretation: "Product-label renal adjustment reference. Frequency and total daily exposure still depend on the indication and severity of infection.",
      warnings: ["The label describes this as a suggested adjustment because evidence is limited. Confirm the regimen, indication, frequency and local protocol before administration."],
    }
  },
  notes: ["Source: DailyMed cefotaxime labeling: when estimated creatinine clearance is <20 mL/min/1.73 m², the dose is suggested to be halved."],
}

export const cefuroximeAxetilRenalAdjustmentCalculator: CalculatorDefinition = {
  id: "cefuroxime-axetil-renal-adjustment",
  name: "Cefuroxime Axetil  to  Renal Adjustment",
  shortName: "Cefuroxime Axetil Renal",
  category: "dosing",
  subcategory: "renal-adjustment",
  description: "Applies the adult cefuroxime axetil tablet-label interval adjustment for renal impairment.",
  formula: "CrCl ≥30: no adjustment; 10–<30: q24h; <10: q48h; hemodialysis: extra standard dose after dialysis",
  keywords: ["cefuroxime", "cefuroxime axetil", "renal", "renal adjustment", "creatinine clearance"],
  relatedTools: ["creatinine-clearance", "cefuroxime-surgical-prophylaxis"],
  inputs: [
    { id: "crcl", label: "Creatinine clearance", kind: "number", unit: "mL/min", min: 0, step: 0.1 },
    {
      id: "dose",
      label: "Standard individual dose",
      kind: "select",
      options: [
        { value: "250", label: "250 mg" },
        { value: "500", label: "500 mg" },
      ],
    },
    {
      id: "dialysis",
      label: "Hemodialysis",
      kind: "select",
      options: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes" },
      ],
    },
  ],
  calculate: (inputs) => {
    const crcl = num(inputs, "crcl")
    const dose = num(inputs, "dose")
    const dialysis = str(inputs, "dialysis") === "yes"
    assertNonNegative(crcl, "Creatinine clearance")
    const interval = crcl >= 30 ? "every 12 hours" : crcl >= 10 ? "every 24 hours" : "every 48 hours"
    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg orally ${interval}`,
      secondary: [{ label: "Renal band", value: crcl >= 30 ? "CrCl ≥30 mL/min" : crcl >= 10 ? "CrCl 10–<30 mL/min" : "CrCl <10 mL/min" }],
      calculationSteps: [`${crcl} mL/min CrCl  to  ${interval}`],
      interpretation: "Adult cefuroxime axetil renal-adjustment reference from the product label.",
      warnings: [
        "This calculator applies to cefuroxime axetil oral tablets, not the separate IV cefuroxime surgical-prophylaxis regimen.",
        dialysis ? "Hemodialysis selected: the label specifies one additional standard dose at the end of each dialysis session." : "If the patient is receiving hemodialysis, verify dialysis-specific dosing before administration.",
      ],
    }
  },
  notes: ["Source: current DailyMed cefuroxime axetil labeling. CrCl ≥30 mL/min: no adjustment; 10 to <30: standard dose every 24 hours; <10: standard dose every 48 hours; hemodialysis: one additional standard dose at the end of dialysis."],
}

export const meropenemRenalAdjustmentCalculator: CalculatorDefinition = {
  id: "meropenem-renal-adjustment",
  name: "Meropenem  to  Renal Adjustment",
  shortName: "Meropenem Renal",
  category: "dosing",
  subcategory: "renal-adjustment",
  description: "Applies the adult meropenem injection label for dose and interval changes across creatinine-clearance bands.",
  formula: "CrCl >50: usual q8h; 26–50: usual q12h; 10–25: half-dose q12h; <10: half-dose q24h",
  keywords: ["meropenem", "renal", "renal adjustment", "creatinine clearance", "carbapenem"],
  relatedTools: ["creatinine-clearance", "meropenem-pediatric-dose"],
  inputs: [
    { id: "crcl", label: "Creatinine clearance", kind: "number", unit: "mL/min", min: 0, step: 0.1 },
    {
      id: "indication",
      label: "Adult labeled regimen",
      kind: "select",
      options: [
        { value: "csssi", label: "cSSSI  to  500 mg" },
        { value: "intra-abdominal", label: "Intra-abdominal  to  1 g" },
        { value: "pseudomonas-csssi", label: "P. aeruginosa cSSSI  to  1 g" },
      ],
    },
    {
      id: "dialysis",
      label: "Dialysis",
      kind: "select",
      options: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes" },
      ],
    },
  ],
  calculate: (inputs) => {
    const crcl = num(inputs, "crcl")
    const indication = str(inputs, "indication")
    const dialysis = str(inputs, "dialysis") === "yes"
    assertNonNegative(crcl, "Creatinine clearance")
    const baseDose = indication === "csssi" ? 500 : 1000
    if (dialysis) {
      return {
        value: "not established",
        display: "Dialysis regimen not established by the product label",
        secondary: [{ label: "Usual labeled dose", value: `${baseDose} mg` }],
        interpretation: "The product label states that there is inadequate information for meropenem dosing in hemodialysis or peritoneal dialysis.",
        warnings: ["Do not extrapolate the non-dialysis table to dialysis. Use a dialysis-specific antimicrobial/pharmacy protocol."],
      }
    }
    const half = crcl <= 25
    const dose = half ? round(baseDose / 2, 1) : baseDose
    const interval = crcl > 50 ? "every 8 hours" : crcl >= 26 ? "every 12 hours" : crcl >= 10 ? "every 12 hours" : "every 24 hours"
    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg IV ${interval}${half ? " (half usual dose)" : ""}`,
      secondary: [{ label: "Renal band", value: crcl > 50 ? ">50 mL/min" : crcl >= 26 ? "26–50 mL/min" : crcl >= 10 ? "10–25 mL/min" : "<10 mL/min" }],
      calculationSteps: [
        half ? `${baseDose} mg × 50% = ${dose} mg/dose` : `Retain ${baseDose} mg recommended dose`,
        `${crcl} mL/min CrCl  to  ${interval}`,
      ],
      interpretation: "Adult meropenem renal-adjustment reference from the product label. The base dose is indication-specific.",
      warnings: ["This calculator does not cover pediatric renal impairment; the product label states there is no experience in pediatric patients with renal impairment."],
    }
  },
  notes: ["Source: current DailyMed meropenem injection labeling. Adult renal bands: >50 mL/min usual dose q8h; 26–50 usual dose q12h; 10–25 half dose q12h; <10 half dose q24h. The label states there is inadequate information for hemodialysis/peritoneal dialysis."],
}

/**
 * Therapeutic-drug-monitoring reference calculators.
 * These intentionally check measured concentrations/exposure rather than
 * prescribing a new regimen, because dosing must be individualized.
 */
export const vancomycinAuc24TargetCalculator: CalculatorDefinition = {
  id: "vancomycin-auc24-target-check",
  name: "Vancomycin  to  AUC24 Target Check",
  shortName: "Vancomycin AUC24",
  category: "dosing",
  subcategory: "therapeutic-drug-monitoring",
  description: "Checks a measured vancomycin 24-hour AUC against the consensus target used for serious invasive MRSA infections.",
  formula: "Target AUC24 = 400–600 mg·h/L (assuming MIC = 1 mg/L)",
  keywords: ["vancomycin", "AUC", "AUC24", "therapeutic drug monitoring", "TDM", "MRSA"],
  relatedTools: ["vancomycin-pediatric-dose", "creatinine-clearance"],
  inputs: [
    { id: "auc24", label: "Measured 24-hour AUC", kind: "number", unit: "mg·h/L", min: 0, step: 1 },
  ],
  calculate: (inputs) => {
    const auc24 = num(inputs, "auc24")
    assertNonNegative(auc24, "AUC24")
    const status = auc24 < 400 ? "Below target" : auc24 <= 600 ? "Within target" : "Above target"
    return {
      value: auc24,
      unit: "mg·h/L",
      display: `${fmt(auc24)} mg·h/L  to  ${status}`,
      secondary: [
        { label: "Consensus target", value: "400–600 mg·h/L" },
        { label: "Assumed MIC", value: "1 mg/L" },
      ],
      interpretation:
        status === "Within target"
          ? "The measured AUC24 is within the consensus exposure target for serious invasive MRSA infections."
          : status === "Below target"
            ? "Exposure is below the consensus target; reassessment should consider infection, MIC assumptions, renal function, sampling/model validity, and the local vancomycin protocol."
            : "Exposure is above the consensus target and may increase nephrotoxicity risk; reassessment should follow the local vancomycin monitoring protocol.",
      warnings: [
        "This is an exposure check, not a dose prescription or AUC calculation from serum levels.",
        "The 400–600 mg·h/L target is for serious invasive MRSA infections and assumes MIC = 1 mg/L by broth microdilution.",
        "Use an AUC-guided dosing method with validated pharmacokinetic software or Bayesian/PK expertise when adjusting therapy.",
      ],
    }
  },
  notes: [
    "Source: 2020 ASHP/PIDS/SIDP/IDSA vancomycin consensus guideline. Target AUC24/MIC is 400–600 mg·h/L for serious MRSA infections, assuming MIC 1 mg/L.",
  ],
}

export const gentamicinPeakTroughCheckerCalculator: CalculatorDefinition = {
  id: "gentamicin-peak-trough-check",
  name: "Gentamicin  to  Peak/Trough Check",
  shortName: "Gentamicin TDM",
  category: "dosing",
  subcategory: "therapeutic-drug-monitoring",
  description: "Checks measured gentamicin peak and trough concentrations against conventional intermittent-dosing reference targets from product labeling.",
  formula: "Conventional reference: peak 4–6 mcg/mL (adult) or 3–5 mcg/mL (pediatric); trough <2 mcg/mL",
  keywords: ["gentamicin", "peak", "trough", "therapeutic drug monitoring", "TDM", "aminoglycoside"],
  relatedTools: ["gentamicin-pediatric-dose", "creatinine-clearance"],
  inputs: [
    {
      id: "population",
      label: "Population",
      kind: "select",
      options: [
        { value: "adult", label: "Adult" },
        { value: "pediatric", label: "Pediatric" },
      ],
    },
    { id: "peak", label: "Measured peak", kind: "number", unit: "mcg/mL", min: 0, step: 0.1 },
    { id: "trough", label: "Measured trough", kind: "number", unit: "mcg/mL", min: 0, step: 0.1 },
  ],
  calculate: (inputs) => {
    const population = str(inputs, "population")
    const peak = num(inputs, "peak")
    const trough = num(inputs, "trough")
    assertNonNegative(peak, "Peak concentration")
    assertNonNegative(trough, "Trough concentration")
    const peakLow = population === "pediatric" ? 3 : 4
    const peakHigh = population === "pediatric" ? 5 : 6
    const peakStatus = peak < peakLow ? "below reference" : peak > peakHigh ? "above reference" : "within reference"
    const troughStatus = trough < 2 ? "below 2 mcg/mL" : "at/above 2 mcg/mL"
    const status = peakStatus === "within reference" && trough < 2 ? "Within conventional reference" : "Review required"
    return {
      value: status,
      display: status,
      secondary: [
        { label: "Peak", value: `${fmt(peak)} mcg/mL (${peakStatus}; reference ${peakLow}–${peakHigh})` },
        { label: "Trough", value: `${fmt(trough)} mcg/mL (${troughStatus}; target <2)` },
      ],
      calculationSteps: [
        `${fmt(peak)} mcg/mL peak  to  ${peakStatus}`,
        `${fmt(trough)} mcg/mL trough  to  ${troughStatus}`,
      ],
      interpretation:
        status === "Within conventional reference"
          ? "Both measured concentrations are within the conventional intermittent-dosing reference described in the product labeling."
          : "One or more measured concentrations fall outside the conventional reference; review timing of the sample, renal function, infection severity, dosing strategy, and the local therapeutic-drug-monitoring protocol.",
      warnings: [
        "These are conventional intermittent-dosing references from product labeling, not universal targets for every indication or dosing strategy.",
        "Extended-interval/once-daily aminoglycoside regimens use different monitoring approaches and should not be interpreted with these targets.",
        "Gentamicin dosing requires attention to renal function and serum-level monitoring; changing renal function may require more frequent reassessment.",
      ],
    }
  },
  notes: [
    "Source: DailyMed gentamicin injection labeling. Example conventional targets: adult peak 4–6 mcg/mL, pediatric peak 3–5 mcg/mL, and trough below 2 mcg/mL; exact targets depend on regimen and clinical context.",
  ],
}



/**
 * WHO 2024 young-infant (0–59 days) reference calculators.
 * These expose the syndrome-specific empiric regimens without attempting
 * to replace bedside assessment, microbiology or local neonatal protocols.
 */
export const whoYoungInfantSepsisPneumoniaCalculator: CalculatorDefinition = {
  id: "who-young-infant-sepsis-pneumonia",
  name: "WHO 0–59 Days  to  Sepsis/Pneumonia Regimen",
  shortName: "0–59 Days Sepsis",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO 2024 first-line ampicillin + gentamicin reference regimen for hospitalized young infants with suspected sepsis or pneumonia.",
  formula: "Ampicillin 50 mg/kg/dose + gentamicin 5 or 7.5 mg/kg once daily",
  keywords: ["neonate", "neonatal", "young infant", "0-59 days", "sepsis", "pneumonia", "ampicillin", "gentamicin", "WHO"],
  relatedTools: ["ampicillin-pediatric-dose", "gentamicin-pediatric-dose"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.01 },
    {
      id: "ageGroup",
      label: "Age",
      kind: "select",
      options: [
        { value: "first-week", label: "First week of life (0–6 days)" },
        { value: "after-first-week", label: "After first week (7–59 days)" },
      ],
    },
    {
      id: "syndrome",
      label: "Syndrome",
      kind: "select",
      options: [
        { value: "sepsis", label: "Suspected sepsis" },
        { value: "pneumonia", label: "Suspected pneumonia" },
      ],
    },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const ageGroup = str(inputs, "ageGroup")
    const syndrome = str(inputs, "syndrome")
    assertPositive(weight, "Patient weight")

    const ampicillin = round(50 * weight, 2)
    const gentamicinPerKg = ageGroup === "first-week" ? 5 : 7.5
    const gentamicin = round(gentamicinPerKg * weight, 2)
    const ampicillinInterval = ageGroup === "first-week" ? "every 12 hours" : "every 8 hours"
    const duration = syndrome === "pneumonia" ? "at least 7 days" : "at least 10 days"

    return {
      value: ampicillin,
      unit: "mg ampicillin/dose",
      display: `${ampicillin} mg ampicillin + ${gentamicin} mg gentamicin`,
      secondary: [
        { label: "Ampicillin", value: `${ampicillin} mg IM/IV ${ampicillinInterval}` },
        { label: "Gentamicin", value: `${gentamicin} mg IM/IV once daily` },
        { label: "Treatment duration", value: duration },
        { label: "WHO age band", value: ageGroup === "first-week" ? "First week of life" : "7–59 days" },
      ],
      calculationSteps: [
        `50 mg/kg × ${weight} kg = ${ampicillin} mg ampicillin per dose`,
        `${gentamicinPerKg} mg/kg × ${weight} kg = ${gentamicin} mg gentamicin once daily`,
      ],
      interpretation: `WHO 2024 first-line reference regimen for hospitalized young infants with suspected ${syndrome === "pneumonia" ? "pneumonia" : "sepsis"}.`,
      warnings: [
        "This is a WHO reference regimen, not an individualized prescription.",
        "Obtain cultures where indicated and reassess empiric therapy using microbiology results, clinical response and the local neonatal protocol.",
        "Gentamicin requires attention to renal function, dosing interval and therapeutic monitoring where available.",
      ],
    }
  },
  notes: [
    "WHO 2024 recommends ampicillin IM/IV 50 mg/kg/dose every 12 hours in the first week of life and every 8 hours after the first week, combined with gentamicin 5 mg/kg once daily in the first week and 7.5 mg/kg once daily after the first week.",
    "For hospitalized suspected sepsis, WHO recommends this combination for at least 10 days; for suspected pneumonia, at least 7 days.",
  ],
  limitations: ["Applies to the WHO 0–59-day young-infant guidance and does not replace neonatal-unit protocols, referral decisions or patient-specific antimicrobial review."],
}

export const whoYoungInfantMeningitisCalculator: CalculatorDefinition = {
  id: "who-young-infant-meningitis",
  name: "WHO 0–59 Days  to  Meningitis Regimen",
  shortName: "0–59 Days Meningitis",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates WHO 2024 reference doses for suspected meningitis in young infants aged 0–59 days.",
  formula: "Ampicillin 50 mg/kg/dose or cefotaxime 50 mg/kg/dose or ceftriaxone 100 mg/kg + gentamicin",
  keywords: ["neonate", "neonatal", "young infant", "0-59 days", "meningitis", "ampicillin", "cefotaxime", "ceftriaxone", "gentamicin", "WHO"],
  relatedTools: ["ampicillin-pediatric-dose", "cefotaxime-pediatric-dose", "ceftriaxone-pediatric-dose", "gentamicin-pediatric-dose"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.01 },
    {
      id: "ageGroup",
      label: "Age",
      kind: "select",
      options: [
        { value: "first-week", label: "First week of life (0–6 days)" },
        { value: "after-first-week", label: "After first week (7–59 days)" },
      ],
    },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const ageGroup = str(inputs, "ageGroup")
    assertPositive(weight, "Patient weight")

    const ampicillin = round(50 * weight, 2)
    const cefotaxime = round(50 * weight, 2)
    const ceftriaxone = round(100 * weight, 2)
    const gentamicinPerKg = ageGroup === "first-week" ? 5 : 7.5
    const gentamicin = round(gentamicinPerKg * weight, 2)
    const ampicillinInterval = ageGroup === "first-week" ? "every 12 hours" : "every 8 hours"
    const cefotaximeInterval = ageGroup === "first-week" ? "every 12 hours" : "every 6 hours"

    return {
      value: ampicillin,
      unit: "mg ampicillin/dose",
      display: `${ampicillin} mg ampicillin + ${gentamicin} mg gentamicin`,
      secondary: [
        { label: "Option 1: Ampicillin", value: `${ampicillin} mg IM/IV ${ampicillinInterval} + gentamicin ${gentamicin} mg once daily` },
        { label: "Option 2: Cefotaxime", value: `${cefotaxime} mg IM/IV ${cefotaximeInterval} + gentamicin ${gentamicin} mg once daily` },
        { label: "Option 3: Ceftriaxone", value: `${ceftriaxone} mg IM/IV once daily + gentamicin ${gentamicin} mg once daily` },
        { label: "Treatment duration", value: "At least 3 weeks" },
      ],
      calculationSteps: [
        `Ampicillin: 50 mg/kg × ${weight} kg = ${ampicillin} mg/dose`,
        `Cefotaxime: 50 mg/kg × ${weight} kg = ${cefotaxime} mg/dose`,
        `Ceftriaxone: 100 mg/kg × ${weight} kg = ${ceftriaxone} mg once daily`,
        `Gentamicin: ${gentamicinPerKg} mg/kg × ${weight} kg = ${gentamicin} mg once daily`,
      ],
      interpretation: "WHO 2024 reference options for suspected meningitis in young infants aged 0–59 days. The displayed options are not automatically interchangeable for an individual patient.",
      warnings: [
        "WHO recommends at least 3 weeks of treatment for suspected meningitis in this age group.",
        "If Listeria monocytogenes is suspected, WHO notes that ampicillin plus a third-generation cephalosporin plus gentamicin may be used as triple therapy.",
        "Ceftriaxone has important neonatal contraindications and compatibility considerations; verify the current product information and neonatal protocol before use.",
        "This calculator does not choose the empiric agent, diagnose meningitis or replace specialist neonatal management.",
      ],
    }
  },
  notes: [
    "WHO 2024 lists ampicillin 50 mg/kg/dose (q12h in the first week, q8h thereafter), cefotaxime 50 mg/kg/dose (q12h in the first week, q6h thereafter), or ceftriaxone 100 mg/kg once daily, combined with gentamicin 5 mg/kg once daily in the first week or 7.5 mg/kg once daily thereafter.",
    "WHO recommends at least 3 weeks of treatment for suspected meningitis in young infants aged 0–59 days.",
  ],
  limitations: ["Use current WHO guidance together with local neonatal protocols, microbiology results, contraindications and specialist clinical assessment."],
}


/**
 * WHO AWaRe reference regimen: piperacillin-tazobactam for selected severe
 * pediatric hospital infections. Dose is expressed as the piperacillin component.
 */
export const piperacillinTazobactamPediatricCalculator: CalculatorDefinition = {
  id: "piperacillin-tazobactam-pediatric-dose",
  name: "Piperacillin–Tazobactam  to  Pediatric Dose",
  shortName: "Piperacillin–Tazobactam",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates a WHO reference pediatric dose of piperacillin–tazobactam for selected severe hospital infections.",
  formula: "Piperacillin dose = 100 mg/kg/dose × weight; IV every 8 hours",
  keywords: ["piperacillin", "tazobactam", "pip-tazo", "pediatric", "antibiotic", "hospital infection"],
  relatedTools: ["creatinine-clearance", "meropenem-pediatric-dose", "dose-volume"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0, step: 0.1 },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")
    const dose = round(weight * 100, 2)
    return {
      value: dose,
      unit: "mg piperacillin/dose",
      display: fmt(dose, 2, "mg piperacillin IV every 8 hours"),
      secondary: [
        { label: "Tazobactam component (4:1 product ratio)", value: fmt(dose / 4, 2, "mg/dose") },
      ],
      calculationSteps: [
        `Piperacillin: 100 mg/kg × ${weight} kg = ${dose} mg/dose`,
        `At a 4:1 piperacillin:tazobactam ratio: ${dose / 4} mg tazobactam/dose`,
      ],
      interpretation: "WHO AWaRe reference regimen for selected severe pediatric hospital infections. Dose is expressed as the piperacillin component.",
      warnings: [
        "This is not a universal pediatric piperacillin-tazobactam regimen; indication, renal function, severity and local protocol matter.",
        "The tazobactam amount shown assumes a 4:1 piperacillin:tazobactam product ratio. Verify the actual formulation before administration.",
        "WHO AWaRe dosing tables state that listed doses assume normal renal function; use the renal-adjustment protocol when applicable.",
      ],
    }
  },
  notes: [
    "WHO AWaRe lists piperacillin+tazobactam 100 mg/kg/dose of the piperacillin component q8h IV for selected severe pediatric hospital infections.",
    "Source: WHO AWaRe antibiotic book, 2022; the book is being updated to reflect newer 2024–2025 WHO guidance.",
  ],
  limitations: ["Verify the current indication-specific WHO/local protocol, formulation, renal function and infusion instructions before use."],
}

/** WHO AWaRe reference regimen for selected pediatric infections. */
export const clindamycinPediatricCalculator: CalculatorDefinition = {
  id: "clindamycin-pediatric-dose",
  name: "Clindamycin  to  Pediatric Dose",
  shortName: "Clindamycin",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates a WHO reference clindamycin dose for selected pediatric hospital infections.",
  formula: "Neonate: 5 mg/kg/dose q8h; child: 10 mg/kg/dose q8h",
  keywords: ["clindamycin", "pediatric", "MRSA", "antibiotic"],
  relatedTools: ["vancomycin-pediatric-dose", "mg-per-kg-dose"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0, step: 0.1 },
    {
      id: "ageGroup",
      label: "Age group",
      kind: "select",
      options: [
        { value: "neonate", label: "Neonate" },
        { value: "child", label: "Child" },
      ],
      defaultValue: "child",
    },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const ageGroup = str(inputs, "ageGroup")
    assertPositive(weight, "Patient weight")
    const mgPerKg = ageGroup === "neonate" ? 5 : 10
    const dose = round(weight * mgPerKg, 2)
    return {
      value: dose,
      unit: "mg/dose",
      display: fmt(dose, 2, "mg IV/PO every 8 hours"),
      secondary: [{ label: "Dose basis", value: `${mgPerKg} mg/kg/dose` }],
      calculationSteps: [`${mgPerKg} mg/kg × ${weight} kg = ${dose} mg/dose`],
      interpretation: "WHO AWaRe reference regimen for selected pediatric infections, including selected community-acquired MRSA situations when the isolate is susceptible.",
      warnings: [
        "Use only when the indication and organism susceptibility support clindamycin; it is not a universal empiric antibiotic.",
        "Confirm route, formulation and local antimicrobial policy before administration.",
      ],
    }
  },
  notes: [
    "WHO AWaRe lists clindamycin 5 mg/kg/dose q8h for neonates and 10 mg/kg/dose q8h for children in selected hospital infections.",
    "WHO notes clindamycin can be an acceptable option for community-acquired MRSA when susceptibility is appropriate; otherwise vancomycin may be considered.",
  ],
}

/** WHO AWaRe reference regimen for selected pediatric bone/joint infections. */
export const cefazolinPediatricCalculator: CalculatorDefinition = {
  id: "cefazolin-pediatric-dose",
  name: "Cefazolin  to  Pediatric Dose",
  shortName: "Cefazolin",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates a WHO reference cefazolin dose for selected pediatric hospital infections.",
  formula: "Dose = 25 mg/kg/dose IV every 12 hours",
  keywords: ["cefazolin", "pediatric", "bone joint infection", "antibiotic"],
  relatedTools: ["cephalexin-pediatric-dose", "mg-per-kg-dose"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0, step: 0.1 },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")
    const dose = round(weight * 25, 2)
    return {
      value: dose,
      unit: "mg/dose",
      display: fmt(dose, 2, "mg IV every 12 hours"),
      calculationSteps: [`25 mg/kg × ${weight} kg = ${dose} mg/dose`],
      interpretation: "WHO AWaRe reference regimen for selected pediatric hospital infections such as bone and joint infection.",
      warnings: [
        "This is an indication-specific reference regimen, not a universal cefazolin dose for every pediatric infection.",
        "Verify renal function, indication, route and local protocol before use.",
      ],
    }
  },
  notes: [
    "WHO AWaRe lists cefazolin 25 mg/kg/dose q12h IV as a treatment option for selected pediatric bone and joint infections.",
  ],
}


/** WHO AWaRe reference regimen for selected pediatric reserve-antibiotic use. */
export const linezolidPediatricCalculator: CalculatorDefinition = {
  id: "linezolid-pediatric-dose",
  name: "Linezolid  to  Pediatric Dose",
  shortName: "Linezolid",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates a WHO AWaRe reference linezolid dose for selected pediatric invasive Gram-positive infections.",
  formula: "Dose = 10 mg/kg/dose IV/ORAL every 8 hours",
  keywords: ["linezolid", "pediatric", "MRSA", "VRE", "reserve antibiotic"],
  relatedTools: ["vancomycin-pediatric-dose", "mg-per-kg-dose"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0, step: 0.1 },
    { id: "ageGroup", label: "Age group", kind: "select", options: [
      { value: "neonate-first-week", label: "Neonate  to  first week of life" },
      { value: "neonate-after-first-week", label: "Neonate  to  after first week" },
      { value: "child", label: "Child" },
    ] },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const ageGroup = str(inputs, "ageGroup")
    assertPositive(weight, "Patient weight")
    const interval = ageGroup === "neonate-first-week" ? "every 12 hours" : "every 8 hours"
    const dose = round(weight * 10, 2)
    return {
      value: dose,
      unit: "mg/dose",
      display: fmt(dose, 2, `mg IV/ORAL ${interval}`),
      secondary: [
        { label: "Route", value: "IV or oral" },
        { label: "Interval", value: interval },
      ],
      calculationSteps: [`10 mg/kg × ${weight} kg = ${dose} mg/dose`],
      interpretation: "WHO AWaRe reference regimen for selected pediatric reserve-antibiotic use. The neonatal interval differs in the first week of life.",
      warnings: [
        "Linezolid is a reserve antibiotic and should be used only for appropriate, selected indications with microbiology/clinical guidance.",
        "WHO notes that pediatric empiric use is only for very selected seriously ill patients with invasive infections known to be colonized with VRE or VRSA.",
        "Monitor for myelosuppression with prolonged therapy and verify indication, duration and local antimicrobial-stewardship protocol.",
      ],
    }
  },
  notes: [
    "WHO AWaRe: children 10 mg/kg/dose q8h IV/ORAL; neonates 10 mg/kg/dose q12h in the first week and q8h after the first week.",
    "WHO AWaRe states no renal dose adjustment is required for linezolid in the reference regimen.",
  ],
}

/** WHO Model Formulary for Children reference regimen for selected bacterial infections. */
export const doxycyclinePediatricCalculator: CalculatorDefinition = {
  id: "doxycycline-pediatric-dose",
  name: "Doxycycline  to  Pediatric Dose",
  shortName: "Doxycycline",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Calculates the WHO Model Formulary for Children reference doxycycline regimen for children over 8 years.",
  formula: "Day 1: 2 mg/kg/dose twice daily; then 2 mg/kg once daily; maximum 100 mg/dose and 200 mg/day",
  keywords: ["doxycycline", "pediatric", "children", "antibiotic"],
  relatedTools: ["mg-per-kg-dose", "loading-dose"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0, step: 0.1 },
    { id: "day", label: "Treatment day", kind: "select", options: [
      { value: "day1", label: "Day 1" },
      { value: "after-day1", label: "After day 1" },
    ] },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const day = str(inputs, "day")
    assertPositive(weight, "Patient weight")
    const perDose = Math.min(round(weight * 2, 2), 100)
    const frequency = day === "day1" ? "twice daily" : "once daily"
    const daily = Math.min(round(perDose * (day === "day1" ? 2 : 1), 2), 200)
    return {
      value: perDose,
      unit: "mg/dose",
      display: fmt(perDose, 2, `mg ${frequency}`),
      secondary: [
        { label: "Daily total", value: fmt(daily, 2, "mg/day") },
        { label: "Maximum per dose", value: "100 mg" },
        { label: "Maximum daily dose", value: "200 mg/day" },
      ],
      calculationSteps: [
        `2 mg/kg × ${weight} kg = ${round(weight * 2, 2)} mg/dose`,
        `Dose capped at ${perDose} mg when the 100 mg per-dose maximum applies`,
      ],
      interpretation: "WHO Model Formulary for Children reference regimen for bacterial infections in children over 8 years.",
      warnings: [
        "Do not use this calculator for children 8 years or younger unless a current, indication-specific guideline explicitly supports doxycycline.",
        "Verify pregnancy, hepatic/renal considerations, interactions and indication-specific guidance before use.",
        "This source is older supporting guidance; verify against the current indication-specific guideline and local protocol.",
      ],
    }
  },
  notes: [
    "WHO Model Formulary for Children: over 8 years, 2 mg/kg (maximum 100 mg) twice daily on day 1, then 2 mg/kg (maximum 100 mg) daily; maximum daily dose 200 mg.",
  ],
}


/** Generic loading-dose arithmetic. The calculator does not choose a drug-specific loading regimen. */
export const loadingDoseCalculator: CalculatorDefinition = {
  id: "loading-dose",
  name: "Loading Dose",
  shortName: "Loading Dose",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates a loading dose from a prescribed loading-dose rate and patient weight, with an optional maximum cap.",
  formula: "Loading dose = loading dose rate (mg/kg) × weight (kg)",
  keywords: ["loading dose", "mg/kg", "weight", "maximum dose"],
  relatedTools: ["mg-per-kg-dose", "maximum-dose-check"],
  inputs: [
    { id: "dosePerKg", label: "Prescribed loading dose", kind: "number", unit: "mg/kg", min: 0, step: 0.01 },
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0, step: 0.1 },
    { id: "maxDose", label: "Maximum loading dose (optional)", kind: "number", unit: "mg", min: 0, step: 0.1, optional: true },
  ],
  calculate: (inputs) => {
    const dosePerKg = num(inputs, "dosePerKg")
    const weight = num(inputs, "weight")
    const maxRaw = inputs.maxDose
    const maxDose = maxRaw === undefined || maxRaw === "" ? undefined : num(inputs, "maxDose")
    assertPositive(dosePerKg, "Prescribed loading dose")
    assertPositive(weight, "Patient weight")
    if (maxDose !== undefined) assertPositive(maxDose, "Maximum loading dose")
    const uncapped = round(dosePerKg * weight, 2)
    const dose = maxDose !== undefined ? Math.min(uncapped, maxDose) : uncapped
    const capped = dose !== uncapped
    return {
      value: dose,
      unit: "mg",
      display: fmt(dose, 2, "mg loading dose"),
      secondary: [
        { label: "Calculated before cap", value: `${fmt(uncapped, 2, "mg")}` },
        ...(maxDose !== undefined ? [{ label: "Maximum", value: `${fmt(maxDose, 2, "mg")}` }] : []),
      ],
      calculationSteps: [`${dosePerKg} mg/kg × ${weight} kg = ${uncapped} mg${maxDose !== undefined ? `; capped at ${maxDose} mg when applicable` : ""}`],
      interpretation: capped ? "The mathematical loading dose exceeded the supplied maximum, so the displayed result is capped at that maximum." : "Mathematical loading-dose calculation only. The loading regimen must come from the drug-specific protocol.",
      warnings: [
        "Do not infer a loading-dose rate from this calculator; use a validated drug-specific regimen.",
        ...(maxDose === undefined ? ["No maximum dose was supplied; verify any drug-specific maximum before administration."] : []),
      ],
    }
  },
}

/** Converts a prescribed total daily dose into an individual dose using a dosing frequency. */
export const maintenanceDoseCalculator: CalculatorDefinition = {
  id: "maintenance-dose",
  name: "Maintenance Dose",
  shortName: "Maintenance Dose",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates an individual maintenance dose from a prescribed total daily dose and dosing frequency.",
  formula: "Dose per administration = total daily dose ÷ administrations per day",
  keywords: ["maintenance dose", "daily dose", "frequency", "interval"],
  relatedTools: ["mg-per-kg-per-day-dose", "dose-per-administration"],
  inputs: [
    { id: "dailyDose", label: "Prescribed total daily dose", kind: "number", unit: "mg/day", min: 0, step: 0.1 },
    { id: "administrationsPerDay", label: "Administrations per day", kind: "number", unit: "doses/day", min: 0, step: 1 },
  ],
  calculate: (inputs) => {
    const dailyDose = num(inputs, "dailyDose")
    const administrations = num(inputs, "administrationsPerDay")
    assertPositive(dailyDose, "Total daily dose")
    assertPositive(administrations, "Administrations per day")
    const dose = round(dailyDose / administrations, 2)
    const interval = round(24 / administrations, 2)
    return {
      value: dose,
      unit: "mg/dose",
      display: fmt(dose, 2, "mg/dose"),
      secondary: [{ label: "Approximate interval", value: `${fmt(interval, 2, "hours")}` }],
      calculationSteps: [`${dailyDose} mg/day ÷ ${administrations} doses/day = ${dose} mg/dose`],
      interpretation: "This converts a prescribed total daily dose into equal mathematical administrations. The actual schedule may be indication-, formulation-, age-, and renal-function dependent.",
      warnings: ["Do not use the calculated interval as a drug-specific recommendation; verify the prescribed frequency and formulation."],
    }
  },
}

/** Calculates infusion duration from volume and pump rate. */
export const infusionDurationCalculator: CalculatorDefinition = {
  id: "infusion-duration",
  name: "Infusion Duration",
  shortName: "Infusion Duration",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates how long an infusion will run from total volume and infusion rate.",
  formula: "Time (hours) = volume (mL) ÷ rate (mL/hour)",
  keywords: ["infusion", "duration", "mL/hour", "IV", "time"],
  relatedTools: ["infusion-rate", "dose-volume", "drops-per-minute"],
  inputs: [
    { id: "volume", label: "Infusion volume", kind: "number", unit: "mL", min: 0, step: 0.1 },
    { id: "rate", label: "Infusion rate", kind: "number", unit: "mL/hour", min: 0, step: 0.1 },
  ],
  calculate: (inputs) => {
    const volume = num(inputs, "volume")
    const rate = num(inputs, "rate")
    assertPositive(volume, "Infusion volume")
    assertPositive(rate, "Infusion rate")
    const hours = volume / rate
    const minutes = hours * 60
    return {
      value: round(hours, 2),
      unit: "hours",
      display: `${fmt(hours, 2, "hours")} (${fmt(minutes, 1, "minutes")})`,
      calculationSteps: [`${volume} mL ÷ ${rate} mL/hour = ${round(hours, 2)} hours`],
      interpretation: "Mathematical infusion-time calculation. Confirm the prescribed infusion duration, drug-specific maximum rate and line/device requirements before administration.",
      warnings: ["Do not infer a safe infusion rate from this result; drug-specific administration limits still apply."],
    }
  },
}

/** Calculates the total amount of drug delivered across a fixed number of administrations. */
export const courseTotalDoseCalculator: CalculatorDefinition = {
  id: "course-total-dose",
  name: "Course Total Dose",
  shortName: "Course Total",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates total drug exposure from dose per administration, frequency and treatment duration.",
  formula: "Total course dose = dose per administration × administrations per day × treatment days",
  keywords: ["course dose", "total dose", "duration", "treatment course"],
  relatedTools: ["dose-per-administration", "maintenance-dose"],
  inputs: [
    { id: "dose", label: "Dose per administration", kind: "number", unit: "mg", min: 0, step: 0.1 },
    { id: "administrationsPerDay", label: "Administrations per day", kind: "number", unit: "doses/day", min: 0, step: 1 },
    { id: "days", label: "Treatment duration", kind: "number", unit: "days", min: 0, step: 0.5 },
  ],
  calculate: (inputs) => {
    const dose = num(inputs, "dose")
    const administrations = num(inputs, "administrationsPerDay")
    const days = num(inputs, "days")
    assertPositive(dose, "Dose per administration")
    assertPositive(administrations, "Administrations per day")
    assertPositive(days, "Treatment duration")
    const daily = round(dose * administrations, 2)
    const total = round(daily * days, 2)
    return {
      value: total,
      unit: "mg",
      display: fmt(total, 2, "mg total course dose"),
      secondary: [{ label: "Daily total", value: fmt(daily, 2, "mg/day") }],
      calculationSteps: [`${dose} mg/dose × ${administrations} doses/day = ${daily} mg/day`, `${daily} mg/day × ${days} days = ${total} mg`],
      interpretation: "Mathematical course-total calculation. Treatment duration must come from the indication-specific protocol and patient response.",
      warnings: ["Do not use this calculator to determine treatment duration or to extend a prescribed course."],
    }
  },
}

/** WHO 2024 oral zinc regimen for children up to 10 years with diarrhoea. */
export const whoPediatricDiarrhoeaZincCalculator: CalculatorDefinition = {
  id: "who-pediatric-diarrhoea-zinc",
  name: "WHO Pediatric Diarrhoea  to  Zinc Regimen",
  shortName: "Diarrhoea Zinc",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates the WHO 2024 oral zinc reference regimen for children up to 10 years with acute watery or persistent diarrhoea.",
  formula: "Zinc = 5 mg elemental zinc once daily; duration = 10–14 days",
  keywords: ["diarrhoea", "diarrhea", "zinc", "pediatric", "WHO", "protocol", "regimen"],
  relatedTools: ["dose-volume", "oral-liquid-dose-volume", "course-total-dose"],
  inputs: [
    {
      id: "ageYears",
      label: "Age",
      kind: "number",
      unit: "years",
      min: 0,
      max: 10,
      step: 0.01,
      helpText: "WHO 2024 recommendation covered here applies to children up to 10 years.",
    },
    {
      id: "diarrhoeaType",
      label: "Diarrhoea type",
      kind: "select",
      options: [
        { value: "acute-watery", label: "Acute watery diarrhoea" },
        { value: "persistent", label: "Persistent diarrhoea" },
      ],
    },
    {
      id: "duration",
      label: "Treatment duration",
      kind: "select",
      options: [
        { value: "10", label: "10 days" },
        { value: "11", label: "11 days" },
        { value: "12", label: "12 days" },
        { value: "13", label: "13 days" },
        { value: "14", label: "14 days" },
      ],
      helpText: "WHO recommends referring to the existing 10–14 day duration recommendation.",
    },
  ],
  calculate: (inputs) => {
    const ageYears = num(inputs, "ageYears")
    const diarrhoeaType = str(inputs, "diarrhoeaType")
    const duration = Number(str(inputs, "duration"))
    if (ageYears < 0) throw new Error("Age must be 0 years or greater")
    if (ageYears > 10) throw new Error("Age must be 10 years or less for this WHO reference calculator")
    if (!Number.isInteger(duration) || duration < 10 || duration > 14) {
      throw new Error("Treatment duration must be between 10 and 14 days")
    }

    const dailyDose = 5
    const total = dailyDose * duration
    const typeLabel = diarrhoeaType === "persistent" ? "Persistent diarrhoea" : "Acute watery diarrhoea"

    return {
      value: dailyDose,
      unit: "mg elemental zinc/day",
      display: `${dailyDose} mg elemental zinc orally once daily for ${duration} days`,
      secondary: [
        { label: "Protocol condition", value: typeLabel },
        { label: "Daily dose", value: "5 mg elemental zinc" },
        { label: "Frequency", value: "Once daily" },
        { label: "Duration", value: `${duration} days` },
        { label: "Calculated course total", value: `${total} mg elemental zinc` },
        { label: "Population", value: "Children up to 10 years" },
      ],
      calculationSteps: [
        "WHO 2024 reference dose = 5 mg elemental zinc once daily",
        `5 mg/day × ${duration} days = ${total} mg elemental zinc total course dose`,
      ],
      interpretation: `WHO 2024 reference regimen for children up to 10 years with ${typeLabel.toLowerCase()}: oral zinc 5 mg once daily for 10–14 days.`,
      warnings: [
        "This calculator covers the WHO 2024 oral-zinc recommendation for acute watery or persistent diarrhoea; it is not a dehydration assessment or complete diarrhoea-management algorithm.",
        "Use elemental zinc content when converting to a tablet, dispersible tablet or liquid formulation; verify the actual product strength before administration.",
        "ORS, continued feeding and assessment for dehydration remain part of diarrhoea management. Blood in stool, severe dehydration, persistent symptoms or other danger signs require clinical assessment.",
      ],
    }
  },
  notes: [
    "WHO 2024 recommends adjunctive oral zinc for acute watery and persistent diarrhoea in children up to 10 years and suggests a 5 mg dose; duration follows the existing 10–14 day recommendation.",
  ],
  limitations: [
    "This is a protocol-reference calculator and does not diagnose diarrhoea, assess dehydration or determine whether zinc is appropriate for an individual child.",
    "Product formulation and elemental-zinc content must be verified separately.",
  ],
}

/** Pediatric estimated fluid deficit from a clinician-entered dehydration percentage. */
export const pediatricFluidDeficitCalculator: CalculatorDefinition = {
  id: "pediatric-fluid-deficit",
  name: "Pediatric Fluid Deficit  to  Assessed Dehydration",
  shortName: "Fluid Deficit",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates estimated fluid deficit from patient weight and a clinician-entered dehydration percentage; it does not assess dehydration.",
  formula: "Deficit (mL) = weight (kg) × dehydration (%) × 10",
  keywords: ["fluid", "deficit", "dehydration", "pediatric", "rehydration"],
  relatedTools: ["who-pediatric-ors-plan-b", "who-pediatric-maintenance-fluid"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 },
    { id: "dehydrationPercent", label: "Clinician-assessed dehydration", kind: "number", unit: "%", min: 0, max: 20, step: 0.1, helpText: "Enter the clinically assessed percentage; do not use this calculator to diagnose dehydration." },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const dehydrationPercent = num(inputs, "dehydrationPercent")
    assertPositive(weight, "Patient weight")
    if (!Number.isFinite(dehydrationPercent) || dehydrationPercent < 0 || dehydrationPercent > 20) {
      throw new Error("Clinician-assessed dehydration must be between 0% and 20%.")
    }

    const deficit = round(weight * dehydrationPercent * 10, 1)
    const deficitLitres = round(deficit / 1000, 3)

    return {
      value: deficit,
      unit: "mL",
      display: `${deficit} mL estimated fluid deficit`,
      secondary: [
        { label: "Weight", value: `${weight} kg` },
        { label: "Assessed dehydration", value: `${dehydrationPercent}%` },
        { label: "Estimated deficit", value: `${deficitLitres} L` },
      ],
      calculationSteps: [
        `${weight} kg × ${dehydrationPercent}% × 10 = ${deficit} mL`,
      ],
      interpretation: "This is an estimated deficit based only on the dehydration percentage entered by the clinician. It does not determine the rehydration route, rate, fluid type or treatment schedule.",
      warnings: [
        "This calculator does not diagnose or grade dehydration; the percentage must come from clinical assessment.",
        "Do not use this result alone to prescribe oral or intravenous fluids. Rehydration route, rate, fluid type, ongoing losses and reassessment depend on the clinical condition and applicable protocol.",
        "Severe dehydration, shock, severe acute malnutrition and important comorbidities require condition-specific fluid management and close monitoring.",
      ],
    }
  },
  notes: [
    "Estimated fluid deficit is expressed as weight × dehydration percentage × 10 mL/kg per percentage point.",
  ],
  limitations: [
    "Requires a clinician-assessed dehydration percentage and is not a diagnostic tool.",
    "Does not replace an applicable WHO, national or facility rehydration protocol.",
  ],
}

/** WHO pediatric normal maintenance IV fluid reference using the Holliday-Segar method. */
export const whoPediatricMaintenanceFluidCalculator: CalculatorDefinition = {
  id: "who-pediatric-maintenance-fluid",
  name: "WHO Pediatric Maintenance IV Fluid",
  shortName: "Maintenance Fluid",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates a normal pediatric maintenance IV fluid rate using the WHO-described Holliday-Segar weight formula.",
  formula: "4 mL/kg/hour for first 10 kg + 2 mL/kg/hour for next 10 kg + 1 mL/kg/hour for each subsequent kg",
  keywords: ["maintenance fluid", "IV fluid", "pediatric", "paediatric", "Holliday-Segar", "4-2-1", "WHO"],
  relatedTools: ["who-pediatric-ors-plan-b", "who-pediatric-ors-ongoing-loss"],
  inputs: [
    {
      id: "weight",
      label: "Patient weight",
      kind: "number",
      unit: "kg",
      min: 0.5,
      max: 100,
      step: 0.1,
      helpText: "Use the clinically appropriate dosing/maintenance weight. In overweight or obese patients, the source notes that ideal body weight may be appropriate.",
    },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")

    let hourlyRate: number
    if (weight <= 10) {
      hourlyRate = 4 * weight
    } else if (weight <= 20) {
      hourlyRate = 40 + 2 * (weight - 10)
    } else {
      hourlyRate = 60 + (weight - 20)
    }

    const dailyVolume = round(hourlyRate * 24, 1)
    const ratePerKg = round(hourlyRate / weight, 2)

    return {
      value: round(hourlyRate, 1),
      unit: "mL/hour",
      display: `${round(hourlyRate, 1)} mL/hour maintenance`,
      secondary: [
        { label: "24-hour volume", value: `${dailyVolume} mL/day` },
        { label: "Average rate", value: `${ratePerKg} mL/kg/hour` },
        { label: "Method", value: "Holliday-Segar / WHO maintenance formula" },
      ],
      calculationSteps: [
        weight <= 10
          ? `4 mL/kg/hour × ${weight} kg = ${round(hourlyRate, 1)} mL/hour`
          : weight <= 20
            ? `4 mL/kg/hour × first 10 kg = 40 mL/hour; 2 mL/kg/hour × ${(weight - 10).toFixed(1)} kg = ${round(2 * (weight - 10), 1)} mL/hour; total = ${round(hourlyRate, 1)} mL/hour`
            : `4 mL/kg/hour × first 10 kg = 40 mL/hour; 2 mL/kg/hour × next 10 kg = 20 mL/hour; 1 mL/kg/hour × ${(weight - 20).toFixed(1)} kg = ${round(weight - 20, 1)} mL/hour; total = ${round(hourlyRate, 1)} mL/hour`,
        `${round(hourlyRate, 1)} mL/hour × 24 hours = ${dailyVolume} mL/day`,
      ],
      interpretation: "Normal maintenance-fluid calculation only. The actual fluid type, rate and monitoring plan must be individualized to the child's clinical condition.",
      warnings: [
        "This calculates normal maintenance needs; it does not calculate resuscitation, dehydration deficit, ongoing stool/vomit replacement or shock treatment.",
        "Do not use the result as an automatic IV prescription for an acutely ill child. Fluid requirements may need adjustment for the clinical condition, oral intake, urine output, renal/cardiac function and other losses.",
        "For overweight or obese patients, the WHO source notes that ideal body weight may be used for normal maintenance calculations; this calculator does not calculate ideal body weight automatically.",
        "Verify the appropriate IV fluid composition and local pediatric protocol before administration.",
      ],
    }
  },
  notes: [
    "WHO describes normal pediatric maintenance IV fluid using 4 mL/kg/hour for the first 10 kg, 2 mL/kg/hour for the next 10 kg and 1 mL/kg/hour for subsequent kilograms.",
  ],
  limitations: [
    "Does not determine whether IV maintenance fluid is indicated.",
    "Does not account for dehydration deficit, resuscitation, replacement of abnormal ongoing losses or disease-specific fluid restrictions.",
    "Fluid composition and clinical monitoring require a separate clinical decision.",
  ],
}

/** WHO pediatric diarrhoea Plan B oral rehydration reference. */
export const whoPediatricOrsPlanBCalculator: CalculatorDefinition = {
  id: "who-pediatric-ors-plan-b",
  name: "WHO Pediatric ORS  to  Plan B Volume",
  shortName: "ORS Plan B",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Calculates the WHO reference volume of oral rehydration solution for children with some dehydration: 75 mL/kg over 4 hours.",
  formula: "ORS volume = 75 mL/kg × body weight; administer over 4 hours",
  keywords: ["ORS", "oral rehydration", "diarrhoea", "diarrhea", "dehydration", "Plan B", "pediatric", "WHO"],
  relatedTools: ["who-pediatric-diarrhoea-zinc"],
  inputs: [
    {
      id: "weight",
      label: "Patient weight",
      kind: "number",
      unit: "kg",
      min: 0.5,
      max: 60,
      step: 0.1,
      helpText: "Use the measured current body weight whenever possible.",
    },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    assertPositive(weight, "Patient weight")

    const totalVolume = round(weight * 75, 1)
    const hourlyVolume = round(totalVolume / 4, 1)

    return {
      value: totalVolume,
      unit: "mL ORS",
      display: `${totalVolume} mL ORS over 4 hours`,
      secondary: [
        { label: "Dose basis", value: "75 mL/kg" },
        { label: "Hourly average", value: `${hourlyVolume} mL/hour` },
        { label: "Duration", value: "4 hours" },
        { label: "Protocol", value: "WHO Plan B  to  some dehydration" },
      ],
      calculationSteps: [
        `75 mL/kg × ${weight} kg = ${totalVolume} mL ORS`,
        `${totalVolume} mL ÷ 4 hours = ${hourlyVolume} mL/hour average`,
      ],
      interpretation: "WHO Plan B reference volume for a child with some dehydration. Give ORS in small, frequent amounts and reassess after 4 hours.",
      warnings: [
        "Use this calculator only when the child has been clinically assessed as having some dehydration and oral/enteral rehydration is appropriate.",
        "Do not use this result for severe dehydration, shock or a child unable to drink; those situations require the applicable emergency/IV rehydration protocol.",
        "This is a volume reference, not a diagnosis of dehydration. Reassess the child after 4 hours and account for ongoing losses according to the applicable protocol.",
        "Use correctly prepared low-osmolarity ORS and follow the product instructions for preparation and storage.",
      ],
    }
  },
  notes: [
    "WHO clinical tools describe Plan B as 75 mL/kg of ORS over 4 hours for children with some dehydration, with reassessment after 4 hours.",
  ],
  limitations: [
    "Does not assess dehydration severity or determine whether Plan B is appropriate.",
    "Does not replace emergency management for severe dehydration or shock.",
    "Does not calculate ongoing stool/vomit replacement or maintenance fluids.",
  ],
}

/** WHO Plan A home/ongoing ORS reference after each loose stool. */
export const whoPediatricOrsOngoingLossCalculator: CalculatorDefinition = {
  id: "who-pediatric-ors-ongoing-loss",
  name: "WHO Pediatric ORS  to  Ongoing Losses",
  shortName: "ORS Ongoing Loss",
  category: "dosing",
  subcategory: "general-dosing",
  description: "Estimates the WHO home-treatment ORS volume to offer after each loose stool and the cumulative amount for a selected number of stools.",
  formula: "<2 years: 50–100 mL per loose stool; 2–<10 years: 100–200 mL per loose stool; ≥10 years: as much as wanted",
  keywords: ["ORS", "oral rehydration", "diarrhoea", "diarrhea", "ongoing losses", "Plan A", "pediatric", "WHO", "stool"],
  relatedTools: ["who-pediatric-ors-plan-b", "who-pediatric-diarrhoea-zinc"],
  inputs: [
    {
      id: "ageYears",
      label: "Age",
      kind: "number",
      unit: "years",
      min: 0,
      max: 18,
      step: 0.1,
      helpText: "Use the child's current age. For children under 1 year, enter the age in decimal years (for example, 0.5).",
    },
    {
      id: "looseStools",
      label: "Number of loose stools",
      kind: "number",
      min: 1,
      max: 20,
      step: 1,
      helpText: "Optional planning count: this calculates the cumulative reference amount across this many loose stools; actual intake should follow clinical assessment and tolerance.",
    },
  ],
  calculate: (inputs) => {
    const ageYears = num(inputs, "ageYears")
    const looseStools = num(inputs, "looseStools")
    if (!Number.isFinite(ageYears) || ageYears < 0) throw new Error("Age must be 0 years or greater")
    assertPositive(looseStools, "Number of loose stools")
    if (ageYears > 18) throw new Error("Age must be 18 years or less")
    if (!Number.isInteger(looseStools) || looseStools < 1 || looseStools > 20) {
      throw new Error("Number of loose stools must be a whole number from 1 to 20")
    }

    if (ageYears < 2) {
      const min = 50 * looseStools
      const max = 100 * looseStools
      return {
        value: `${50}–${100}`,
        unit: "mL per loose stool",
        display: `Offer 50–100 mL ORS after each loose stool; ${min}–${max} mL across ${looseStools} stool${looseStools === 1 ? "" : "s"}`,
        secondary: [
          { label: "Per-stool reference", value: "50–100 mL ORS" },
          { label: "Planned stool count", value: String(looseStools) },
          { label: "Cumulative reference range", value: `${min}–${max} mL` },
          { label: "Protocol", value: "WHO Plan A  to  home/ongoing fluid replacement" },
        ],
        calculationSteps: [
          `50–100 mL × ${looseStools} loose stool${looseStools === 1 ? "" : "s"} = ${min}–${max} mL`,
        ],
        interpretation: "WHO home-treatment reference for children under 2 years: offer 50–100 mL ORS after each loose stool, using frequent small sips.",
        warnings: [
          "This is an ongoing-loss/home-treatment reference, not a dehydration assessment or a replacement for Plan B or Plan C.",
          "The cumulative range is a planning calculation, not a requirement to force the entire amount if the child cannot tolerate it.",
          "If the child becomes unable to drink, drinks poorly, repeatedly vomits, becomes more unwell, develops blood in stool or shows signs of dehydration, seek clinical assessment promptly.",
          "Continue breastfeeding/feeding as appropriate and use correctly prepared ORS.",
        ],
      }
    }

    if (ageYears < 10) {
      const min = 100 * looseStools
      const max = 200 * looseStools
      return {
        value: `${100}–${200}`,
        unit: "mL per loose stool",
        display: `Offer 100–200 mL ORS after each loose stool; ${min}–${max} mL across ${looseStools} stool${looseStools === 1 ? "" : "s"}`,
        secondary: [
          { label: "Per-stool reference", value: "100–200 mL ORS" },
          { label: "Planned stool count", value: String(looseStools) },
          { label: "Cumulative reference range", value: `${min}–${max} mL` },
          { label: "Protocol", value: "WHO Plan A  to  home/ongoing fluid replacement" },
        ],
        calculationSteps: [
          `100–200 mL × ${looseStools} loose stool${looseStools === 1 ? "" : "s"} = ${min}–${max} mL`,
        ],
        interpretation: "WHO home-treatment reference for children aged 2 to under 10 years: offer 100–200 mL ORS after each loose stool, using frequent sips.",
        warnings: [
          "This is an ongoing-loss/home-treatment reference, not a dehydration assessment or a replacement for Plan B or Plan C.",
          "The cumulative range is a planning calculation, not a requirement to force the entire amount if the child cannot tolerate it.",
          "If the child becomes unable to drink, drinks poorly, repeatedly vomits, becomes more unwell, develops blood in stool or shows signs of dehydration, seek clinical assessment promptly.",
          "Continue feeding as appropriate and use correctly prepared ORS.",
        ],
      }
    }

    return {
      value: "as tolerated",
      unit: "mL",
      display: `Offer ORS after each loose stool as much as the child wants; ${looseStools} stool${looseStools === 1 ? "" : "s"} recorded`,
      secondary: [
        { label: "Per-stool reference", value: "As much as wanted/tolerated" },
        { label: "Planned stool count", value: String(looseStools) },
        { label: "Cumulative calculation", value: "Not numerically prescribed by this reference" },
        { label: "Protocol", value: "WHO Plan A  to  home/ongoing fluid replacement" },
      ],
      calculationSteps: [
        "For children aged 10 years or older, WHO home-treatment guidance uses thirst/tolerance rather than a fixed numeric volume per stool.",
      ],
      interpretation: "For children aged 10 years or older, offer extra ORS/fluids as much as wanted and tolerated rather than applying the younger-child fixed volume bands.",
      warnings: [
        "This is an ongoing-loss/home-treatment reference, not a dehydration assessment or a replacement for Plan B or Plan C.",
        "Do not force a fixed volume in older children; thirst and tolerance guide intake.",
        "If the child becomes unable to drink, drinks poorly, repeatedly vomits, becomes more unwell, develops blood in stool or shows signs of dehydration, seek clinical assessment promptly.",
        "Continue feeding as appropriate and use correctly prepared ORS.",
      ],
    }
  },
  notes: [
    "WHO home-treatment guidance gives 50–100 mL after each loose stool for children under 2 years and 100–200 mL for children 2–10 years; older children and adults should take as much as wanted.",
  ],
  limitations: [
    "The fixed age-band volumes are supporting WHO home-treatment guidance rather than a substitute for a current national or facility protocol.",
    "Does not assess dehydration, calculate Plan B/Plan C therapy, or prescribe maintenance fluids.",
    "The cumulative stool-count calculation is only a planning aid; actual intake depends on clinical status, thirst, vomiting and tolerance.",
  ],
}

/** WHO 2024 pneumonia regimen selector for children aged 2–59 months. */
export const whoPediatricPneumoniaRegimenCalculator: CalculatorDefinition = {
  id: "who-pediatric-pneumonia-regimen",
  name: "WHO Pediatric Pneumonia  to  Regimen Reference",
  shortName: "Pneumonia Regimen",
  category: "dosing",
  subcategory: "antibiotic",
  description: "Selects a WHO 2024 pneumonia presentation and returns the corresponding pediatric amoxicillin reference regimen for children aged 2–59 months.",
  formula: "Dose = 40 mg/kg per dose × weight; twice daily",
  keywords: ["pneumonia", "amoxicillin", "pediatric", "WHO", "protocol", "regimen"],
  relatedTools: ["amoxicillin-pediatric-dose", "course-total-dose"],
  inputs: [
    { id: "weight", label: "Patient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1 },
    {
      id: "presentation",
      label: "Pneumonia presentation",
      kind: "select",
      options: [
        { value: "fast-breathing", label: "Fast breathing only" },
        { value: "chest-indrawing", label: "Chest indrawing" },
      ],
    },
    {
      id: "fastBreathingDuration",
      label: "Fast-breathing duration protocol",
      kind: "select",
      options: [
        { value: "3-days", label: "3 days" },
        { value: "5-days", label: "5 days" },
      ],
      helpText: "For fast breathing only, use the duration adopted by the applicable local/national protocol.",
    },
  ],
  calculate: (inputs) => {
    const weight = num(inputs, "weight")
    const presentation = str(inputs, "presentation")
    const duration = str(inputs, "fastBreathingDuration")
    assertPositive(weight, "Patient weight")

    const dose = round(weight * 40, 1)
    const days = presentation === "chest-indrawing" ? 5 : duration === "3-days" ? 3 : 5
    const administrationsPerDay = 2
    const total = round(dose * administrationsPerDay * days, 1)
    const presentationLabel = presentation === "chest-indrawing" ? "Chest indrawing" : "Fast breathing only"

    return {
      value: dose,
      unit: "mg/dose",
      display: `${dose} mg oral amoxicillin twice daily for ${days} days`,
      secondary: [
        { label: "Protocol presentation", value: presentationLabel },
        { label: "Dose basis", value: "40 mg/kg/dose" },
        { label: "Route", value: "Oral" },
        { label: "Frequency", value: "Twice daily (about every 12 hours)" },
        { label: "Duration", value: `${days} days` },
        { label: "Calculated course total", value: `${total} mg amoxicillin` },
        { label: "Population", value: "Children aged 2–59 months" },
      ],
      calculationSteps: [
        `40 mg/kg × ${weight} kg = ${dose} mg/dose`,
        `${dose} mg/dose × 2 doses/day × ${days} days = ${total} mg total course dose`,
      ],
      interpretation: presentation === "chest-indrawing"
        ? "WHO 2024 reference regimen for children aged 2–59 months with chest indrawing and no general danger signs: oral amoxicillin for 5 days."
        : "WHO 2024 reference regimen for children aged 2–59 months with pneumonia presenting with fast breathing only. The guideline permits 3 or 5 days; the applicable local/national protocol should determine the duration.",
      warnings: [
        "This selector applies only to children aged 2–59 months and the presentations described by the WHO guideline.",
        "Do not use this calculator for general danger signs, very severe illness, infants under 2 months, HIV-specific management or treatment failure; those situations require the applicable clinical protocol.",
        "Confirm the diagnosis, formulation, allergy status and current local/national guideline before administration.",
      ],
    }
  },
  notes: [
    "WHO 2024 pneumonia guidance recommends oral amoxicillin for 2–59 month children with fast breathing only, with a 3- or 5-day course, and for chest indrawing with no general danger signs, for 5 days.",
  ],
  limitations: [
    "This is a protocol-reference calculator, not a diagnostic tool or universal pneumonia treatment algorithm.",
    "It does not cover children with general danger signs, very severe illness, HIV-specific treatment, treatment failure or complications.",
  ],
}
