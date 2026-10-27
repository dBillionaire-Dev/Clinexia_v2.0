import type { CalculatorDefinition } from "../types"
import { num, assertPositive, assertNonNegative, round, fmt } from "../helpers"

const yesNo = [{ value:"no", label:"No" }, { value:"yes", label:"Yes" }]

export const hctCiCalculator: CalculatorDefinition = {
  id:"hct-ci",
  name:"HCT-Specific Comorbidity Index",
  shortName:"HCT-CI",
  category:"stem-cell-transplant",
  subcategory:"hct",
  description:"Calculates the HCT-specific comorbidity index from the documented comorbidity definitions and age component.",
  inputs:[
    {id:"age40",label:"Age ≥40 years",kind:"select",options:yesNo},
    {id:"arrhythmia",label:"Arrhythmia",kind:"select",options:yesNo},
    {id:"cardiac",label:"Cardiac disease / MI / CHF / EF ≤50%",kind:"select",options:yesNo},
    {id:"ibd",label:"Inflammatory bowel disease",kind:"select",options:yesNo},
    {id:"diabetes",label:"Diabetes requiring medication",kind:"select",options:yesNo},
    {id:"cerebrovascular",label:"Cerebrovascular disease",kind:"select",options:yesNo},
    {id:"psychiatric",label:"Psychiatric disorder requiring treatment",kind:"select",options:yesNo},
    {id:"mildLiver",label:"Mild hepatic disease",kind:"select",options:yesNo},
    {id:"obesity",label:"BMI >35 kg/m²",kind:"select",options:yesNo},
    {id:"infection",label:"Active infection requiring treatment beyond day 0",kind:"select",options:yesNo},
    {id:"moderatePulmonary",label:"Moderate pulmonary disease",kind:"select",options:yesNo},
    {id:"rheumatologic",label:"Rheumatologic disease",kind:"select",options:yesNo},
    {id:"pepticUlcer",label:"Peptic ulcer disease",kind:"select",options:yesNo},
    {id:"renal",label:"Moderate/severe renal disease",kind:"select",options:yesNo},
    {id:"priorTumor",label:"Prior solid/other qualifying tumor",kind:"select",options:yesNo},
    {id:"heartValve",label:"Heart valve disease",kind:"select",options:yesNo},
    {id:"severePulmonary",label:"Severe pulmonary disease",kind:"select",options:yesNo},
    {id:"severeLiver",label:"Severe hepatic disease",kind:"select",options:yesNo},
  ],
  calculate:(inputs)=>{
    const one=["age40","arrhythmia","cardiac","ibd","diabetes","cerebrovascular","psychiatric","mildLiver","obesity","infection"]
    const two=["moderatePulmonary","rheumatologic","pepticUlcer","renal"]
    const three=["priorTumor","heartValve","severePulmonary","severeLiver"]
    const score=one.filter(k=>inputs[k]==="yes").length + two.filter(k=>inputs[k]==="yes").length*2 + three.filter(k=>inputs[k]==="yes").length*3
    const risk=score===0?"0 (low-risk category in the original index grouping)":score<=2?`${score} (intermediate category in the original index grouping)`: `${score} (high category in the original index grouping)`
    return {value:score,display:`HCT-CI: ${score}`,secondary:[{label:"Score grouping",value:risk}],interpretation:"A pre-transplant comorbidity score is not a substitute for transplant-team assessment, disease status, conditioning intensity, performance status or other patient factors.",calculationSteps:["Age ≥40 and the specified 1-point comorbidities add 1 each; 2-point comorbidities add 2; 3-point comorbidities add 3."]}
  },
  notes:["The EBMT Handbook documents the HCT-CI definitions and weights; some published versions differ in age handling, so this implementation explicitly identifies the age-inclusive version used."]
}

export const conditioningDayCalculator: CalculatorDefinition = {
  id:"conditioning-transplant-day",
  name:"Conditioning / Transplant Day Tracker",
  shortName:"HCT Day Tracker",
  category:"stem-cell-transplant",
  subcategory:"conditioning",
  description:"Tracks an explicitly documented conditioning or transplant day relative to day 0 without inferring a protocol schedule.",
  inputs:[{id:"day",label:"Documented treatment day",kind:"number",unit:"day",min:-100,max:100,step:1}],
  calculate:(inputs)=>{
    const day=num(inputs,"day")
    const phase=day<0?"Pre-transplant / conditioning period":day===0?"Stem-cell infusion day (day 0)":"Post-transplant period"
    return {value:day,display:`Day ${day>=0?"+":""}${day}`,secondary:[{label:"Phase",value:phase}],warnings:["This tool only labels the supplied day number; it does not infer which conditioning drugs, radiation fractions, prophylaxis or monitoring should occur on that day."]}
  }
}

export const stemCellCollectionYieldCalculator: CalculatorDefinition = {
  id:"stem-cell-collection-yield",
  name:"Stem Cell Collection Yield",
  shortName:"Collection Yield",
  category:"stem-cell-transplant",
  subcategory:"stem-cell-collection",
  description:"Calculates total collected CD34-positive cells and the collection dose per recipient kilogram from product concentration and volume.",
  formula:"Dose (×10⁶/kg) = CD34 concentration (cells/µL) × product volume (mL) ÷ 1,000,000 ÷ weight (kg) × 1,000",
  inputs:[{id:"cd34PerUl",label:"CD34+ concentration",kind:"number",unit:"cells/µL",min:0,step:0.1},{id:"volumeMl",label:"Product volume",kind:"number",unit:"mL",min:0.1,step:1},{id:"weightKg",label:"Recipient weight",kind:"number",unit:"kg",min:0.1,step:0.1}],
  calculate:(inputs)=>{
    const c=num(inputs,"cd34PerUl"),v=num(inputs,"volumeMl"),w=num(inputs,"weightKg")
    assertPositive(c,"CD34+ concentration");assertPositive(v,"Product volume");assertPositive(w,"Recipient weight")
    const total=c*1000*v, dose=round(total/1e6/w,2)
    return {value:dose,unit:"×10⁶/kg",display:fmt(dose,2,"×10⁶/kg"),secondary:[{label:"Total CD34+ cells",value:`${round(total/1e6,2)} ×10⁶ cells`}],calculationSteps:[`${c} cells/µL × 1,000 µL/mL × ${v} mL = ${round(total/1e6,2)} ×10⁶ cells`,`Total cells ÷ ${w} kg = ${dose} ×10⁶/kg`]}
  }
}

export const cd34CellDoseCalculator: CalculatorDefinition = {
  id:"cd34-cell-dose",
  name:"CD34+ Cell Dose",
  shortName:"CD34 Dose",
  category:"stem-cell-transplant",
  subcategory:"cell-dose",
  description:"Calculates CD34-positive cell dose per kilogram from a documented total product cell count and recipient weight.",
  formula:"CD34 dose (×10⁶/kg) = total CD34+ cells (×10⁶) ÷ weight (kg)",
  inputs:[{id:"totalCd34",label:"Total CD34+ cells",kind:"number",unit:"×10⁶ cells",min:0.001,step:0.01},{id:"weightKg",label:"Recipient weight",kind:"number",unit:"kg",min:0.1,step:0.1}],
  calculate:(inputs)=>{const t=num(inputs,"totalCd34"),w=num(inputs,"weightKg");assertPositive(t,"Total CD34+ cells");assertPositive(w,"Recipient weight");const d=round(t/w,2);return {value:d,unit:"×10⁶/kg",display:fmt(d,2,"×10⁶/kg"),calculationSteps:[`${t} ÷ ${w} = ${d} ×10⁶/kg`],warnings:["Compare the calculated dose with the collection/transplant protocol and product specification; this calculator does not define a target dose."]}}
}

export const neutrophilEngraftmentDayCalculator: CalculatorDefinition = {
  id:"neutrophil-engraftment-day",
  name:"Neutrophil Engraftment Timing",
  shortName:"Engraftment Day",
  category:"stem-cell-transplant",
  subcategory:"engraftment",
  description:"Calculates elapsed transplant days from day 0 to an explicitly documented engraftment day.",
  inputs:[{id:"engraftmentDay",label:"Documented engraftment day",kind:"number",unit:"day",min:0,max:200,step:1}],
  calculate:(inputs)=>{const d=num(inputs,"engraftmentDay");return {value:d,unit:"days",display:`${d} days after day 0`,interpretation:"This is elapsed time from the supplied day-0 reference. It does not establish whether an institutional definition of neutrophil engraftment has been met.",calculationSteps:[`Engraftment day ${d} − transplant day 0 = ${d} days`]}}
}

export const donorChimerismCalculator: CalculatorDefinition = {
  id:"donor-chimerism",
  name:"Donor Chimerism",
  shortName:"Chimerism %",
  category:"stem-cell-transplant",
  subcategory:"transplant-support",
  description:"Calculates donor chimerism as a percentage of the total measured cell population.",
  formula:"Donor chimerism (%) = donor signal ÷ total signal × 100",
  inputs:[{id:"donorSignal",label:"Donor signal / cells",kind:"number",min:0,step:0.01},{id:"totalSignal",label:"Total signal / cells",kind:"number",min:0.01,step:0.01}],
  calculate:(inputs)=>{const d=num(inputs,"donorSignal"),t=num(inputs,"totalSignal");if(d<0)throw new Error("Donor signal cannot be negative.");assertPositive(t,"Total signal");if(d>t)throw new Error("Donor signal cannot exceed total signal.");const p=round(d/t*100,1);return {value:p,unit:"%",display:fmt(p,1,"%"),calculationSteps:[`${d} ÷ ${t} × 100 = ${p}%`],warnings:["Interpret chimerism with the assay method, lineage tested, specimen timing and transplant protocol. A percentage alone does not diagnose graft failure or relapse."]}}
}


export const collectionTargetCalculator: CalculatorDefinition = {
  id: "stem-cell-collection-target",
  name: "Stem Cell Collection Target",
  shortName: "Collection Target",
  category: "stem-cell-transplant",
  subcategory: "stem-cell-collection",
  description: "Calculates the total CD34+ cell target required from a planned dose per kilogram and recipient weight.",
  formula: "Target CD34+ cells = target dose (×10⁶/kg) × weight (kg)",
  inputs: [
    { id: "targetDose", label: "Target CD34+ dose", kind: "number", unit: "×10⁶/kg", min: 0.1, step: 0.1, defaultValue: 2 },
    { id: "weightKg", label: "Recipient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1, defaultValue: 70 },
  ],
  calculate: (inputs) => {
    const d = num(inputs, "targetDose"), w = num(inputs, "weightKg")
    assertPositive(d, "Target CD34+ dose"); assertPositive(w, "Weight")
    const total = round(d * w, 2)
    return { value: total, unit: "×10⁶ cells", display: `Target: ${total} ×10⁶ CD34+ cells`, calculationSteps: [`${d} × ${w} = ${total} ×10⁶ cells`], warnings: ["Use the transplant center's protocol-defined target and recipient-weight method. Collection targets vary by indication and graft source."] }
  }
}

export const viableCd34CellDoseCalculator: CalculatorDefinition = {
  id: "viable-cd34-cell-dose",
  name: "Viable CD34+ Cell Dose",
  shortName: "Viable CD34+ Dose",
  category: "stem-cell-transplant",
  subcategory: "cell-dose",
  description: "Calculates the post-processing viable CD34+ cell dose per kilogram from total CD34+ cells, viability and recipient weight.",
  formula: "Viable dose = total CD34+ cells × viability ÷ weight",
  inputs: [
    { id: "totalCd34", label: "Total CD34+ cells", kind: "number", unit: "×10⁶ cells", min: 0.01, step: 0.01, defaultValue: 140 },
    { id: "viability", label: "CD34+ viability", kind: "number", unit: "%", min: 0, max: 100, step: 0.1, defaultValue: 90 },
    { id: "weightKg", label: "Recipient weight", kind: "number", unit: "kg", min: 0.1, step: 0.1, defaultValue: 70 },
  ],
  calculate: (inputs) => {
    const total = num(inputs, "totalCd34"), viability = num(inputs, "viability"), w = num(inputs, "weightKg")
    assertPositive(total, "Total CD34+ cells"); assertPositive(w, "Weight"); assertNonNegative(viability, "Viability")
    if (viability > 100) throw new Error("Viability cannot exceed 100%.")
    const dose = round(total * (viability / 100) / w, 3)
    return { value: dose, unit: "×10⁶/kg", display: `Viable CD34+ dose: ${dose} ×10⁶/kg`, calculationSteps: [`${total} × (${viability} ÷ 100) ÷ ${w} = ${dose} ×10⁶/kg`], warnings: ["Use the validated cell-counting and viability method for the product; assay variability and product handling affect the reported dose."] }
  }
}

export const engraftmentDurationCalculator: CalculatorDefinition = {
  id: "engraftment-duration",
  name: "Engraftment Duration",
  shortName: "Engraftment Duration",
  category: "stem-cell-transplant",
  subcategory: "engraftment",
  description: "Calculates elapsed days from transplant day to a documented engraftment day.",
  formula: "Elapsed days = engraftment day − transplant day",
  inputs: [
    { id: "transplantDay", label: "Transplant day", kind: "number", unit: "day", min: -100, max: 100, step: 1, defaultValue: 0 },
    { id: "engraftmentDay", label: "Engraftment day", kind: "number", unit: "day", min: -100, max: 365, step: 1, defaultValue: 14 },
  ],
  calculate: (inputs) => {
    const t = num(inputs, "transplantDay"), e = num(inputs, "engraftmentDay")
    const days = e - t
    if (days < 0) throw new Error("Engraftment day cannot precede transplant day.")
    return { value: days, unit: "days", display: `Elapsed time: ${days} days`, calculationSteps: [`${e} − ${t} = ${days} days`], warnings: ["This tool performs date arithmetic only. Whether a patient meets an engraftment definition depends on the transplant protocol and laboratory criteria."] }
  }
}
