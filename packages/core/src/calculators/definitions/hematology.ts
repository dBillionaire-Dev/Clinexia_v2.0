import type { CalculatorDefinition } from "../types"
import { num, str, assertPositive, assertNonNegative, safeDivide, round, fmt } from "../helpers"

export const redCellIndicesCalculator: CalculatorDefinition = {
  id: "red-cell-indices",
  name: "Red Cell Indices",
  shortName: "RBC Indices",
  category: "hematology",
  subcategory: "anemia",
  description:
    "Calculates MCV, MCH, and MCHC from hemoglobin, hematocrit, and RBC count.",
  formula:
    "MCV = (Hct × 10) / RBC; MCH = (Hgb × 10) / RBC; MCHC = (Hgb / Hct) × 100",
  keywords: [
    "red cell indices",
    "rbc indices",
    "mcv",
    "mch",
    "mchc",
    "mean corpuscular volume",
    "mean corpuscular hemoglobin",
    "mean corpuscular hemoglobin concentration",
  ],
  relatedTools: ["absolute-cell-count", "hematocrit-estimate"],
  inputs: [
    {
      id: "hgb",
      label: "Hemoglobin",
      kind: "number",
      unit: "g/dL",
      min: 0,
      step: 0.1,
      defaultValue: 14,
    },
    {
      id: "hct",
      label: "Hematocrit",
      kind: "number",
      unit: "%",
      min: 0,
      step: 0.1,
      defaultValue: 42,
    },
    {
      id: "rbc",
      label: "RBC Count",
      kind: "number",
      unit: "10¹²/L",
      min: 0,
      step: 0.01,
      defaultValue: 4.8,
    },
  ],
  calculate: (inputs) => {
    const hgb = num(inputs, "hgb")
    const hct = num(inputs, "hct")
    const rbc = num(inputs, "rbc")

    assertPositive(rbc, "RBC count")
    assertPositive(hct, "Hematocrit")

    const mcv = round(safeDivide(hct * 10, rbc, "RBC count"), 1)
    const mch = round(safeDivide(hgb * 10, rbc, "RBC count"), 1)
    const mchc = round(safeDivide(hgb, hct, "Hematocrit") * 100, 1)

    return {
      value: mcv,
      unit: "fL",
      display: `MCV: ${fmt(mcv, 1, "fL")}`,
      secondary: [
        {
          label: "MCH",
          value: fmt(mch, 1, "pg"),
        },
        {
          label: "MCHC",
          value: fmt(mchc, 1, "g/dL"),
        },
      ],
      calculationSteps: [
        `MCV = (${hct} x 10) / ${rbc}`,
        `MCH = (${hgb} x 10) / ${rbc}`,
        `MCHC = (${hgb} / ${hct}) x 100`,
      ],
      warnings:
        mchc > 38
          ? [
              "MCHC above ~36-38 g/dL is physiologically unusual and may indicate a specimen or analyzer artifact.",
            ]
          : undefined,
    }
  },
  notes: [
    "MCV, MCH, and MCHC are commonly interpreted together as red cell indices.",
    "Reference intervals vary by laboratory, age, and clinical context.",
  ],
}

export const mcvCalculator: CalculatorDefinition = {
  id: "mcv",
  name: "Mean Corpuscular Volume",
  shortName: "MCV",
  category: "hematology",
  subcategory: "anemia",
  description: "Calculates mean corpuscular volume from hematocrit and RBC count.",
  formula: "MCV (fL) = (Hct[%] x 10) / RBC(10¹²/L)",
  keywords: ["mcv", "mean corpuscular volume", "red cell indices"],
  relatedTools: ["mch", "mchc"],
  inputs: [
    { id: "hct", label: "Hematocrit", kind: "number", unit: "%", min: 0, step: 0.1, defaultValue: 42 },
    { id: "rbc", label: "RBC Count", kind: "number", unit: "10¹²/L", min: 0, step: 0.01, defaultValue: 4.8 },
  ],
  calculate: (inputs) => {
    const hct = num(inputs, "hct")
    const rbc = num(inputs, "rbc")
    assertPositive(rbc, "RBC count")
    const mcv = safeDivide(hct * 10, rbc, "RBC count")
    const rounded = round(mcv, 1)
    return {
      value: rounded,
      unit: "fL",
      display: fmt(rounded, 1, "fL"),
      calculationSteps: [`(${hct} x 10) / ${rbc}`],
    }
  },
}

export const mchCalculator: CalculatorDefinition = {
  id: "mch",
  name: "Mean Corpuscular Hemoglobin",
  shortName: "MCH",
  category: "hematology",
  subcategory: "anemia",
  description: "Calculates mean corpuscular hemoglobin from hemoglobin and RBC count.",
  formula: "MCH (pg) = (Hgb[g/dL] x 10) / RBC(10¹²/L)",
  keywords: ["mch", "mean corpuscular hemoglobin", "red cell indices"],
  relatedTools: ["mcv", "mchc"],
  inputs: [
    { id: "hgb", label: "Hemoglobin", kind: "number", unit: "g/dL", min: 0, step: 0.1, defaultValue: 14 },
    { id: "rbc", label: "RBC Count", kind: "number", unit: "10¹²/L", min: 0, step: 0.01, defaultValue: 4.8 },
  ],
  calculate: (inputs) => {
    const hgb = num(inputs, "hgb")
    const rbc = num(inputs, "rbc")
    assertPositive(rbc, "RBC count")
    const mch = safeDivide(hgb * 10, rbc, "RBC count")
    const rounded = round(mch, 1)
    return {
      value: rounded,
      unit: "pg",
      display: fmt(rounded, 1, "pg"),
      calculationSteps: [`(${hgb} x 10) / ${rbc}`],
    }
  },
}

export const mchcCalculator: CalculatorDefinition = {
  id: "mchc",
  name: "Mean Corpuscular Hemoglobin Concentration",
  shortName: "MCHC",
  category: "hematology",
  subcategory: "anemia",
  description: "Calculates mean corpuscular hemoglobin concentration from hemoglobin and hematocrit.",
  formula: "MCHC (g/dL) = (Hgb[g/dL] / Hct[%]) x 100",
  keywords: ["mchc", "hemoglobin concentration", "red cell indices"],
  relatedTools: ["mcv", "mch"],
  inputs: [
    { id: "hgb", label: "Hemoglobin", kind: "number", unit: "g/dL", min: 0, step: 0.1, defaultValue: 14 },
    { id: "hct", label: "Hematocrit", kind: "number", unit: "%", min: 0, step: 0.1, defaultValue: 42 },
  ],
  calculate: (inputs) => {
    const hgb = num(inputs, "hgb")
    const hct = num(inputs, "hct")
    assertPositive(hct, "Hematocrit")
    const mchc = safeDivide(hgb, hct, "Hematocrit") * 100
    const rounded = round(mchc, 1)
    return {
      value: rounded,
      unit: "g/dL",
      display: fmt(rounded, 1, "g/dL"),
      calculationSteps: [`(${hgb} / ${hct}) x 100`],
      warnings: mchc > 38 ? ["Result above ~36-38 g/dL is physiologically unusual and may indicate a specimen or analyzer artifact."] : undefined,
    }
  },
}

const CELL_TYPES = [
  { value: "neutrophil", label: "Neutrophils (ANC)" },
  { value: "lymphocyte", label: "Lymphocytes (ALC)" },
  { value: "eosinophil", label: "Eosinophils (AEC)" },
  { value: "monocyte", label: "Monocytes (AMC)" },
]

export const absoluteCellCountCalculator: CalculatorDefinition = {
  id: "absolute-cell-count",
  name: "Absolute Cell Count",
  shortName: "Abs. Count",
  category: "hematology",
  subcategory: "anemia",
  description: "Calculates an absolute white cell count (e.g. ANC, ALC) from total WBC and differential percentage.",
  formula: "Absolute count = WBC(x10⁹/L) x (differential % / 100)",
  keywords: ["anc", "absolute neutrophil count", "alc", "aec", "amc", "differential"],
  relatedTools: ["red-cell-indices", "corrected-wbc"],
  inputs: [
    {
      id: "cellType",
      label: "Cell type",
      kind: "select",
      options: CELL_TYPES,
      defaultValue: "neutrophil",
    },
    { id: "wbc", label: "Total WBC", kind: "number", unit: "x10⁹/L", min: 0, step: 0.01, defaultValue: 7.5 },
    { id: "percent", label: "Differential %", kind: "number", unit: "%", min: 0, max: 100, step: 0.1, defaultValue: 60 },
  ],
  calculate: (inputs) => {
    const cellType = str(inputs, "cellType")
    const wbc = num(inputs, "wbc")
    const percent = num(inputs, "percent")
    assertPositive(wbc, "WBC")
    if (percent < 0 || percent > 100) throw new Error("Differential percentage must be between 0 and 100")

    const absoluteK = wbc * (percent / 100)
    const rounded = round(absoluteK, 2)
    const label = CELL_TYPES.find((c) => c.value === cellType)?.label ?? "Absolute count"

    let interpretation: string | undefined
    if (cellType === "neutrophil") {
      if (absoluteK < 0.5) interpretation = "Severe neutropenia range (<0.5 ×10⁹/L)."
      else if (absoluteK < 1.0) interpretation = "Moderate neutropenia range (0.5-1.0 ×10⁹/L)."
      else if (absoluteK < 1.5) interpretation = "Mild neutropenia range (1.0-1.5 ×10⁹/L)."
    }

    return {
      value: rounded,
      unit: "x10⁹/L",
      display: fmt(rounded, 2, "x10⁹/L"),
      secondary: [{ label: "In cells/µL", value: fmt(round(absoluteK, 0), 0, "cells/µL") }],
      calculationSteps: [`${wbc} x (${percent} / 100)`],
      interpretation: interpretation ? `${label}: ${interpretation}` : undefined,
    }
  },
  notes: ["Reference ranges vary by age, laboratory, and analyzer; interpret against your local reference interval."],
}

export const correctedWbcCalculator: CalculatorDefinition = {
  id: "corrected-wbc",
  name: "Corrected WBC Count",
  shortName: "Corr. WBC",
  category: "hematology",
  subcategory: "anemia",
  description: "Corrects the total WBC count for the presence of nucleated red blood cells (nRBCs).",
  formula: "Corrected WBC = (Uncorrected WBC x 100) / (100 + nRBC per 100 WBC)",
  keywords: ["corrected wbc", "nucleated red blood cells", "nrbc"],
  relatedTools: ["absolute-cell-count"],
  inputs: [
    { id: "wbc", label: "Uncorrected WBC", kind: "number", unit: "x10⁹/L", min: 0, step: 0.01, defaultValue: 15 },
    { id: "nrbc", label: "nRBC per 100 WBC", kind: "number", min: 0, step: 1, defaultValue: 10 },
  ],
  calculate: (inputs) => {
    const wbc = num(inputs, "wbc")
    const nrbc = num(inputs, "nrbc")
    assertPositive(wbc, "Uncorrected WBC")
    if (nrbc < 0) throw new Error("nRBC count cannot be negative")

    const corrected = (wbc * 100) / (100 + nrbc)
    const rounded = round(corrected, 2)

    return {
      value: rounded,
      unit: "x10⁹/L",
      display: fmt(rounded, 2, "x10⁹/L"),
      calculationSteps: [`(${wbc} x 100) / (100 + ${nrbc})`],
      warnings: nrbc === 0 ? ["No correction needed when nRBC count is zero. Corrected value equals the uncorrected count."] : undefined,
    }
  },
  notes: ["Automated analyzers count nucleated RBCs as WBCs; this correction removes that overestimate when a manual differential reports nRBCs."],
}

export const hematocritEstimateCalculator: CalculatorDefinition = {
  id: "hematocrit-estimate",
  name: "Hematocrit Estimation",
  shortName: "Est. Hct",
  category: "hematology",
  subcategory: "anemia",
  description: "Estimates hematocrit from hemoglobin using the commonly cited 'rule of three'.",
  isEstimator: true,
  formula: "Hct (%) ≈ Hgb (g/dL) x 3",
  keywords: ["hematocrit estimation", "rule of three", "hgb hct relationship"],
  relatedTools: ["red-cell-indices"],
  inputs: [{ id: "hgb", label: "Hemoglobin", kind: "number", unit: "g/dL", min: 0, step: 0.1, defaultValue: 14 }],
  calculate: (inputs) => {
    const hgb = num(inputs, "hgb")
    assertPositive(hgb, "Hemoglobin")

    const hct = hgb * 3
    const rounded = round(hct, 1)

    return {
      value: rounded,
      unit: "%",
      display: fmt(rounded, 1, "%"),
      calculationSteps: [`${hgb} x 3`],
      warnings: ["This is a rough approximation, actual Hgb:Hct ratio varies with red cell size (MCV) and shape; a measured hematocrit should be used whenever available."],
    }
  },
  notes: ["The 'rule of three' (Hct ≈ 3 x Hgb) is a bedside approximation, not a substitute for a measured hematocrit."],
  limitations: ["Less accurate with abnormal MCV (microcytosis/macrocytosis) or abnormal red cell morphology."],
}

export const inrCalculator: CalculatorDefinition = {
  id: "inr",
  name: "International Normalized Ratio",
  shortName: "INR",
  category: "hematology",
  subcategory: "coagulation",
  description: "Calculates INR from prothrombin time, laboratory mean normal PT, and the reagent ISI.",
  formula: "INR = (PT / mean normal PT)^ISI",
  inputs: [
    { id: "pt", label: "Patient PT", kind: "number", unit: "seconds", min: 0.1, step: 0.1 },
    { id: "meanNormalPt", label: "Mean normal PT", kind: "number", unit: "seconds", min: 0.1, step: 0.1 },
    { id: "isi", label: "ISI", kind: "number", min: 0.1, max: 5, step: 0.01 },
  ],
  calculate: (inputs) => {
    const pt = num(inputs, "pt"), mean = num(inputs, "meanNormalPt"), isi = num(inputs, "isi")
    assertPositive(pt, "Patient PT"); assertPositive(mean, "Mean normal PT"); assertPositive(isi, "ISI")
    const inr = round(Math.pow(pt / mean, isi), 2)
    return { value: inr, display: `INR: ${inr}`, calculationSteps: [`(${pt} ÷ ${mean})^${isi} = ${inr}`], warnings: ["Use the laboratory's validated mean normal PT and reagent-specific ISI. Do not substitute a generic PT reference interval."] }
  },
  notes: ["INR standardizes prothrombin-time results using the reagent ISI; interpretation depends on the clinical indication and anticoagulant context."]
}

export const correctedCountIncrementCalculator: CalculatorDefinition = {
  id: "corrected-count-increment",
  name: "Platelet Corrected Count Increment",
  shortName: "CCI",
  category: "hematology",
  subcategory: "transfusion",
  description: "Calculates platelet corrected count increment after transfusion using platelet increment, body surface area, and platelet dose.",
  formula: "CCI = platelet increment (/µL) × BSA (m²) ÷ platelet dose (×10¹¹)",
  inputs: [
    { id: "prePlatelet", label: "Pre-transfusion platelets", kind: "number", unit: "/µL", min: 0, step: 1000 },
    { id: "postPlatelet", label: "Post-transfusion platelets", kind: "number", unit: "/µL", min: 0, step: 1000 },
    { id: "bsa", label: "Body surface area", kind: "number", unit: "m²", min: 0.1, max: 5, step: 0.01 },
    { id: "plateletDose", label: "Platelet dose transfused", kind: "number", unit: "×10¹¹ platelets", min: 0.01, step: 0.01 },
  ],
  calculate: (inputs) => {
    const pre=num(inputs,"prePlatelet"), post=num(inputs,"postPlatelet"), bsa=num(inputs,"bsa"), dose=num(inputs,"plateletDose")
    if (pre<0 || post<0) throw new Error("Platelet counts cannot be negative.")
    assertPositive(bsa,"BSA"); assertPositive(dose,"Platelet dose")
    if (post < pre) throw new Error("Post-transfusion platelet count must not be lower than the pre-transfusion count for this increment calculation.")
    const increment=post-pre, cci=round(increment*bsa/dose,0)
    return { value:cci, unit:"platelets/µL", display:`CCI: ${cci.toLocaleString()} /µL`, secondary:[{label:"Platelet increment",value:`${increment.toLocaleString()} /µL`}], calculationSteps:[`${post.toLocaleString()} − ${pre.toLocaleString()} = ${increment.toLocaleString()} /µL increment`,`(${increment.toLocaleString()} × ${bsa}) ÷ ${dose} = ${cci.toLocaleString()} /µL`], warnings:["Timing after transfusion and the clinical definition being applied matter when assessing platelet refractoriness."] }
  },
  notes:["ASH describes CCI as platelet increment × BSA divided by the platelet dose; use the platelet product's documented dose rather than assuming a universal unit content."]
}

export const estimatedBloodVolumeCalculator: CalculatorDefinition = {
  id: "estimated-blood-volume",
  name: "Estimated Blood Volume",
  shortName: "EBV",
  category: "hematology",
  subcategory: "blood-products",
  description: "Estimates circulating blood volume from body weight using an explicitly selected adult estimate.",
  inputs:[
    {id:"weightKg",label:"Weight",kind:"number",unit:"kg",min:0.1,step:0.1},
    {id:"bloodVolumePerKg",label:"Blood volume factor",kind:"number",unit:"mL/kg",min:1, max:120,step:1,defaultValue:70,helpText:"Enter the factor specified by your validated method or local protocol."}
  ],
  calculate:(inputs)=>{const w=num(inputs,"weightKg"),f=num(inputs,"bloodVolumePerKg");assertPositive(w,"Weight");assertPositive(f,"Blood volume factor");const v=round(w*f,0);return {value:v,unit:"mL",display:fmt(v,0,"mL"),calculationSteps:[`${w} kg × ${f} mL/kg = ${v} mL`],warnings:["Blood-volume factors vary with age, sex, body composition and clinical setting. This tool intentionally uses the factor you provide rather than silently selecting one."]}}
}

export const internationalPrognosticIndexCalculator: CalculatorDefinition = {
  id: "international-prognostic-index",
  name: "International Prognostic Index",
  shortName: "IPI",
  category: "hematology",
  subcategory: "hematologic-malignancy",
  description: "Calculates the five-factor International Prognostic Index used in aggressive non-Hodgkin lymphoma risk assessment.",
  inputs:[
    {id:"age",label:"Age",kind:"number",unit:"years",min:0,max:120,step:1},
    {id:"stage34",label:"Ann Arbor stage III/IV",kind:"select",options:[{value:"no",label:"No"},{value:"yes",label:"Yes"}]},
    {id:"performance",label:"Performance status 2–4",kind:"select",options:[{value:"no",label:"No"},{value:"yes",label:"Yes"}]},
    {id:"ldh",label:"LDH relative to upper limit of normal",kind:"select",options:[{value:"normal",label:"Normal"},{value:"1to3",label:">1× to 3× ULN"},{value:"gt3",label:">3× ULN"}]},
    {id:"extranodal",label:"≥2 extranodal sites",kind:"select",options:[{value:"no",label:"No"},{value:"yes",label:"Yes"}]},
  ],
  calculate:(inputs)=>{const age=num(inputs,"age");const agePoints=age>=76?3:age>=61?2:age>=41?1:0;const score=agePoints+(inputs.stage34==="yes"?1:0)+(inputs.performance==="yes"?1:0)+(inputs.ldh==="normal"?0:inputs.ldh==="1to3"?1:2)+(inputs.extranodal==="yes"?1:0);return {value:score,display:`IPI score: ${score}`,secondary:[{label:"Age points",value:String(agePoints)}],interpretation:"The score is a prognostic classification tool for the population in which the selected IPI version applies; do not use it alone to determine treatment.",calculationSteps:["Age, stage III/IV, performance status, LDH elevation and ≥2 extranodal sites contribute to the score."]}}
}


export const reticulocyteProductionIndexCalculator: CalculatorDefinition = {
  id: "reticulocyte-production-index",
  name: "Reticulocyte Production Index",
  shortName: "RPI",
  category: "hematology",
  subcategory: "anemia",
  description: "Adjusts the reticulocyte percentage for the patient's hematocrit and an explicit maturation correction.",
  formula: "RPI = reticulocyte % × (patient Hct / reference Hct) ÷ maturation factor",
  inputs: [
    { id: "reticPercent", label: "Reticulocyte percentage", kind: "number", unit: "%", min: 0, max: 50, step: 0.1, defaultValue: 2 },
    { id: "hematocrit", label: "Patient hematocrit", kind: "number", unit: "%", min: 1, max: 80, step: 0.1, defaultValue: 45 },
    { id: "referenceHematocrit", label: "Reference hematocrit", kind: "number", unit: "%", min: 1, max: 80, step: 0.1, defaultValue: 45 },
    { id: "maturationFactor", label: "Maturation correction", kind: "number", min: 1, max: 4, step: 0.5, defaultValue: 1 },
  ],
  calculate: (inputs) => {
    const r = num(inputs, "reticPercent"), h = num(inputs, "hematocrit"), ref = num(inputs, "referenceHematocrit"), m = num(inputs, "maturationFactor")
    assertNonNegative(r, "Reticulocyte percentage"); assertPositive(h, "Hematocrit"); assertPositive(ref, "Reference hematocrit"); assertPositive(m, "Maturation correction")
    const rpi = round(r * (h / ref) / m, 2)
    return { value: rpi, display: `RPI: ${rpi}`, calculationSteps: [`${r} × (${h} ÷ ${ref}) ÷ ${m} = ${rpi}`], warnings: ["Maturation factors vary with anemia severity and local teaching convention; select the factor appropriate to the validated method."] }
  },
  notes: ["RPI is an adjusted reticulocyte measure used in anemia assessment; it should be interpreted with hemoglobin, morphology, iron studies and the clinical context."]
}

export const apttRatioCalculator: CalculatorDefinition = {
  id: "aptt-ratio",
  name: "aPTT Ratio",
  shortName: "aPTT Ratio",
  category: "hematology",
  subcategory: "coagulation",
  description: "Calculates the ratio of patient activated partial thromboplastin time to the laboratory control or mean normal aPTT.",
  formula: "aPTT ratio = patient aPTT ÷ control aPTT",
  inputs: [
    { id: "patientAptt", label: "Patient aPTT", kind: "number", unit: "seconds", min: 0.1, step: 0.1, defaultValue: 30 },
    { id: "controlAptt", label: "Laboratory control / mean normal aPTT", kind: "number", unit: "seconds", min: 0.1, step: 0.1, defaultValue: 30 },
  ],
  calculate: (inputs) => {
    const p = num(inputs, "patientAptt"), c = num(inputs, "controlAptt")
    assertPositive(p, "Patient aPTT"); assertPositive(c, "Control aPTT")
    const ratio = round(p / c, 2)
    return { value: ratio, display: `aPTT ratio: ${ratio}`, calculationSteps: [`${p} ÷ ${c} = ${ratio}`], warnings: ["Use the laboratory's validated control/mean-normal value and reagent-specific interpretation. aPTT ratio targets vary by assay and indication."] }
  },
  notes: ["For heparin monitoring, laboratories may use an aPTT therapeutic range or anti-Xa method rather than a universal ratio."]
}

export const estimatedRbcTransfusionVolumeCalculator: CalculatorDefinition = {
  id: "estimated-rbc-transfusion-volume",
  name: "Estimated RBC Transfusion Volume",
  shortName: "RBC Volume Estimate",
  category: "hematology",
  subcategory: "transfusion",
  description: "Estimates packed red-cell volume from an estimated blood volume, current and target hematocrit, and product hematocrit.",
  formula: "RBC volume ≈ EBV × (target Hct − current Hct) ÷ product Hct",
  inputs: [
    { id: "weightKg", label: "Weight", kind: "number", unit: "kg", min: 0.1, step: 0.1, defaultValue: 70 },
    { id: "bloodVolumePerKg", label: "Blood volume factor", kind: "number", unit: "mL/kg", min: 1, max: 120, step: 1, defaultValue: 70 },
    { id: "currentHct", label: "Current hematocrit", kind: "number", unit: "%", min: 1, max: 80, step: 0.1, defaultValue: 25 },
    { id: "targetHct", label: "Target hematocrit", kind: "number", unit: "%", min: 1, max: 80, step: 0.1, defaultValue: 30 },
    { id: "productHct", label: "RBC product hematocrit", kind: "number", unit: "%", min: 10, max: 90, step: 1, defaultValue: 60 },
  ],
  calculate: (inputs) => {
    const w = num(inputs, "weightKg"), factor = num(inputs, "bloodVolumePerKg")
    const current = num(inputs, "currentHct"), target = num(inputs, "targetHct"), product = num(inputs, "productHct")
    assertPositive(w, "Weight"); assertPositive(factor, "Blood volume factor"); assertPositive(current, "Current hematocrit"); assertPositive(target, "Target hematocrit"); assertPositive(product, "Product hematocrit")
    if (target <= current) throw new Error("Target hematocrit must be greater than current hematocrit for this estimate.")
    const ebv = w * factor
    const volume = round(ebv * ((target - current) / 100) / (product / 100), 0)
    return { value: volume, unit: "mL", display: `Estimated RBC volume: ${volume} mL`, secondary: [{ label: "Estimated blood volume", value: `${round(ebv,0)} mL` }], calculationSteps: [`EBV = ${w} × ${factor} = ${round(ebv,0)} mL`, `RBC volume ≈ ${round(ebv,0)} × ((${target} − ${current}) ÷ 100) ÷ (${product} ÷ 100) = ${volume} mL`], warnings: ["This is an approximation. Actual transfusion volume depends on component specifications, patient factors, target, urgency and local transfusion protocol."]}
  },
  notes: ["Use a validated blood-volume factor and actual component hematocrit when available."]
}

export const revisedInternationalPrognosticIndexCalculator: CalculatorDefinition = {
  id: "revised-international-prognostic-index",
  name: "Revised International Prognostic Index",
  shortName: "R-IPI",
  category: "hematology",
  subcategory: "hematologic-malignancy",
  description: "Calculates the five-factor revised IPI score using age, stage, LDH, performance status and extranodal disease.",
  inputs: [
    { id: "age", label: "Age", kind: "number", unit: "years", min: 0, max: 120, step: 1, defaultValue: 60 },
    { id: "stage34", label: "Ann Arbor stage III/IV", kind: "select", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }], defaultValue: "no" },
    { id: "performance", label: "Performance status ≥2", kind: "select", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }], defaultValue: "no" },
    { id: "ldh", label: "LDH above upper limit of normal", kind: "select", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }], defaultValue: "no" },
    { id: "extranodal", label: "≥2 extranodal sites", kind: "select", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }], defaultValue: "no" },
  ],
  calculate: (inputs) => {
    const age = num(inputs, "age")
    const score = (age > 60 ? 1 : 0) + (inputs.stage34 === "yes" ? 1 : 0) + (inputs.performance === "yes" ? 1 : 0) + (inputs.ldh === "yes" ? 1 : 0) + (inputs.extranodal === "yes" ? 1 : 0)
    const group = score <= 1 ? "Very good" : score === 2 ? "Good" : score === 3 ? "Poor" : "Very poor"
    return { value: score, display: `R-IPI score: ${score}`, secondary: [{ label: "Risk group", value: group }], interpretation: "A prognostic classification; the applicable disease population and treatment era should match the validated R-IPI framework. Do not use the score alone to determine treatment.", calculationSteps: ["One point is assigned for each adverse factor: age >60, stage III/IV, performance status ≥2, elevated LDH, and ≥2 extranodal sites."] }
  },
  notes: ["R-IPI is a prognostic tool derived for diffuse large B-cell lymphoma in the rituximab-era literature; applicability outside the validated population is limited."]
}
