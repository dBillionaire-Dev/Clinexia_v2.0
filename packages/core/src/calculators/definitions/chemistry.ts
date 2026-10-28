import type { CalculatorDefinition } from "../types"
import { num, str, assertPositive, assertNonNegative, round, fmt } from "../helpers"

const unitOption = (opts: { value: string; label: string }[]) => opts

export const ldlCalculator: CalculatorDefinition = {
  id: "ldl-friedewald",
  name: "LDL Cholesterol (Friedewald)",
  shortName: "LDL",
  category: "chemistry",
  description: "Estimates LDL cholesterol from total cholesterol, HDL, and triglycerides.",
  isEstimator: true,
  formula: "LDL = TC - HDL - TG/5 (mg/dL) or TC - HDL - TG/2.2 (mmol/L)",
  keywords: ["ldl", "cholesterol", "friedewald", "lipid"],
  relatedTools: ["non-hdl-cholesterol", "vldl-estimate", "total-hdl-ratio", "ldl-hdl-ratio"],
  inputs: [
    {
      id: "unit",
      label: "Units",
      kind: "select",
      options: unitOption([
        { value: "mg/dL", label: "mg/dL" },
        { value: "mmol/L", label: "mmol/L" },
      ]),
      defaultValue: "mg/dL",
    },
    { id: "tc", label: "Total Cholesterol", kind: "number", min: 0, step: 0.01, defaultValue: 200 },
    { id: "hdl", label: "HDL", kind: "number", min: 0, step: 0.01, defaultValue: 50 },
    { id: "tg", label: "Triglycerides", kind: "number", min: 0, step: 0.01, defaultValue: 150 },
  ],
  calculate: (inputs) => {
    const unit = str(inputs, "unit")
    const tc = num(inputs, "tc")
    const hdl = num(inputs, "hdl")
    const tg = num(inputs, "tg")
    const divisor = unit === "mmol/L" ? 2.2 : 5

    if (tg > (unit === "mmol/L" ? 4.5 : 400)) {
      return {
        value: "N/A",
        display: "Not valid. TG too high!!!",
        warnings: [
          "The Friedewald equation is unreliable when triglycerides exceed ~400 mg/dL (4.5 mmol/L). Use direct LDL measurement instead.",
        ],
      }
    }

    const ldl = tc - hdl - tg / divisor
    const rounded = round(ldl, unit === "mmol/L" ? 2 : 1)

    return {
      value: rounded,
      unit,
      display: fmt(rounded, unit === "mmol/L" ? 2 : 1, unit),
      calculationSteps: [`${tc} - ${hdl} - (${tg} / ${divisor})`],
      warnings: ldl < 0 ? ["Calculated LDL is negative, check input values."] : undefined,
    }
  },
  notes: ["The Friedewald equation is an estimate, not a directly measured value."],
  limitations: ["Not valid for triglycerides above ~400 mg/dL (4.5 mmol/L) or in non-fasting samples."],
}

export const nonHdlCalculator: CalculatorDefinition = {
  id: "non-hdl-cholesterol",
  name: "Non-HDL Cholesterol",
  shortName: "Non-HDL",
  category: "chemistry",
  description: "Calculates non-HDL cholesterol (total cholesterol minus HDL).",
  formula: "Non-HDL = TC - HDL",
  keywords: ["non-hdl", "cholesterol", "lipid"],
  relatedTools: ["ldl-friedewald", "vldl-estimate"],
  inputs: [
    { id: "tc", label: "Total Cholesterol", kind: "number", unit: "mg/dL", min: 0, step: 0.01, defaultValue: 200 },
    { id: "hdl", label: "HDL", kind: "number", unit: "mg/dL", min: 0, step: 0.01, defaultValue: 50 },
  ],
  calculate: (inputs) => {
    const tc = num(inputs, "tc")
    const hdl = num(inputs, "hdl")
    const value = round(tc - hdl, 1)
    return {
      value,
      unit: "mg/dL",
      display: fmt(value, 1, "mg/dL"),
      calculationSteps: [`${tc} - ${hdl}`],
    }
  },
}

export const vldlCalculator: CalculatorDefinition = {
  id: "vldl-estimate",
  name: "VLDL Estimation",
  shortName: "VLDL",
  category: "chemistry",
  description: "Estimates VLDL cholesterol from triglycerides.",
  isEstimator: true,
  formula: "VLDL = TG / 5 (mg/dL)",
  keywords: ["vldl", "cholesterol", "triglycerides"],
  relatedTools: ["ldl-friedewald", "non-hdl-cholesterol"],
  inputs: [{ id: "tg", label: "Triglycerides", kind: "number", unit: "mg/dL", min: 0, step: 0.01, defaultValue: 150 }],
  calculate: (inputs) => {
    const tg = num(inputs, "tg")
    const value = round(tg / 5, 1)
    return {
      value,
      unit: "mg/dL",
      display: fmt(value, 1, "mg/dL"),
      calculationSteps: [`${tg} / 5`],
      warnings: tg > 400 ? ["Estimate is unreliable above ~400 mg/dL triglycerides."] : undefined,
    }
  },
  limitations: ["Only valid when triglycerides are below ~400 mg/dL."],
}

export const anionGapCalculator: CalculatorDefinition = {
  id: "anion-gap",
  name: "Anion Gap",
  shortName: "AG",
  category: "chemistry",
  description: "Calculates the serum anion gap, with optional albumin correction.",
  formula: "AG = Na - (Cl + HCO3); Corrected AG = AG + 2.5 x (4 - albumin[g/dL])",
  keywords: ["anion gap", "electrolytes", "acid-base"],
  relatedTools: ["corrected-calcium", "delta-ratio", "estimated-osmolality"],
  inputs: [
    { id: "na", label: "Sodium", kind: "number", unit: "mmol/L", min: 0, defaultValue: 140 },
    { id: "cl", label: "Chloride", kind: "number", unit: "mmol/L", min: 0, defaultValue: 104 },
    { id: "hco3", label: "Bicarbonate", kind: "number", unit: "mmol/L", min: 0, defaultValue: 24 },
    {
      id: "albumin",
      label: "Albumin (optional, for correction)",
      kind: "number",
      unit: "g/dL",
      min: 0,
      step: 0.1,
      optional: true,
    },
  ],
  calculate: (inputs) => {
    const na = num(inputs, "na")
    const cl = num(inputs, "cl")
    const hco3 = num(inputs, "hco3")
    const albuminRaw = inputs["albumin"]

    const ag = na - (cl + hco3)
    const rounded = round(ag, 1)

    const secondary = []
    if (albuminRaw !== undefined && albuminRaw !== "") {
      const albumin = num(inputs, "albumin")
      const corrected = ag + 2.5 * (4 - albumin)
      secondary.push({ label: "Albumin-corrected AG", value: fmt(round(corrected, 1), 1, "mmol/L") })
    }

    return {
      value: rounded,
      unit: "mmol/L",
      display: fmt(rounded, 1, "mmol/L"),
      secondary: secondary.length ? secondary : undefined,
      calculationSteps: [`${na} - (${cl} + ${hco3})`],
      interpretation: "Typical reference interval is approximately 8-16 mmol/L, but varies by laboratory and method.",
    }
  },
  notes: ["Low albumin lowers the measured anion gap; correct for albumin when interpreting in hypoalbuminemia."],
}

export const correctedCalciumCalculator: CalculatorDefinition = {
  id: "corrected-calcium",
  name: "Corrected Calcium",
  shortName: "Corr. Ca",
  category: "chemistry",
  description: "Corrects total serum calcium for abnormal albumin concentration.",
  formula: "Corrected Ca (mg/dL) = Measured Ca + 0.8 x (4 - Albumin[g/dL])",
  keywords: ["calcium", "corrected calcium", "albumin"],
  relatedTools: ["anion-gap", "calcium-phosphate-product"],
  inputs: [
    { id: "calcium", label: "Measured Calcium", kind: "number", unit: "mg/dL", min: 0, step: 0.01, defaultValue: 9 },
    { id: "albumin", label: "Albumin", kind: "number", unit: "g/dL", min: 0, step: 0.1, defaultValue: 4 },
  ],
  calculate: (inputs) => {
    const calcium = num(inputs, "calcium")
    const albumin = num(inputs, "albumin")
    const corrected = calcium + 0.8 * (4 - albumin)
    const rounded = round(corrected, 2)

    return {
      value: rounded,
      unit: "mg/dL",
      display: fmt(rounded, 2, "mg/dL"),
      calculationSteps: [`${calcium} + 0.8 x (4 - ${albumin})`],
    }
  },
  limitations: ["An approximation  -  ionized calcium measurement is more accurate when available, particularly in critical illness."],
}

export const totalHdlRatioCalculator: CalculatorDefinition = {
  id: "total-hdl-ratio",
  name: "Total Cholesterol/HDL Ratio",
  shortName: "TC/HDL",
  category: "chemistry",
  description: "Calculates the ratio of total cholesterol to HDL cholesterol, a cardiovascular risk indicator.",
  formula: "TC/HDL ratio = Total Cholesterol / HDL",
  keywords: ["cholesterol ratio", "tc/hdl", "cardiovascular risk", "lipid"],
  relatedTools: ["ldl-friedewald", "non-hdl-cholesterol", "ldl-hdl-ratio"],
  inputs: [
    { id: "tc", label: "Total Cholesterol", kind: "number", unit: "mg/dL", min: 0, step: 0.01, defaultValue: 200 },
    { id: "hdl", label: "HDL", kind: "number", unit: "mg/dL", min: 0, step: 0.01, defaultValue: 50 },
  ],
  calculate: (inputs) => {
    const tc = num(inputs, "tc")
    const hdl = num(inputs, "hdl")
    if (hdl <= 0) throw new Error("HDL must be greater than zero")

    const ratio = tc / hdl
    const rounded = round(ratio, 1)

    let interpretation = "Desirable (below 3.5:1)."
    if (ratio >= 5) interpretation = "High risk range (5:1 or above)."
    else if (ratio >= 3.5) interpretation = "Borderline/moderate risk range (3.5:1-5:1)."

    return {
      value: rounded,
      display: fmt(rounded, 1, ":1"),
      calculationSteps: [`${tc} / ${hdl}`],
      interpretation,
    }
  },
  notes: ["General population thresholds are shown; individual cardiovascular risk depends on many additional factors."],
}

export const calciumPhosphateProductCalculator: CalculatorDefinition = {
  id: "calcium-phosphate-product",
  name: "Calcium-Phosphate Product",
  shortName: "Ca x PO4",
  category: "chemistry",
  description: "Calculates the calcium-phosphate product, used to assess risk of soft tissue/vascular calcification (especially in CKD).",
  formula: "Ca x PO4 product (mg²/dL²) = Calcium (mg/dL) x Phosphate (mg/dL)",
  keywords: ["calcium phosphate product", "ckd-mbd", "vascular calcification"],
  relatedTools: ["corrected-calcium"],
  inputs: [
    { id: "calcium", label: "Calcium", kind: "number", unit: "mg/dL", min: 0, step: 0.01, defaultValue: 9 },
    { id: "phosphate", label: "Phosphate", kind: "number", unit: "mg/dL", min: 0, step: 0.01, defaultValue: 4 },
  ],
  calculate: (inputs) => {
    const calcium = num(inputs, "calcium")
    const phosphate = num(inputs, "phosphate")
    const product = calcium * phosphate
    const rounded = round(product, 1)

    return {
      value: rounded,
      unit: "mg²/dL²",
      display: fmt(rounded, 1, "mg²/dL²"),
      calculationSteps: [`${calcium} x ${phosphate}`],
      warnings: product > 55 ? ["Product above ~55 mg²/dL² is commonly cited as a threshold associated with increased calcification risk in CKD-MBD guidelines."] : undefined,
    }
  },
  notes: ["Most relevant in the context of chronic kidney disease-mineral bone disorder (CKD-MBD) monitoring."],
}

export const ldlHdlRatioCalculator: CalculatorDefinition = {
  id: "ldl-hdl-ratio",
  name: "LDL/HDL Ratio",
  shortName: "LDL/HDL",
  category: "chemistry",
  description: "Calculates the ratio of LDL cholesterol to HDL cholesterol.",
  formula: "LDL/HDL ratio = LDL / HDL",
  keywords: ["ldl hdl ratio", "cholesterol ratio", "lipid", "cardiovascular risk"],
  relatedTools: ["ldl-friedewald", "total-hdl-ratio"],
  inputs: [
    { id: "ldl", label: "LDL", kind: "number", unit: "mg/dL", min: 0, step: 0.01, defaultValue: 100 },
    { id: "hdl", label: "HDL", kind: "number", unit: "mg/dL", min: 0, step: 0.01, defaultValue: 50 },
  ],
  calculate: (inputs) => {
    const ldl = num(inputs, "ldl")
    const hdl = num(inputs, "hdl")
    if (hdl <= 0) throw new Error("HDL must be greater than zero")
    assertNonNegative(ldl, "LDL")

    const ratio = ldl / hdl
    const rounded = round(ratio, 1)

    let interpretation = "Desirable (below 2.5:1)."
    if (ratio >= 4) interpretation = "High risk range (4:1 or above)."
    else if (ratio >= 2.5) interpretation = "Borderline/moderate risk range (2.5:1-4:1)."

    return {
      value: rounded,
      display: fmt(rounded, 1, ":1"),
      calculationSteps: [`${ldl} / ${hdl}`],
      interpretation,
    }
  },
  notes: ["General population thresholds are shown; individual cardiovascular risk depends on many additional factors."],
}

export const deltaRatioCalculator: CalculatorDefinition = {
  id: "delta-ratio",
  name: "Delta Gap / Delta Ratio",
  shortName: "Delta Ratio",
  category: "chemistry",
  description: "Calculates the delta gap and delta ratio from Na, Cl, and HCO3 to help classify mixed acid-base disorders.",
  formula: "Delta Gap = AG - 12\nDelta Ratio = Delta Gap / (24 - HCO3)",
  keywords: ["delta gap", "delta ratio", "acid-base", "anion gap", "metabolic acidosis"],
  relatedTools: ["anion-gap"],
  inputs: [
    { id: "na", label: "Sodium", kind: "number", unit: "mmol/L", min: 0, defaultValue: 140 },
    { id: "cl", label: "Chloride", kind: "number", unit: "mmol/L", min: 0, defaultValue: 100 },
    { id: "hco3", label: "Bicarbonate", kind: "number", unit: "mmol/L", min: 0, defaultValue: 12 },
  ],
  calculate: (inputs) => {
    const na = num(inputs, "na")
    const cl = num(inputs, "cl")
    const hco3 = num(inputs, "hco3")

    const ag = na - (cl + hco3)
    const deltaGap = ag - 12
    const deltaHco3 = 24 - hco3

    if (deltaHco3 === 0) throw new Error("Cannot calculate delta ratio: HCO3 is 24 (delta HCO3 is zero)")

    const deltaRatio = deltaGap / deltaHco3
    const rounded = round(deltaRatio, 2)

    let interpretation = "Pure high-anion-gap metabolic acidosis (ratio 1-2)."
    if (rounded < 0.4) interpretation = "Suggests a pure hyperchloremic (normal-anion-gap) metabolic acidosis (ratio <0.4)."
    else if (rounded < 1) interpretation = "Suggests a combined high-anion-gap and normal-anion-gap metabolic acidosis (ratio 0.4-1)."
    else if (rounded > 2) interpretation = "Suggests a concurrent metabolic alkalosis or pre-existing compensated respiratory acidosis (ratio >2)."

    return {
      value: rounded,
      display: fmt(rounded, 2),
      secondary: [
        { label: "Anion gap", value: fmt(round(ag, 1), 1, "mmol/L") },
        { label: "Delta gap", value: fmt(round(deltaGap, 1), 1, "mmol/L") },
      ],
      calculationSteps: [`AG = ${na} - (${cl} + ${hco3}) = ${round(ag, 1)}`, `Delta gap = ${round(ag, 1)} - 12 = ${round(deltaGap, 1)}`, `Delta ratio = ${round(deltaGap, 1)} / (24 - ${hco3})`],
      interpretation,
    }
  },
  notes: ["Assumes a normal anion gap of 12 and normal HCO3 of 24 mmol/L  -  some institutions use slightly different baselines."],
  limitations: ["A teaching tool for classifying mixed acid-base disorders, not a substitute for full clinical/blood gas assessment."],
}

export const estimatedOsmolalityCalculator: CalculatorDefinition = {
  id: "estimated-osmolality",
  name: "Estimated Serum Osmolality",
  shortName: "Osm",
  category: "chemistry",
  description: "Estimates serum osmolality from sodium, glucose, and BUN, with an optional osmolar gap if measured osmolality is known.",
  isEstimator: true,
  formula: "Osm (mOsm/kg) = 2 x Na + Glucose/18 + BUN/2.8",
  keywords: ["osmolality", "osmolar gap", "toxic alcohol", "serum osmolality"],
  relatedTools: ["anion-gap"],
  inputs: [
    { id: "na", label: "Sodium", kind: "number", unit: "mmol/L", min: 0, defaultValue: 140 },
    { id: "glucose", label: "Glucose", kind: "number", unit: "mg/dL", min: 0, defaultValue: 90 },
    { id: "bun", label: "BUN", kind: "number", unit: "mg/dL", min: 0, defaultValue: 14 },
    {
      id: "measuredOsmolality",
      label: "Measured osmolality (optional, for osmolar gap)",
      kind: "number",
      unit: "mOsm/kg",
      min: 0,
      optional: true,
    },
  ],
  calculate: (inputs) => {
    const na = num(inputs, "na")
    const glucose = num(inputs, "glucose")
    const bun = num(inputs, "bun")
    assertPositive(na, "Sodium")
    assertNonNegative(glucose, "Glucose")
    assertNonNegative(bun, "BUN")

    const calculated = 2 * na + glucose / 18 + bun / 2.8
    const rounded = round(calculated, 1)

    const secondary = []
    let osmolarGap: number | undefined
    const measuredRaw = inputs["measuredOsmolality"]
    if (measuredRaw !== undefined && measuredRaw !== "") {
      const measured = num(inputs, "measuredOsmolality")
      osmolarGap = measured - calculated
      secondary.push({ label: "Osmolar gap", value: fmt(round(osmolarGap, 1), 1, "mOsm/kg") })
    }

    return {
      value: rounded,
      unit: "mOsm/kg",
      display: fmt(rounded, 1, "mOsm/kg"),
      secondary: secondary.length ? secondary : undefined,
      calculationSteps: [`(2 x ${na}) + (${glucose} / 18) + (${bun} / 2.8)`],
      interpretation: "Typical reference interval is approximately 275-295 mOsm/kg.",
      warnings:
        osmolarGap !== undefined && Math.abs(osmolarGap) > 10
          ? ["An osmolar gap above ~10 mOsm/kg can suggest the presence of an unmeasured osmotically active substance (e.g. a toxic alcohol)."]
          : undefined,
    }
  },
  notes: ["The osmolar gap (measured minus calculated) is most useful when a toxic alcohol ingestion is suspected."],
}

const HBA1C_SLOPE = 28.7
const HBA1C_INTERCEPT = -46.7

export const hba1cEagCalculator: CalculatorDefinition = {
  id: "hba1c-eag",
  name: "HbA1c ↔ Estimated Average Glucose",
  shortName: "HbA1c ↔ eAG",
  category: "chemistry",
  description: "Converts between HbA1c and estimated average glucose (eAG) using the ADAG study formula.",
  isEstimator: true,
  formula: "eAG (mg/dL) = 28.7 x HbA1c(%) - 46.7",
  keywords: ["hba1c", "eag", "estimated average glucose", "a1c", "diabetes"],
  relatedTools: [],
  inputs: [
    {
      id: "direction",
      label: "Direction",
      kind: "select",
      options: [
        { value: "hba1c-to-eag", label: "HbA1c  to  eAG" },
        { value: "eag-to-hba1c", label: "eAG  to  HbA1c" },
      ],
      defaultValue: "hba1c-to-eag",
    },
    { id: "value", label: "Value", kind: "number", min: 0, step: 0.1, defaultValue: 7 },
  ],
  calculate: (inputs) => {
    const direction = str(inputs, "direction")
    const value = num(inputs, "value")
    assertPositive(value, "Value")

    if (direction === "hba1c-to-eag") {
      const eag = HBA1C_SLOPE * value + HBA1C_INTERCEPT
      const rounded = round(eag, 0)
      return {
        value: rounded,
        unit: "mg/dL",
        display: fmt(rounded, 0, "mg/dL"),
        calculationSteps: [`(28.7 x ${value}) - 46.7`],
        interpretation: "Estimated average glucose over the preceding ~3 months (ADAG study formula).",
      }
    }

    const hba1c = (value - HBA1C_INTERCEPT) / HBA1C_SLOPE
    const rounded = round(hba1c, 1)
    return {
      value: rounded,
      unit: "%",
      display: fmt(rounded, 1, "%"),
      calculationSteps: [`(${value} + 46.7) / 28.7`],
    }
  },
  notes: ["Based on the ADAG (A1c-Derived Average Glucose) study formula; individual correlation between HbA1c and glucose varies."],
}


export const correctedSodiumCalculator: CalculatorDefinition = {
  id: "corrected-sodium-hyperglycemia",
  name: "Corrected Sodium for Hyperglycemia",
  shortName: "Corrected Na",
  category: "chemistry",
  description: "Estimates corrected sodium from measured sodium and glucose using an explicitly selected correction factor.",
  formula: "Corrected Na = measured Na + correction factor × ((glucose − 100) / 100)",
  isEstimator: true,
  inputs: [
    { id: "sodium", label: "Measured sodium", kind: "number", unit: "mmol/L", min: 1, max: 250, step: 0.1, defaultValue: 140 },
    { id: "glucose", label: "Glucose", kind: "number", unit: "mg/dL", min: 0, max: 2000, step: 1, defaultValue: 100 },
    { id: "factor", label: "Correction factor", kind: "number", unit: "mmol/L per 100 mg/dL", min: 1.6, max: 2.4, step: 0.1, defaultValue: 2.4 },
  ],
  calculate: (inputs) => {
    const na = num(inputs, "sodium"), glucose = num(inputs, "glucose"), factor = num(inputs, "factor")
    assertPositive(na, "Sodium"); assertNonNegative(glucose, "Glucose"); assertPositive(factor, "Correction factor")
    const corrected = round(na + factor * ((glucose - 100) / 100), 1)
    return { value: corrected, unit: "mmol/L", display: `Corrected sodium: ${corrected} mmol/L`, calculationSteps: [`${na} + ${factor} × ((${glucose} − 100) ÷ 100) = ${corrected}`], warnings: ["Published sodium correction factors differ; this is an estimate. Use the method specified by the clinical/laboratory protocol."] }
  },
  notes: ["The correction factor is explicitly user-selected because published conventions vary."]
}

export const correctedBunCalculator: CalculatorDefinition = {
  id: "bun-from-urea",
  name: "Urea ↔ BUN Conversion",
  shortName: "Urea/BUN",
  category: "chemistry",
  description: "Converts blood urea nitrogen and urea between common reporting units.",
  inputs: [
    { id: "direction", label: "Direction", kind: "select", options: [{ value: "urea-to-bun", label: "Urea mmol/L  to  BUN mg/dL" }, { value: "bun-to-urea", label: "BUN mg/dL  to  Urea mmol/L" }], defaultValue: "urea-to-bun" },
    { id: "value", label: "Value", kind: "number", min: 0, step: 0.1, defaultValue: 10 },
  ],
  calculate: (inputs) => {
    const v = num(inputs, "value"); assertNonNegative(v, "Value")
    if (inputs.direction === "urea-to-bun") {
      const bun = round(v * 2.8, 1)
      return { value: bun, unit: "mg/dL", display: `BUN: ${bun} mg/dL`, calculationSteps: [`${v} × 2.8 = ${bun} mg/dL`] }
    }
    const urea = round(v / 2.8, 1)
    return { value: urea, unit: "mmol/L", display: `Urea: ${urea} mmol/L`, calculationSteps: [`${v} ÷ 2.8 = ${urea} mmol/L`] }
  },
  notes: ["Approximate conversion factor: BUN mg/dL ≈ urea mmol/L × 2.8. Laboratory reporting conventions should be confirmed."]
}

export const correctedAlbuminAnionGapCalculator: CalculatorDefinition = {
  id: "albumin-corrected-anion-gap",
  name: "Albumin-Corrected Anion Gap",
  shortName: "Corrected AG",
  category: "chemistry",
  description: "Corrects the calculated anion gap for an albumin concentration below the reference value.",
  formula: "Corrected AG = AG + 2.5 × (4.0 − albumin[g/dL])",
  inputs: [
    { id: "sodium", label: "Sodium", kind: "number", unit: "mmol/L", min: 1, max: 250, step: 0.1, defaultValue: 140 },
    { id: "chloride", label: "Chloride", kind: "number", unit: "mmol/L", min: 1, max: 250, step: 0.1, defaultValue: 100 },
    { id: "bicarbonate", label: "Bicarbonate", kind: "number", unit: "mmol/L", min: 1, max: 100, step: 0.1, defaultValue: 24 },
    { id: "albumin", label: "Albumin", kind: "number", unit: "g/dL", min: 0.1, max: 10, step: 0.1, defaultValue: 4 },
  ],
  calculate: (inputs) => {
    const na = num(inputs, "sodium"), cl = num(inputs, "chloride"), hco3 = num(inputs, "bicarbonate"), albumin = num(inputs, "albumin")
    assertPositive(na, "Sodium"); assertPositive(cl, "Chloride"); assertPositive(hco3, "Bicarbonate"); assertPositive(albumin, "Albumin")
    const ag = na - cl - hco3
    const corrected = round(ag + 2.5 * (4 - albumin), 1)
    return { value: corrected, unit: "mmol/L", display: `Albumin-corrected AG: ${corrected} mmol/L`, secondary: [{ label: "Measured anion gap", value: `${round(ag,1)} mmol/L` }], calculationSteps: [`AG = ${na} − ${cl} − ${hco3} = ${round(ag,1)}`, `Corrected AG = ${round(ag,1)} + 2.5 × (4 − ${albumin}) = ${corrected}`], warnings: ["Correction coefficients and reference albumin vary among sources; use the convention validated by your laboratory or clinical service."] }
  }
}

export const creatinineUnitConversionCalculator: CalculatorDefinition = {
  id: "creatinine-unit-conversion",
  name: "Creatinine Unit Conversion",
  shortName: "Creatinine",
  category: "chemistry",
  description: "Converts serum creatinine between mg/dL and µmol/L.",
  inputs: [
    { id: "direction", label: "Direction", kind: "select", options: [{ value: "mgdl-to-umol", label: "mg/dL  to  µmol/L" }, { value: "umol-to-mgdl", label: "µmol/L  to  mg/dL" }], defaultValue: "mgdl-to-umol" },
    { id: "value", label: "Creatinine", kind: "number", min: 0, step: 0.01, defaultValue: 1 },
  ],
  calculate: (inputs) => {
    const v = num(inputs, "value"); assertNonNegative(v, "Creatinine")
    if (inputs.direction === "mgdl-to-umol") {
      const out = round(v * 88.4, 1)
      return { value: out, unit: "µmol/L", display: `Creatinine: ${out} µmol/L`, calculationSteps: [`${v} × 88.4 = ${out} µmol/L`] }
    }
    const out = round(v / 88.4, 2)
    return { value: out, unit: "mg/dL", display: `Creatinine: ${out} mg/dL`, calculationSteps: [`${v} ÷ 88.4 = ${out} mg/dL`] }
  },
  notes: ["Conversion uses 1 mg/dL creatinine ≈ 88.4 µmol/L."]
}
