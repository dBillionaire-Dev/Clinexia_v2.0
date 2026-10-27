import type { CalculatorDefinition } from "../types"
import { num, str, assertPositive, round, fmt } from "../helpers"

const yesNo = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
]

export const meanArterialPressureCalculator: CalculatorDefinition = {
  id: "mean-arterial-pressure",
  name: "Mean Arterial Pressure",
  shortName: "MAP",
  category: "cardiovascular",
  subcategory: "hypertension",
  description: "Estimates mean arterial pressure from systolic and diastolic blood pressure.",
  formula: "MAP ≈ (SBP + 2 × DBP) ÷ 3",
  inputs: [
    { id: "sbp", label: "Systolic BP", kind: "number", unit: "mmHg", min: 1, max: 400, step: 1, defaultValue: 120 },
    { id: "dbp", label: "Diastolic BP", kind: "number", unit: "mmHg", min: 1, max: 300, step: 1, defaultValue: 80 },
  ],
  calculate: (inputs) => {
    const sbp = num(inputs, "sbp"), dbp = num(inputs, "dbp")
    assertPositive(sbp, "Systolic BP"); assertPositive(dbp, "Diastolic BP")
    if (dbp >= sbp) throw new Error("Diastolic BP should be lower than systolic BP.")
    const map = round((sbp + 2 * dbp) / 3, 1)
    return { value: map, unit: "mmHg", display: fmt(map, 1, "mmHg"), calculationSteps: [`(${sbp} + 2 × ${dbp}) ÷ 3 = ${map} mmHg`] }
  },
  notes: ["This is an arithmetic estimate; arterial waveform and clinical context can affect actual mean pressure."]
}

export const ejectionFractionCalculator: CalculatorDefinition = {
  id: "ejection-fraction",
  name: "Left Ventricular Ejection Fraction",
  shortName: "LVEF",
  category: "cardiovascular",
  subcategory: "heart-failure",
  description: "Calculates ejection fraction from end-diastolic and end-systolic ventricular volumes.",
  formula: "EF (%) = (EDV − ESV) ÷ EDV × 100",
  inputs: [
    { id: "edv", label: "End-diastolic volume", kind: "number", unit: "mL", min: 0.1, step: 1 },
    { id: "esv", label: "End-systolic volume", kind: "number", unit: "mL", min: 0, step: 1 },
  ],
  calculate: (inputs) => {
    const edv = num(inputs, "edv"), esv = num(inputs, "esv")
    assertPositive(edv, "End-diastolic volume")
    if (esv < 0 || esv > edv) throw new Error("End-systolic volume must be between 0 and EDV.")
    const ef = round(((edv - esv) / edv) * 100, 1)
    return { value: ef, unit: "%", display: fmt(ef, 1, "%"), calculationSteps: [`(${edv} − ${esv}) ÷ ${edv} × 100 = ${ef}%`] }
  },
  notes: ["Interpret ejection fraction using the imaging method, laboratory/echo context, and applicable guideline definitions."]
}

export const cha2ds2VascCalculator: CalculatorDefinition = {
  id: "cha2ds2-vasc",
  name: "CHA₂DS₂-VASc Score",
  shortName: "CHA₂DS₂-VASc",
  category: "cardiovascular",
  subcategory: "anticoagulation",
  description: "Calculates the CHA₂DS₂-VASc thromboembolic risk score for atrial fibrillation/flutter risk assessment.",
  inputs: [
    { id: "chf", label: "Heart failure / LV dysfunction", kind: "select", options: yesNo },
    { id: "hypertension", label: "Hypertension", kind: "select", options: yesNo },
    { id: "age", label: "Age", kind: "number", unit: "years", min: 18, max: 120, step: 1 },
    { id: "diabetes", label: "Diabetes", kind: "select", options: yesNo },
    { id: "stroke", label: "Prior stroke / TIA / systemic embolism", kind: "select", options: yesNo },
    { id: "vascular", label: "Vascular disease", kind: "select", options: yesNo },
    { id: "sex", label: "Sex", kind: "select", options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }] },
  ],
  calculate: (inputs) => {
    const age = num(inputs, "age")
    const score = (str(inputs,"chf") === "yes" ? 1 : 0) + (str(inputs,"hypertension") === "yes" ? 1 : 0) + (age >= 75 ? 2 : age >= 65 ? 1 : 0) + (str(inputs,"diabetes") === "yes" ? 1 : 0) + (str(inputs,"stroke") === "yes" ? 2 : 0) + (str(inputs,"vascular") === "yes" ? 1 : 0) + (str(inputs,"sex") === "female" ? 1 : 0)
    return { value: score, display: `CHA₂DS₂-VASc: ${score}`, interpretation: "Risk score only; current AF guidelines use validated risk assessment together with clinical context and shared decision-making.", calculationSteps: ["C = 1, H = 1, A₂ = age ≥75 (2), D = 1, S₂ = prior stroke/TIA/systemic embolism (2), V = 1, A = age 65–74 (1), Sc = female sex (1)."] }
  },
  notes: ["The 2023 ACC/AHA/ACCP/HRS AF guideline continues to use validated clinical risk scores such as CHA₂DS₂-VASc to assess thromboembolic risk."]
}

export const daptScoreCalculator: CalculatorDefinition = {
  id: "dapt-score",
  name: "DAPT Score",
  shortName: "DAPT Score",
  category: "cardiovascular",
  subcategory: "antiplatelet",
  description: "Calculates the Dual Antiplatelet Therapy score from the documented clinical and PCI factors used in the original score.",
  inputs: [
    { id: "age", label: "Age", kind: "number", unit: "years", min: 18, max: 120, step: 1 },
    { id: "smoker", label: "Current cigarette smoker", kind: "select", options: yesNo },
    { id: "diabetes", label: "Diabetes mellitus", kind: "select", options: yesNo },
    { id: "miPresentation", label: "MI at presentation", kind: "select", options: yesNo },
    { id: "priorPciMi", label: "Prior PCI or prior MI", kind: "select", options: yesNo },
    { id: "smallStent", label: "Stent diameter <3 mm", kind: "select", options: yesNo },
    { id: "paclitaxelStent", label: "Paclitaxel-eluting stent", kind: "select", options: yesNo },
    { id: "chfLowEf", label: "CHF or LVEF <30%", kind: "select", options: yesNo },
    { id: "veinGraft", label: "Saphenous vein graft PCI", kind: "select", options: yesNo },
  ],
  calculate: (inputs) => {
    const age = num(inputs, "age")
    const score = (age >= 75 ? -2 : age >= 65 ? -1 : 0) + (str(inputs,"smoker") === "yes" ? 1 : 0) + (str(inputs,"diabetes") === "yes" ? 1 : 0) + (str(inputs,"miPresentation") === "yes" ? 1 : 0) + (str(inputs,"priorPciMi") === "yes" ? 1 : 0) + (str(inputs,"smallStent") === "yes" ? 1 : 0) + (str(inputs,"paclitaxelStent") === "yes" ? 1 : 0) + (str(inputs,"chfLowEf") === "yes" ? 2 : 0) + (str(inputs,"veinGraft") === "yes" ? 2 : 0)
    return { value: score, display: `DAPT score: ${score}`, interpretation: "Use the score only in the population and timing for which the DAPT score was validated; do not use it alone to prescribe or extend antiplatelet therapy.", calculationSteps: ["Age: ≥75 = −2; 65–74 = −1; <65 = 0.", "Smoking, diabetes, MI at presentation, prior PCI/MI, stent <3 mm and paclitaxel-eluting stent each add 1 point; CHF/LVEF <30% adds 2; vein-graft PCI adds 2."] }
  },
  notes: ["The ACC/AHA DAPT focused update documents these component weights and cautions that the score is intended to inform duration decisions in appropriate post-PCI patients."]
}

export const qtcCalculator: CalculatorDefinition = {
  id: "qtc-correction",
  name: "QTc Correction",
  shortName: "QTc",
  category: "cardiovascular",
  subcategory: "arrhythmia",
  description: "Calculates corrected QT using Bazett and Fridericia methods from QT interval and heart rate.",
  inputs: [
    { id: "qt", label: "QT interval", kind: "number", unit: "ms", min: 1, step: 1 },
    { id: "heartRate", label: "Heart rate", kind: "number", unit: "bpm", min: 1, max: 300, step: 1 },
  ],
  calculate: (inputs) => {
    const qt = num(inputs,"qt"), hr = num(inputs,"heartRate")
    assertPositive(qt,"QT interval"); assertPositive(hr,"Heart rate")
    const rr = 60 / hr
    const qts = qt / 1000
    const bazett = round((qts / Math.sqrt(rr)) * 1000, 0)
    const fridericia = round((qts / Math.cbrt(rr)) * 1000, 0)
    return { value: bazett, unit: "ms", display: `QTc Bazett: ${bazett} ms`, secondary: [{label:"QTc Fridericia", value:`${fridericia} ms`}], calculationSteps:[`RR = 60 ÷ ${hr} = ${round(rr,3)} s`, `Bazett: QTc = QT ÷ √RR = ${bazett} ms`, `Fridericia: QTc = QT ÷ RR^(1/3) = ${fridericia} ms`], warnings:["QTc interpretation depends on ECG quality, heart rate, measurement method, medications, electrolytes and clinical context."] }
  },
  notes: ["Bazett and Fridericia are correction formulas; the result is not a diagnosis of long-QT syndrome or an indication to change medication by itself."]
}

export const atherogenicIndexCalculator: CalculatorDefinition = {
  id: "atherogenic-index-plasma",
  name: "Atherogenic Index of Plasma",
  shortName: "AIP",
  category: "cardiovascular",
  subcategory: "risk-prevention",
  description: "Calculates the logarithm of the triglyceride-to-HDL cholesterol ratio using mmol/L inputs.",
  formula: "AIP = log10(TG / HDL-C)",
  inputs: [
    { id: "triglycerides", label: "Triglycerides", kind: "number", unit: "mmol/L", min: 0.001, step: 0.01 },
    { id: "hdl", label: "HDL cholesterol", kind: "number", unit: "mmol/L", min: 0.001, step: 0.01 },
  ],
  calculate: (inputs) => {
    const tg = num(inputs,"triglycerides"), hdl = num(inputs,"hdl")
    assertPositive(tg,"Triglycerides"); assertPositive(hdl,"HDL cholesterol")
    const aip = round(Math.log10(tg / hdl), 3)
    return { value:aip, display:`AIP: ${aip}`, interpretation:"AIP is a calculated lipid-derived marker. Published cut-points vary by population and assay context; interpret with the complete cardiovascular risk profile rather than as a stand-alone treatment trigger.", calculationSteps:[`log10(${tg} ÷ ${hdl}) = ${aip}`] }
  },
  notes:["Use mmol/L for both triglyceride and HDL inputs; do not mix units."]
}


export const pulsePressureCalculator: CalculatorDefinition = {
  id: "pulse-pressure",
  name: "Pulse Pressure",
  shortName: "PP",
  category: "cardiovascular",
  subcategory: "hypertension",
  description: "Calculates pulse pressure from systolic and diastolic blood pressure.",
  formula: "Pulse pressure = SBP − DBP",
  inputs: [
    { id: "sbp", label: "Systolic BP", kind: "number", unit: "mmHg", min: 1, max: 400, step: 1, defaultValue: 120 },
    { id: "dbp", label: "Diastolic BP", kind: "number", unit: "mmHg", min: 1, max: 300, step: 1, defaultValue: 80 },
  ],
  calculate: (inputs) => {
    const s = num(inputs, "sbp"), d = num(inputs, "dbp")
    assertPositive(s, "Systolic BP"); assertPositive(d, "Diastolic BP")
    if (d >= s) throw new Error("Diastolic BP should be lower than systolic BP for this calculation.")
    const pp = round(s - d, 0)
    return { value: pp, unit: "mmHg", display: `Pulse pressure: ${pp} mmHg`, calculationSteps: [`${s} − ${d} = ${pp} mmHg`], warnings: ["Pulse pressure is a descriptive hemodynamic measure and is not, by itself, a diagnosis or treatment target."] }
  }
}

export const cardiacIndexCalculator: CalculatorDefinition = {
  id: "cardiac-index",
  name: "Cardiac Index",
  shortName: "CI",
  category: "cardiovascular",
  subcategory: "heart-failure",
  description: "Calculates cardiac index from cardiac output and body surface area.",
  formula: "Cardiac index = cardiac output ÷ BSA",
  inputs: [
    { id: "cardiacOutput", label: "Cardiac output", kind: "number", unit: "L/min", min: 0.1, step: 0.1, defaultValue: 5 },
    { id: "bsa", label: "Body surface area", kind: "number", unit: "m²", min: 0.1, max: 5, step: 0.01, defaultValue: 1.8 },
  ],
  calculate: (inputs) => {
    const co = num(inputs, "cardiacOutput"), bsa = num(inputs, "bsa")
    assertPositive(co, "Cardiac output"); assertPositive(bsa, "BSA")
    const ci = round(co / bsa, 2)
    return { value: ci, unit: "L/min/m²", display: `Cardiac index: ${ci} L/min/m²`, calculationSteps: [`${co} ÷ ${bsa} = ${ci} L/min/m²`], warnings: ["Interpret cardiac index with the measurement method, hemodynamic state and clinical context; normal ranges vary by source and setting."] }
  },
  relatedTools: ["bsa", "ejection-fraction"],
  notes: ["Cardiac index normalizes measured cardiac output to body surface area."]
}

export const hasBledCalculator: CalculatorDefinition = {
  id: "has-bled",
  name: "HAS-BLED Bleeding Risk Score",
  shortName: "HAS-BLED",
  category: "cardiovascular",
  subcategory: "anticoagulation",
  description: "Calculates the HAS-BLED score from its documented bleeding-risk factors.",
  inputs: [
    { id: "hypertension", label: "Uncontrolled hypertension (systolic >160 mmHg)", kind: "select", options: yesNo, defaultValue: "no" },
    { id: "renal", label: "Abnormal renal function", kind: "select", options: yesNo, defaultValue: "no" },
    { id: "liver", label: "Abnormal liver function", kind: "select", options: yesNo, defaultValue: "no" },
    { id: "stroke", label: "Previous stroke", kind: "select", options: yesNo, defaultValue: "no" },
    { id: "bleeding", label: "Prior major bleeding / bleeding predisposition", kind: "select", options: yesNo, defaultValue: "no" },
    { id: "labileInr", label: "Labile INR", kind: "select", options: yesNo, defaultValue: "no" },
    { id: "age", label: "Age >65 years", kind: "select", options: yesNo, defaultValue: "no" },
    { id: "drugs", label: "Drugs predisposing to bleeding", kind: "select", options: yesNo, defaultValue: "no" },
    { id: "alcohol", label: "Excess alcohol use", kind: "select", options: yesNo, defaultValue: "no" },
  ],
  calculate: (inputs) => {
    const score = ["hypertension","renal","liver","stroke","bleeding","labileInr","age","drugs","alcohol"].reduce((s, k) => s + (inputs[k] === "yes" ? 1 : 0), 0)
    return { value: score, display: `HAS-BLED score: ${score}`, interpretation: "A bleeding-risk assessment tool used in anticoagulation contexts. A higher score identifies potentially modifiable bleeding-risk factors; it should not be used alone to withhold indicated anticoagulation.", calculationSteps: ["One point is assigned for each selected HAS-BLED factor in this implementation."] }
  },
  notes: ["The original HAS-BLED acronym includes abnormal renal/liver function and drugs/alcohol components; definitions should follow the validated scoring framework."]
}

export const atrialFibrillationRateCalculator: CalculatorDefinition = {
  id: "af-ventricular-rate",
  name: "Atrial Fibrillation Ventricular Rate",
  shortName: "AF Rate",
  category: "cardiovascular",
  subcategory: "arrhythmia",
  description: "Estimates ventricular rate from an ECG strip using the number of QRS complexes and strip duration.",
  formula: "Rate (bpm) = QRS count × 60 ÷ strip duration (seconds)",
  inputs: [
    { id: "qrsCount", label: "QRS complexes counted", kind: "number", min: 1, max: 100, step: 1, defaultValue: 10 },
    { id: "durationSeconds", label: "Strip duration", kind: "number", unit: "seconds", min: 1, max: 60, step: 0.1, defaultValue: 10 },
  ],
  calculate: (inputs) => {
    const q = num(inputs, "qrsCount"), t = num(inputs, "durationSeconds")
    assertPositive(q, "QRS count"); assertPositive(t, "Strip duration")
    const rate = round(q * 60 / t, 0)
    return { value: rate, unit: "bpm", display: `Estimated ventricular rate: ${rate} bpm`, calculationSteps: [`${q} × 60 ÷ ${t} = ${rate} bpm`], warnings: ["This is a rate calculation only; rhythm diagnosis requires ECG interpretation."] }
  }
}
