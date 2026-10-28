import type { CalculatorDefinition } from "../types"
import { num, str, assertPositive, assertNonNegative, optionalNum, round, fmt } from "../helpers"
import { assessDoseModifications, assessHematologicDoseModifications, assessToxicityDoseModifications, calculateTreatmentRegimenDoses } from "../treatment-engine"
import type { ToxicityType } from "../treatment-engine"
import { treatmentRegimens } from "../treatment-regimens"

/** Oncology calculation primitives. These tools calculate arithmetic from an established protocol; they do not select a cancer regimen. */


/** Phase 36: oncology-specific BSA and protocol-dose arithmetic using the Mosteller method. */
export const oncologyBsaDoseCalculator: CalculatorDefinition = {
  id: "oncology-bsa-dose",
  name: "Oncology BSA-Based Dose",
  shortName: "BSA Dose",
  category: "oncology",
  subcategory: "body-surface-area",
  description: "Calculates Mosteller body-surface area and a protocol-specified dose expressed in mg/m².",
  formula: "BSA (m²) = √[(height cm × weight kg) ÷ 3600]; dose (mg) = protocol dose (mg/m²) × BSA",
  keywords: ["oncology", "BSA", "body surface area", "Mosteller", "chemotherapy", "mg/m2", "dose"],
  inputs: [
    { id: "heightCm", label: "Height", kind: "number", unit: "cm", min: 30, max: 250, step: 0.1 },
    { id: "weightKg", label: "Weight", kind: "number", unit: "kg", min: 0.5, max: 500, step: 0.1 },
    { id: "doseMgM2", label: "Protocol dose", kind: "number", unit: "mg/m²", min: 0.1, step: 0.1, helpText: "Enter the dose already specified by the applicable oncology protocol." },
    { id: "maximumDoseMg", label: "Protocol maximum dose", kind: "number", unit: "mg", min: 0.1, step: 0.1, optional: true, helpText: "Optional. Enter only when the applicable protocol explicitly specifies a maximum." },
  ],
  calculate: (inputs) => {
    const height = num(inputs, "heightCm")
    const weight = num(inputs, "weightKg")
    const doseMgM2 = num(inputs, "doseMgM2")
    const maximum = optionalNum(inputs, "maximumDoseMg")
    assertPositive(height, "Height")
    assertPositive(weight, "Weight")
    assertPositive(doseMgM2, "Protocol dose")
    if (maximum !== undefined) assertPositive(maximum, "Protocol maximum dose")

    const bsa = round(Math.sqrt((height * weight) / 3600), 2)
    const uncappedDose = round(doseMgM2 * bsa, 1)
    const appliedDose = maximum === undefined ? uncappedDose : round(Math.min(uncappedDose, maximum), 1)
    const capApplied = maximum !== undefined && uncappedDose > maximum

    return {
      value: appliedDose,
      unit: "mg",
      display: fmt(appliedDose, 1, "mg"),
      secondary: [
        { label: "Mosteller BSA", value: fmt(bsa, 2, "m²") },
        { label: "Calculated dose before cap", value: fmt(uncappedDose, 1, "mg") },
        ...(maximum !== undefined ? [{ label: "Protocol maximum", value: fmt(maximum, 1, "mg") }] : []),
        ...(maximum !== undefined ? [{ label: "Cap applied", value: capApplied ? "Yes" : "No" }] : []),
      ],
      calculationSteps: [
        `√[(${height} cm × ${weight} kg) ÷ 3600] = ${bsa} m²`,
        `${doseMgM2} mg/m² × ${bsa} m² = ${uncappedDose} mg before any protocol cap`,
        ...(maximum !== undefined && capApplied ? [`min(${uncappedDose} mg, ${maximum} mg) = ${appliedDose} mg`] : []),
      ],
      interpretation: "Protocol arithmetic only. The dose basis, BSA method and any maximum must be explicitly specified by the applicable regimen/protocol.",
      warnings: [
        "Mosteller BSA is used here only because this calculator explicitly defines that method; some protocols or institutions may require another method or policy.",
        "Do not enter a maximum dose unless the applicable protocol explicitly specifies one.",
        "This result does not determine regimen, indication, cycle, dose modification, organ-function adjustment or whether treatment should be administered.",
        "Verify height, weight, protocol, patient identity and independent chemotherapy checks before administration.",
      ],
    }
  },
  notes: [
    "The Mosteller equation is used for this dedicated BSA arithmetic tool: square root of height (cm) × weight (kg) divided by 3600.",
    "The protocol dose and any maximum dose are user-supplied rather than inferred from a cancer diagnosis or regimen name.",
  ],
  limitations: [
    "This tool does not choose a chemotherapy regimen or determine whether Mosteller BSA is the required method for a particular protocol.",
    "It supports mg/m² arithmetic only; AUC, mg/kg and other dose bases require their own protocol-specific calculations.",
  ],
}
export const oncologyDoseIntensityCalculator: CalculatorDefinition = {
  id: "oncology-dose-intensity",
  name: "Chemotherapy Dose Intensity",
  shortName: "Dose Intensity",
  category: "oncology",
  subcategory: "chemotherapy-dosing",
  description: "Calculates delivered chemotherapy dose intensity for a regimen expressed per body-surface area over time.",
  formula: "Dose intensity = cumulative dose (mg/m²) ÷ treatment duration (weeks)",
  keywords: ["oncology", "chemotherapy", "dose intensity", "mg/m2", "dose rate"],
  inputs: [
    { id: "cumulativeDose", label: "Cumulative dose", kind: "number", unit: "mg/m²", min: 0, step: 0.1 },
    { id: "durationWeeks", label: "Treatment duration", kind: "number", unit: "weeks", min: 0.01, step: 0.1 },
  ],
  calculate: (inputs) => {
    const dose = num(inputs, "cumulativeDose")
    const weeks = num(inputs, "durationWeeks")
    assertPositive(dose, "Cumulative dose")
    assertPositive(weeks, "Treatment duration")
    const intensity = round(dose / weeks, 2)
    return {
      value: intensity,
      unit: "mg/m²/week",
      display: fmt(intensity, 2, "mg/m²/week"),
      calculationSteps: [`${dose} mg/m² ÷ ${weeks} weeks = ${intensity} mg/m²/week`],
      interpretation: "Arithmetic only. Compare with the protocol's planned dose intensity; do not infer efficacy or safety from this value alone.",
      warnings: [
        "Dose intensity is regimen-specific and should use the same dose basis and time interval as the reference protocol.",
        "Do not use this result to independently increase or decrease chemotherapy dosing.",
      ],
    }
  },
}

export const oncologyRelativeDoseIntensityCalculator: CalculatorDefinition = {
  id: "oncology-relative-dose-intensity",
  name: "Relative Dose Intensity",
  shortName: "RDI",
  category: "oncology",
  subcategory: "chemotherapy-dosing",
  description: "Compares delivered chemotherapy dose intensity with the planned protocol dose intensity.",
  formula: "RDI (%) = delivered dose intensity ÷ planned dose intensity × 100",
  keywords: ["oncology", "chemotherapy", "RDI", "relative dose intensity", "dose intensity"],
  inputs: [
    { id: "deliveredIntensity", label: "Delivered dose intensity", kind: "number", unit: "dose intensity", min: 0, step: 0.01 },
    { id: "plannedIntensity", label: "Planned dose intensity", kind: "number", unit: "dose intensity", min: 0.01, step: 0.01 },
  ],
  calculate: (inputs) => {
    const delivered = num(inputs, "deliveredIntensity")
    const planned = num(inputs, "plannedIntensity")
    assertPositive(delivered, "Delivered dose intensity")
    assertPositive(planned, "Planned dose intensity")
    const rdi = round((delivered / planned) * 100, 1)
    return {
      value: rdi,
      unit: "%",
      display: `${rdi}%`,
      calculationSteps: [`(${delivered} ÷ ${planned}) × 100 = ${rdi}%`],
      interpretation: "RDI is a comparative treatment-delivery metric. It does not determine whether a dose reduction or delay is clinically appropriate.",
      warnings: [
        "Use matched units, dose basis and the same protocol-defined time period for planned and delivered intensity.",
        "Do not interpret a target RDI as an instruction to administer chemotherapy.",
      ],
    }
  },
}

export const oncologyCumulativeDoseCalculator: CalculatorDefinition = {
  id: "oncology-cumulative-dose",
  name: "Chemotherapy Cumulative Dose",
  shortName: "Cumulative Dose",
  category: "oncology",
  subcategory: "chemotherapy-dosing",
  description: "Calculates cumulative exposure from dose per administration, administrations per cycle and number of cycles.",
  formula: "Cumulative dose = dose/administration × administrations/cycle × cycles",
  keywords: ["oncology", "chemotherapy", "cumulative dose", "cumulative exposure", "anthracycline"],
  inputs: [
    { id: "dosePerAdministration", label: "Dose per administration", kind: "number", unit: "mg", min: 0, step: 0.1 },
    { id: "administrationsPerCycle", label: "Administrations per cycle", kind: "number", unit: "doses/cycle", min: 1, step: 1 },
    { id: "cycles", label: "Number of cycles", kind: "number", unit: "cycles", min: 1, step: 1 },
  ],
  calculate: (inputs) => {
    const dose = num(inputs, "dosePerAdministration")
    const perCycle = num(inputs, "administrationsPerCycle")
    const cycles = num(inputs, "cycles")
    assertPositive(dose, "Dose per administration")
    assertPositive(perCycle, "Administrations per cycle")
    assertPositive(cycles, "Number of cycles")
    const cycleTotal = round(dose * perCycle, 2)
    const cumulative = round(cycleTotal * cycles, 2)
    return {
      value: cumulative,
      unit: "mg",
      display: fmt(cumulative, 2, "mg"),
      secondary: [{ label: "Dose per cycle", value: fmt(cycleTotal, 2, "mg") }],
      calculationSteps: [
        `${dose} mg × ${perCycle} administrations/cycle = ${cycleTotal} mg/cycle`,
        `${cycleTotal} mg/cycle × ${cycles} cycles = ${cumulative} mg cumulative`,
      ],
      interpretation: "Cumulative arithmetic only. Some agents have clinically important cumulative exposure limits, but this calculator does not determine whether a cumulative dose is acceptable.",
      warnings: [
        "Check the drug-specific protocol or product labeling for cumulative exposure limits and prior treatment history.",
        "Do not combine doses from different drugs unless the clinical metric explicitly calls for it.",
      ],
    }
  },
}

export const oncologyCycleTotalCalculator: CalculatorDefinition = {
  id: "oncology-cycle-total-dose",
  name: "Chemotherapy Cycle Total",
  shortName: "Cycle Total",
  category: "oncology",
  subcategory: "cycle-course-calculations",
  description: "Calculates the total amount administered during one chemotherapy cycle from a per-administration dose and scheduled administrations.",
  formula: "Cycle total = dose/administration × scheduled administrations",
  keywords: ["oncology", "chemotherapy", "cycle", "cycle dose", "regimen"],
  inputs: [
    { id: "dosePerAdministration", label: "Dose per administration", kind: "number", unit: "mg", min: 0, step: 0.1 },
    { id: "scheduledAdministrations", label: "Scheduled administrations", kind: "number", unit: "doses", min: 1, step: 1 },
  ],
  calculate: (inputs) => {
    const dose = num(inputs, "dosePerAdministration")
    const administrations = num(inputs, "scheduledAdministrations")
    assertPositive(dose, "Dose per administration")
    assertPositive(administrations, "Scheduled administrations")
    const total = round(dose * administrations, 2)
    return {
      value: total,
      unit: "mg/cycle",
      display: fmt(total, 2, "mg/cycle"),
      calculationSteps: [`${dose} mg × ${administrations} scheduled administrations = ${total} mg/cycle`],
      interpretation: "Arithmetic only. The scheduled administrations must already come from the applicable chemotherapy protocol.",
      warnings: ["Do not infer cycle schedule, dose, or indication from this calculation."],
    }
  },
}

export const carboplatinCalvertCalculator: CalculatorDefinition = {
  id: "carboplatin-calvert-dose",
  name: "Carboplatin Dose  to  Calvert Formula",
  shortName: "Carboplatin Calvert",
  category: "oncology",
  subcategory: "chemotherapy-dosing",
  description: "Calculates carboplatin total dose in mg from a protocol-specified target AUC and GFR using the Calvert formula.",
  formula: "Dose (mg) = target AUC × (GFR + 25)",
  keywords: ["oncology", "carboplatin", "Calvert", "AUC", "GFR", "chemotherapy"],
  relatedTools: ["creatinine-clearance", "egfr-ckd-epi", "oncology-dose-intensity"],
  inputs: [
    { id: "targetAuc", label: "Target AUC", kind: "number", unit: "mg·min/mL", min: 0.1, step: 0.1 },
    { id: "gfr", label: "GFR used by the protocol", kind: "number", unit: "mL/min", min: 0.1, step: 0.1 },
  ],
  calculate: (inputs) => {
    const auc = num(inputs, "targetAuc")
    const gfr = num(inputs, "gfr")
    assertPositive(auc, "Target AUC")
    assertPositive(gfr, "GFR")
    const dose = round(auc * (gfr + 25), 1)
    return {
      value: dose,
      unit: "mg",
      display: fmt(dose, 1, "mg"),
      calculationSteps: [
        `${auc} × (${gfr} + 25) = ${dose} mg`,
      ],
      interpretation: "Calvert-formula arithmetic. The target AUC and renal-function method must come from the applicable chemotherapy protocol/product reference.",
      warnings: [
        "Do not substitute an arbitrary AUC target; different regimens and indications use different targets.",
        "Confirm the renal-function measurement/estimation method required by the current protocol before using the result.",
        "This calculator does not determine whether carboplatin is appropriate or safe for the patient.",
      ],
    }
  },
  notes: [
    "The Calvert formula is documented in FDA carboplatin labeling: total dose (mg) = target AUC × (GFR + 25).",
    "Current protocol-specific renal-function methods and dose caps should be verified separately.",
  ],
  limitations: [
    "The calculator performs the formula only; it does not select a target AUC, validate the indication, or determine the correct renal-function estimation method.",
  ],
}

export const oncologyDoseCapCalculator: CalculatorDefinition = {
  id: "oncology-dose-cap",
  name: "Chemotherapy Dose Cap Check",
  shortName: "Dose Cap",
  category: "oncology",
  subcategory: "dose-modifications",
  description: "Compares a calculated chemotherapy dose with a protocol-defined maximum and returns the lower value when a cap is supplied.",
  formula: "Final dose = min(calculated dose, protocol maximum)",
  keywords: ["oncology", "chemotherapy", "dose cap", "maximum dose", "dose limit"],
  inputs: [
    { id: "calculatedDose", label: "Calculated dose", kind: "number", unit: "mg", min: 0, step: 0.1 },
    { id: "protocolMaximum", label: "Protocol maximum", kind: "number", unit: "mg", min: 0.1, step: 0.1 },
  ],
  calculate: (inputs) => {
    const calculated = num(inputs, "calculatedDose")
    const maximum = num(inputs, "protocolMaximum")
    assertPositive(calculated, "Calculated dose")
    assertPositive(maximum, "Protocol maximum")
    const finalDose = Math.min(calculated, maximum)
    const capped = calculated > maximum
    return {
      value: finalDose,
      unit: "mg",
      display: `${fmt(finalDose, 1, "mg")}${capped ? " (capped)" : ""}`,
      secondary: [
        { label: "Calculated dose", value: fmt(calculated, 1, "mg") },
        { label: "Protocol maximum", value: fmt(maximum, 1, "mg") },
        { label: "Cap applied", value: capped ? "Yes" : "No" },
      ],
      calculationSteps: [`min(${calculated} mg, ${maximum} mg) = ${finalDose} mg`],
      interpretation: capped
        ? "The supplied protocol maximum is lower than the calculated dose, so the arithmetic cap was applied. Confirm that the maximum actually belongs to the selected drug, indication and population."
        : "The supplied protocol maximum does not reduce the calculated dose.",
      warnings: [
        "Only enter a maximum that is explicitly supported by the applicable current protocol or product reference.",
        "A dose cap is not a general safety rule and must not be inferred from this calculator.",
      ],
    }
  },
}


const HEMATOLOGIC_MODIFICATION_REGIMENS = treatmentRegimens.filter(
  (regimen) => regimen.status === "current" && regimen.doseModifications?.some((rule) => rule.criteria),
)

/** Phase 30: evaluates explicitly structured haematological protocol rules without changing doses. */
export const oncologyHematologicModificationCalculator: CalculatorDefinition = {
  id: "oncology-hematologic-dose-modification",
  name: "Oncology Haematologic Dose-Modification Assessment",
  shortName: "Oncology Dose Modification",
  category: "oncology",
  subcategory: "dose-modifications",
  description: "Matches entered ANC, platelet and febrile-neutropenia findings against explicitly structured haematological modification rules in a selected source-backed oncology regimen.",
  keywords: ["oncology", "chemotherapy", "ANC", "neutropenia", "platelets", "thrombocytopenia", "dose modification"],
  inputs: [
    {
      id: "regimenId",
      label: "Oncology regimen",
      kind: "select",
      options: HEMATOLOGIC_MODIFICATION_REGIMENS.map((regimen) => ({ value: regimen.id, label: regimen.name })),
      defaultValue: HEMATOLOGIC_MODIFICATION_REGIMENS[0]?.id,
      helpText: "Select the exact protocol whose haematological rules should be assessed.",
    },
    { id: "anc", label: "ANC", kind: "number", unit: "×10⁹/L", min: 0, step: 0.01, placeholder: "e.g. 0.8", optional: true },
    { id: "platelets", label: "Platelets", kind: "number", unit: "×10⁹/L", min: 0, step: 1, placeholder: "e.g. 60", optional: true },
    { id: "febrileNeutropenia", label: "Febrile neutropenia", kind: "select", options: [
      { value: "no", label: "No" },
      { value: "yes", label: "Yes" },
    ], defaultValue: "no" },
  ],
  calculate: (inputs) => {
    const regimenId = str(inputs, "regimenId")
    const regimen = treatmentRegimens.find((item) => item.id === regimenId)
    if (!regimen) throw new Error("Selected oncology regimen was not found.")

    const anc = optionalNum(inputs, "anc")
    const platelets = optionalNum(inputs, "platelets")
    assertNonNegative(anc ?? 0, "ANC")
    assertNonNegative(platelets ?? 0, "Platelets")
    if (anc === undefined && platelets === undefined && inputs.febrileNeutropenia !== "yes") {
      throw new Error("Enter ANC, platelets, or select febrile neutropenia before assessing protocol rules.")
    }

    const assessment = assessHematologicDoseModifications(regimen, {
      anc,
      platelets,
      febrileNeutropenia: inputs.febrileNeutropenia === "yes",
    })

    if (assessment.length === 0) {
      return {
        value: "No structured rule matched",
        display: `${regimen.name}: no structured haematological rule matched`,
        secondary: [
          ...(anc !== undefined ? [{ label: "ANC entered", value: `${anc} ×10⁹/L` }] : []),
          ...(platelets !== undefined ? [{ label: "Platelets entered", value: `${platelets} ×10⁹/L` }] : []),
          { label: "Febrile neutropenia", value: inputs.febrileNeutropenia === "yes" ? "Yes" : "No" },
        ],
        interpretation: "No explicitly structured haematological modification rule in the selected registry entry matched the supplied findings.",
        warnings: [
          "A non-match does not mean treatment is safe or appropriate to administer.",
          "Rules not yet structured in Clinexia are intentionally not inferred from free-text protocol notes.",
          "Review the complete current protocol, laboratory results and treating-team assessment before administration.",
        ],
      }
    }

    return {
      value: assessment.length,
      unit: assessment.length === 1 ? "matched rule" : "matched rules",
      display: `${assessment.length} protocol rule${assessment.length === 1 ? "" : "s"} matched`,
      secondary: assessment.flatMap((rule) => [
        { label: "Trigger", value: rule.trigger },
        { label: "Protocol action", value: rule.action },
        ...(rule.appliesTo?.length ? [{ label: "Applies to", value: rule.appliesTo.join(", ") }] : []),
      ]),
      calculationSteps: assessment.map((rule) => `${rule.ruleId}: ${rule.action}`),
      interpretation: `The selected ${regimen.name} protocol contains ${assessment.length} structured haematological rule${assessment.length === 1 ? "" : "s"} matching the supplied findings. Clinexia reports the protocol guidance and does not automatically alter any dose.`,
      warnings: [
        "Dose modification guidance is protocol-specific and requires clinical judgement; eviQ describes these recommendations as guidance rather than automatic prescribing decisions.",
        "Do not use this assessment alone to administer, reduce, delay or discontinue chemotherapy.",
        ...(regimen.warnings ?? []),
      ],
    }
  },
  notes: [
    "Phase 30 evaluates only structured haematological criteria. Free-text dose-modification rules remain intentionally non-automated until their criteria are explicitly encoded and verified.",
    "The current engine does not infer dose changes from ANC, platelets or febrile neutropenia; it reports the exact stored protocol action.",
  ],
  limitations: [
    "This phase does not automatically modify calculated doses.",
    "Renal, hepatic, neuropathy, mucositis, diarrhoea, cardiac and other toxicity rules require their own explicitly structured criteria before automation.",
  ],
}

const ORGAN_MODIFICATION_REGIMENS = treatmentRegimens.filter(
  (regimen) => regimen.status === "current" && regimen.doseModifications?.some((rule) => rule.domain === "renal" || rule.domain === "hepatic"),
)

/** Phase 31: evaluates explicitly structured renal/hepatic protocol rules without changing doses. */
export const oncologyOrganFunctionModificationCalculator: CalculatorDefinition = {
  id: "oncology-organ-function-dose-modification",
  name: "Oncology Renal & Hepatic Dose-Modification Assessment",
  shortName: "Renal/Hepatic Modification",
  category: "oncology",
  subcategory: "dose-modifications",
  description: "Matches entered kidney and liver function findings against explicitly structured renal/hepatic rules in a selected source-backed oncology regimen.",
  keywords: ["oncology", "chemotherapy", "renal", "eGFR", "hepatic", "bilirubin", "AST", "ALT", "dose modification"],
  inputs: [
    {
      id: "regimenId",
      label: "Oncology regimen",
      kind: "select",
      options: ORGAN_MODIFICATION_REGIMENS.map((regimen) => ({ value: regimen.id, label: regimen.name })),
      defaultValue: ORGAN_MODIFICATION_REGIMENS[0]?.id,
      helpText: "Select the exact protocol whose renal/hepatic rules should be assessed.",
    },
    { id: "eGfr", label: "eGFR", kind: "number", unit: "mL/min/1.73m²", min: 0, step: 0.1, placeholder: "e.g. 42", optional: true },
    { id: "hepaticDysfunction", label: "Hepatic dysfunction category", kind: "select", options: [
      { value: "none", label: "None / not impaired" },
      { value: "minimal", label: "Minimal" },
      { value: "mild", label: "Mild" },
      { value: "moderate", label: "Moderate" },
      { value: "severe", label: "Severe" },
    ], defaultValue: "none", helpText: "Use the category defined by the selected protocol; do not infer a category from this tool." },
    { id: "bilirubin", label: "Total bilirubin", kind: "number", unit: "µmol/L", min: 0, step: 0.1, placeholder: "Required only for rules using bilirubin", optional: true },
    { id: "astAlt", label: "AST/ALT", kind: "number", unit: "U/L", min: 0, step: 1, placeholder: "Required only for rules using AST/ALT", optional: true },
  ],
  calculate: (inputs) => {
    const regimenId = str(inputs, "regimenId")
    const regimen = treatmentRegimens.find((item) => item.id === regimenId)
    if (!regimen) throw new Error("Selected oncology regimen was not found.")

    const eGfr = optionalNum(inputs, "eGfr")
    const bilirubin = optionalNum(inputs, "bilirubin")
    const astAlt = optionalNum(inputs, "astAlt")
    const hepaticDysfunction = str(inputs, "hepaticDysfunction") as "none" | "minimal" | "mild" | "moderate" | "severe"
    assertNonNegative(eGfr ?? 0, "eGFR")
    assertNonNegative(bilirubin ?? 0, "Total bilirubin")
    assertNonNegative(astAlt ?? 0, "AST/ALT")

    const assessments = assessDoseModifications(regimen, {
      eGfr,
      bilirubin,
      astAlt,
      hepaticDysfunction,
    }).filter((assessment) => assessment.domain === "renal" || assessment.domain === "hepatic")

    const secondary = assessments.flatMap((assessment, index) => [
      { label: `Rule ${index + 1}`, value: assessment.trigger },
      { label: `Action ${index + 1}`, value: assessment.action },
      ...(assessment.appliesTo?.length ? [{ label: `Affected drugs ${index + 1}`, value: assessment.appliesTo.join(", ") }] : []),
    ])

    return {
      value: assessments.length,
      unit: "matched protocol rule(s)",
      display: assessments.length ? `${assessments.length} protocol rule${assessments.length === 1 ? "" : "s"} matched` : "No structured renal/hepatic rule matched",
      secondary,
      calculationSteps: assessments.length
        ? assessments.map((assessment) => `${assessment.trigger}  to  ${assessment.action}`)
        : ["No structured renal/hepatic rule matched the supplied findings."],
      interpretation: assessments.length
        ? `The selected ${regimen.name} protocol contains the matched renal/hepatic guidance shown above. This is protocol guidance, not an automatic dose change.`
        : "No structured renal/hepatic rule matched. This does not establish that treatment is safe or that no modification is required.",
      warnings: [
        ...(regimen.warnings ?? []),
        "Do not use a missing match as evidence that no renal or hepatic adjustment is needed; verify the full current protocol and drug monographs.",
        "This tool reports protocol guidance and never automatically changes, omits or delays a chemotherapy dose.",
        "For carboplatin, use the protocol-required renal-function method and the dedicated Calvert Formula calculator; do not substitute eGFR blindly when the protocol specifies another method.",
      ],
    }
  },
  notes: [
    "Phase 31 evaluates only explicitly structured renal and hepatic criteria from the source-backed regimen registry.",
    "Hepatic dysfunction categories are protocol inputs; the calculator does not derive them from bilirubin or transaminase values unless the regimen explicitly stores those laboratory thresholds.",
  ],
  limitations: [
    "Renal/hepatic assessment is incomplete for regimens whose source rules have not yet been explicitly encoded.",
    "The calculator does not apply dose reductions to the patient-specific regimen dose result.",
  ],
}

const PATIENT_SPECIFIC_REGIMENS = treatmentRegimens.filter(
  (regimen) => regimen.status === "current" || regimen.status === "reference-only",
)

/** Phase 28: patient-specific arithmetic for the verified BSA-based oncology registry. */
export const oncologyRegimenDoseCalculator: CalculatorDefinition = {
  id: "oncology-regimen-dose",
  name: "Oncology Regimen  to  Patient-Specific Dose",
  shortName: "Oncology Regimen Dose",
  category: "oncology",
  subcategory: "chemotherapy-dosing",
  description: "Calculates patient-specific doses from a selected source-backed oncology regimen using the supplied BSA and, where required, weight.",
  keywords: ["oncology", "chemotherapy", "regimen", "BSA", "patient-specific dose", "cycle", "cancer"],
  inputs: [
    {
      id: "regimenId",
      label: "Oncology regimen",
      kind: "select",
      options: PATIENT_SPECIFIC_REGIMENS.map((regimen) => ({ value: regimen.id, label: regimen.name })),
      helpText: "Select the exact source-backed regimen; do not generalize the displayed protocol to other indications.",
      defaultValue: PATIENT_SPECIFIC_REGIMENS[0]?.id,
    },
    { id: "bsa", label: "Body surface area", kind: "number", unit: "m²", min: 0.1, max: 5, step: 0.01, placeholder: "e.g. 1.80", helpText: "Use the BSA method required by the selected protocol. Clinexia does not silently recalculate or substitute a BSA method." },
    { id: "weightKg", label: "Weight", kind: "number", unit: "kg", min: 0.5, max: 500, step: 0.1, placeholder: "Optional unless the regimen contains a weight-based dose", optional: true },
    { id: "gfr", label: "GFR used by protocol", kind: "number", unit: "mL/min", min: 0.1, max: 300, step: 0.1, placeholder: "Required for AUC-based carboplatin", optional: true, helpText: "Only required when the selected regimen contains an AUC-based drug such as carboplatin. Use the renal-function method required by that protocol." },
  ],
  calculate: (inputs) => {
    const regimenId = str(inputs, "regimenId")
    const regimen = treatmentRegimens.find((item) => item.id === regimenId)
    if (!regimen) throw new Error("Selected oncology regimen was not found.")

    const bsa = num(inputs, "bsa")
    const rawWeight = inputs.weightKg
    const weightKg = rawWeight === undefined || rawWeight === "" ? undefined : num(inputs, "weightKg")
    const rawGfr = inputs.gfr
    const gfr = rawGfr === undefined || rawGfr === "" ? undefined : num(inputs, "gfr")
    assertPositive(bsa, "BSA")
    if (weightKg !== undefined) assertPositive(weightKg, "Weight")
    if (gfr !== undefined) assertPositive(gfr, "GFR")

    const doses = calculateTreatmentRegimenDoses(regimen, { bsa, weightKg, gfr })
    const secondary = doses.flatMap((dose) => [
      { label: `${dose.drug} dose`, value: fmt(dose.dose, 2, dose.doseUnit) },
      ...(dose.route ? [{ label: `${dose.drug} route`, value: dose.route }] : []),
      ...(dose.frequency ? [{ label: `${dose.drug} schedule`, value: dose.frequency }] : []),
    ])

    return {
      value: `${doses.length} drug dose${doses.length === 1 ? "" : "s"} calculated`,
      display: `${regimen.name}: ${doses.length} dose${doses.length === 1 ? "" : "s"}`,
      secondary,
      calculationSteps: doses.map((dose) => `${dose.drug}: ${dose.calculation}`),
      interpretation: `Protocol arithmetic only. ${regimen.name} is represented exactly as stored in the source-backed registry; the selected regimen, indication, population, cycle and dose-modification rules must be verified before use.`,
      warnings: [
        ...(regimen.warnings ?? []),
        ...(regimen.status === "reference-only" ? ["This regimen is reference-only in Clinexia. Confirm the exact current institutional/protocol version before patient-specific use."] : []),
        "This tool does not determine indication, cycle selection, dose reductions, organ-function adjustments, supportive care, or whether treatment should be administered.",
        "Verify the protocol, patient identity, BSA method, laboratory results, organ function, prior treatment and required independent medication checks before administration.",
      ],
    }
  },
  notes: [
    "BSA-based doses are calculated as protocol dose × supplied BSA; explicit protocol maximums are applied only when present in the regimen metadata.",
    "The supplied BSA should be calculated using the method required by the selected protocol. eviQ notes that BSA-based anti-cancer dosing is protocol-dependent and that BSA should be recalculated according to treatment and local policy.",
  ],
  limitations: [
    "Only dose bases implemented by the patient-specific engine are supported: mg/m², units/m², mg/kg, mcg/kg, units/kg and fixed doses.",
    "AUC-based dosing is calculated only through the Calvert formula when the selected regimen explicitly stores an AUC target and the user supplies the protocol-required GFR.",
  ],
}


const TOXICITY_MODIFICATION_REGIMENS = treatmentRegimens.filter(
  (regimen) => regimen.status === "current" && regimen.doseModifications?.some((rule) => rule.domain === "toxicity" && rule.criteria),
)

/** Phase 33: evaluates explicitly structured non-haematological toxicity rules without changing doses. */
export const oncologyToxicitySafetyCalculator: CalculatorDefinition = {
  id: "oncology-toxicity-safety",
  name: "Oncology Toxicity / Safety Assessment",
  shortName: "Toxicity / Safety",
  category: "oncology",
  subcategory: "toxicity-safety-checks",
  description: "Matches an explicitly graded non-haematological toxicity against structured protocol rules in a selected oncology regimen.",
  keywords: ["oncology", "chemotherapy", "toxicity", "CTCAE", "neuropathy", "mucositis", "diarrhoea", "safety"],
  inputs: [
    { id: "regimenId", label: "Oncology regimen", kind: "select", options: TOXICITY_MODIFICATION_REGIMENS.map((regimen) => ({ value: regimen.id, label: regimen.name })), defaultValue: TOXICITY_MODIFICATION_REGIMENS[0]?.id, helpText: "Select the exact source-backed regimen whose toxicity rules should be assessed." },
    { id: "toxicityType", label: "Toxicity", kind: "select", options: [
      { value: "peripheral-neuropathy", label: "Peripheral neuropathy" },
      { value: "mucositis-stomatitis", label: "Mucositis / stomatitis" },
      { value: "diarrhoea", label: "Diarrhoea" },
      { value: "hand-foot-syndrome", label: "Hand-foot syndrome" },
      { value: "cardiac", label: "Cardiac toxicity" },
      { value: "immune-related-adverse-event", label: "Immune-related adverse event" },
      { value: "other", label: "Other" },
    ] },
    { id: "toxicityGrade", label: "Toxicity grade", kind: "number", unit: "CTCAE grade", min: 1, max: 5, step: 1, placeholder: "1–5" },
    { id: "occurrence", label: "Occurrence", kind: "number", unit: "episode", min: 1, max: 10, step: 1, defaultValue: 1, optional: true },
    { id: "persistentAtNextCycle", label: "Persistent at next cycle", kind: "select", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }], defaultValue: "no" },
  ],
  calculate: (inputs) => {
    const regimenId = str(inputs, "regimenId")
    const regimen = treatmentRegimens.find((item) => item.id === regimenId)
    if (!regimen) throw new Error("Selected oncology regimen was not found.")

    const toxicityType = str(inputs, "toxicityType") as ToxicityType
    const grade = num(inputs, "toxicityGrade")
    const occurrence = inputs.occurrence === undefined || inputs.occurrence === "" ? 1 : num(inputs, "occurrence")
    if (grade < 1 || grade > 5) throw new Error("Toxicity grade must be between 1 and 5.")
    if (occurrence < 1) throw new Error("Occurrence must be at least 1.")

    const assessment = assessToxicityDoseModifications(regimen, {
      toxicityType,
      toxicityGrade: grade,
      occurrence,
      persistentAtNextCycle: inputs.persistentAtNextCycle === "yes",
    })

    if (assessment.length === 0) {
      return {
        value: "No structured rule matched",
        display: `${regimen.name}: no structured toxicity rule matched`,
        secondary: [
          { label: "Toxicity", value: toxicityType },
          { label: "Grade", value: String(grade) },
          { label: "Occurrence", value: String(occurrence) },
        ],
        interpretation: "No explicitly structured non-haematological toxicity rule in the selected registry entry matched the supplied findings.",
        warnings: [
          "A non-match does not mean treatment is safe or appropriate to administer.",
          "Clinexia does not infer unstructured toxicity rules or convert a toxicity grade into an automatic dose change.",
          "Review the complete current protocol, CTCAE definition, laboratory/clinical findings and treating-team assessment before administration.",
        ],
      }
    }

    return {
      value: assessment.length,
      unit: assessment.length === 1 ? "matched rule" : "matched rules",
      display: `${assessment.length} toxicity rule${assessment.length === 1 ? "" : "s"} matched`,
      secondary: assessment.flatMap((rule) => [
        { label: "Trigger", value: rule.trigger },
        { label: "Protocol action", value: rule.action },
        ...(rule.appliesTo?.length ? [{ label: "Applies to", value: rule.appliesTo.join(", ") }] : []),
      ]),
      calculationSteps: assessment.map((rule) => `${rule.ruleId}: ${rule.action}`),
      interpretation: `The selected ${regimen.name} protocol contains ${assessment.length} structured toxicity rule${assessment.length === 1 ? "" : "s"} matching the supplied finding. Clinexia reports protocol guidance and does not automatically alter a dose.`,
      warnings: [
        "Non-haematological toxicity recommendations are protocol-specific and require clinical judgement; eviQ states its dose-modification recommendations are guidance rather than automatic prescribing decisions.",
        ...(regimen.warnings ?? []),
        "Do not use this assessment alone to administer, reduce, delay or discontinue chemotherapy.",
      ],
    }
  },
  notes: [
    "Phase 33 evaluates only explicitly structured toxicity criteria. It does not infer CTCAE grading or translate free-text protocol notes into automated actions.",
    "Occurrence and persistence are included because some protocol recommendations differ by recurrence or persistence into the next cycle.",
  ],
  limitations: [
    "Only toxicity rules explicitly encoded in the selected regimen are evaluated.",
    "No automatic dose reduction, omission, delay or treatment cessation is performed.",
    "CTCAE grading itself remains a clinician-assessed input and is not derived from symptoms by Clinexia.",
  ],
}


/** Phase 34: classifies anti-cancer therapy by emetogenic risk and surfaces protocol-aligned supportive-care guidance. */
export const oncologyAntiemeticRiskCalculator: CalculatorDefinition = {
  id: "oncology-antiemetic-risk",
  name: "Chemotherapy Emetogenic Risk Assessment",
  shortName: "Emetogenic Risk",
  category: "oncology",
  subcategory: "supportive-care",
  description: "Classifies selected anti-cancer therapy by emetogenic risk using explicitly defined drug/regimen rules and returns the corresponding supportive-care category.",
  keywords: ["oncology", "supportive care", "antiemetic", "CINV", "emetogenic", "nausea", "vomiting"],
  inputs: [
    {
      id: "therapy",
      label: "Anti-cancer therapy",
      kind: "select",
      options: [
        { value: "breast-ac", label: "Breast anthracycline + cyclophosphamide (AC)" },
        { value: "carboplatin", label: "Carboplatin" },
        { value: "cisplatin", label: "Cisplatin" },
        { value: "doxorubicin", label: "Doxorubicin" },
        { value: "irinotecan", label: "Irinotecan" },
        { value: "oxaliplatin", label: "Oxaliplatin" },
        { value: "paclitaxel", label: "Paclitaxel" },
        { value: "docetaxel", label: "Docetaxel" },
        { value: "etoposide", label: "Etoposide" },
        { value: "vincristine", label: "Vincristine" },
        { value: "rituximab", label: "Rituximab" },
      ],
      defaultValue: "carboplatin",
    },
    { id: "carboplatinAuc", label: "Carboplatin AUC (if applicable)", kind: "number", unit: "mg·min/mL", min: 0, step: 0.1, optional: true, helpText: "Used only to show the guideline classification caveat for carboplatin." },
  ],
  calculate: (inputs) => {
    const therapy = str(inputs, "therapy")
    const auc = inputs.carboplatinAuc === undefined || inputs.carboplatinAuc === "" ? undefined : num(inputs, "carboplatinAuc")
    if (auc !== undefined && auc < 0) throw new Error("Carboplatin AUC cannot be negative.")

    const table: Record<string, { risk: string; basis: string; guidance: string }> = {
      "breast-ac": { risk: "High", basis: ">90% risk of emesis", guidance: "Use the high-emetic-risk supportive-care pathway; the cited eviQ guidance uses combination antiemetic prophylaxis." },
      cisplatin: { risk: "High", basis: ">90% risk of emesis", guidance: "Use the high-emetic-risk supportive-care pathway." },
      doxorubicin: { risk: "Moderate", basis: "30–90% risk; anthracycline-containing combinations may be higher risk", guidance: "Use the protocol-specific antiemetic pathway for the actual regimen rather than treating single-drug classification as a complete prescription." },
      irinotecan: { risk: "Moderate", basis: "30–90% risk of emesis", guidance: "Use the moderate-emetic-risk supportive-care pathway." },
      oxaliplatin: { risk: "Moderate", basis: "30–90% risk of emesis", guidance: "eviQ classifies oxaliplatin as moderate and notes that some guidelines recommend stronger prophylaxis; follow the selected protocol." },
      carboplatin: { risk: "Moderate", basis: "30–90% risk under eviQ's current classification", guidance: "eviQ notes additional NK1-antagonist considerations at higher AUC values; follow the current regimen-specific protocol." },
      paclitaxel: { risk: "Low", basis: "10–30% risk of emesis", guidance: "Low-emetic-risk prophylaxis may be sufficient, but regimen-specific premedication for hypersensitivity is a separate issue." },
      docetaxel: { risk: "Low", basis: "10–30% risk of emesis", guidance: "Use the selected protocol's antiemetic and hypersensitivity-premedication schedule." },
      etoposide: { risk: "Low", basis: "10–30% risk of emesis", guidance: "Use protocol-specific supportive care; oral and IV classifications can differ." },
      vincristine: { risk: "Minimal", basis: "<10% risk of emesis", guidance: "Routine prophylaxis is generally not required solely because of minimal emetogenic risk." },
      rituximab: { risk: "Minimal", basis: "<10% risk of emesis", guidance: "Routine antiemetic prophylaxis is generally not required solely for emetogenic risk; infusion-reaction premedication is a separate protocol concern." },
    }
    const selected = table[therapy]
    if (!selected) throw new Error("Selected therapy is not supported by the structured emetogenicity table.")
    const warnings = [
      "Emetogenic risk is only one part of supportive-care planning; patient-specific risk factors and the complete regimen must also be reviewed.",
      "When multiple anti-cancer drugs are combined, eviQ recommends determining antiemetic treatment according to the drug with the greatest emetogenic risk.",
      "This calculator does not prescribe an antiemetic regimen or replace the current protocol.",
    ]
    if (therapy === "carboplatin" && auc !== undefined) {
      warnings.push("Carboplatin AUC thresholds differ between guideline systems; the AUC is displayed only as contextual information and does not by itself prescribe an antiemetic regimen.")
    }
    return {
      value: selected.risk,
      display: `${selected.risk} emetogenic risk`,
      secondary: [
        { label: "Risk basis", value: selected.basis },
        { label: "Supportive-care direction", value: selected.guidance },
        ...(auc !== undefined ? [{ label: "Entered carboplatin AUC", value: String(auc) }] : []),
      ],
      interpretation: "This is a supportive-care risk classification, not a chemotherapy prescription.",
      warnings,
    }
  },
  notes: [
    "Based on eviQ Prevention of anti-cancer therapy induced nausea and vomiting, current version reviewed 2026-09-15.",
    "The eviQ page distinguishes high, moderate, low and minimal emetic-risk categories for intravenous anti-cancer drugs.",
  ],
}

/** Phase 34: evaluates febrile-neutropenia risk bands without prescribing a G-CSF product or dose. */
export const oncologyFebrileNeutropeniaRiskCalculator: CalculatorDefinition = {
  id: "oncology-febrile-neutropenia-risk",
  name: "Febrile Neutropenia Prophylaxis Risk Assessment",
  shortName: "FN Risk",
  category: "oncology",
  subcategory: "supportive-care",
  description: "Classifies an entered chemotherapy febrile-neutropenia risk estimate into a protocol-support band and highlights when patient-specific risk factors may change the decision.",
  formula: "Risk band = estimated febrile-neutropenia probability",
  keywords: ["oncology", "supportive care", "febrile neutropenia", "FN", "G-CSF", "growth factor"],
  inputs: [
    { id: "fnRiskPercent", label: "Estimated febrile-neutropenia risk", kind: "number", unit: "%", min: 0, max: 100, step: 0.1, placeholder: "e.g. 18" },
    { id: "patientRiskFactors", label: "Additional patient-specific risk factors", kind: "select", options: [
      { value: "unknown", label: "Not assessed" },
      { value: "no", label: "No additional factors identified" },
      { value: "yes", label: "Yes" },
    ], defaultValue: "unknown", helpText: "Examples can include age, comorbidity, prior treatment history or other protocol-defined risk factors." },
    { id: "priorFebrileNeutropenia", label: "Prior febrile neutropenia", kind: "select", options: [
      { value: "unknown", label: "Not assessed" },
      { value: "no", label: "No" },
      { value: "yes", label: "Yes" },
    ], defaultValue: "unknown" },
  ],
  calculate: (inputs) => {
    const risk = num(inputs, "fnRiskPercent")
    if (risk < 0 || risk > 100) throw new Error("Febrile-neutropenia risk must be between 0% and 100%.")
    const factors = str(inputs, "patientRiskFactors")
    const prior = str(inputs, "priorFebrileNeutropenia")
    let band = "<10%"
    let interpretation = "Routine primary G-CSF prophylaxis is generally not driven by regimen risk alone in this band; assess the complete protocol and patient factors."
    if (risk >= 20) {
      band = "≥20%"
      interpretation = "This is the commonly used high-risk band in which primary prophylactic G-CSF is generally considered when consistent with the treatment intent and current protocol."
    } else if (risk >= 10) {
      band = "10–<20%"
      interpretation = "This is an intermediate-risk band in which patient-specific risk factors and treatment intent can materially influence the prophylaxis decision."
    }
    const warnings = [
      "Risk-band assessment does not prescribe a G-CSF product, dose, timing or duration.",
      "The decision depends on regimen intent, patient-specific risk factors, treatment alternatives and the current local protocol.",
    ]
    if (factors === "yes" || prior === "yes") warnings.push("Additional patient-specific risk information was entered; review the complete prophylaxis criteria rather than relying on regimen risk alone.")
    if (factors === "unknown" || prior === "unknown") warnings.push("One or more patient-specific risk dimensions were not assessed.")
    return {
      value: risk,
      unit: "%",
      display: `${fmt(risk, 1, "%")} estimated FN risk  to  ${band} band`,
      secondary: [
        { label: "Risk band", value: band },
        { label: "Patient-specific risk factors", value: factors === "yes" ? "Present" : factors === "no" ? "None identified" : "Not assessed" },
        { label: "Prior febrile neutropenia", value: prior === "yes" ? "Yes" : prior === "no" ? "No" : "Not assessed" },
      ],
      interpretation,
      warnings,
    }
  },
  notes: [
    "eviQ supportive-care materials commonly use <20% as a threshold below which routine primary G-CSF prophylaxis is generally not recommended, with patient-specific factors influencing intermediate-risk decisions.",
    "The calculator reports a risk band only; it does not determine eligibility for a particular G-CSF product or reimbursement system.",
  ],
}


/** Phase 35: tracks explicit cycle/course progress without inferring a regimen schedule. */
export const oncologyCycleProgressCalculator: CalculatorDefinition = {
  id: "oncology-cycle-progress",
  name: "Oncology Cycle Progress",
  shortName: "Cycle Progress",
  category: "oncology",
  subcategory: "cycle-course-calculations",
  description: "Calculates the current cycle position, completed cycles and remaining planned cycles from an explicitly documented treatment course.",
  formula: "Remaining cycles = planned cycles − completed cycles; course progress (%) = completed cycles ÷ planned cycles × 100",
  keywords: ["oncology", "cycle", "course", "chemotherapy", "planned cycles", "completed cycles", "remaining cycles"],
  inputs: [
    { id: "currentCycle", label: "Current cycle number", kind: "number", unit: "cycle", min: 1, step: 1 },
    { id: "plannedCycles", label: "Planned total cycles", kind: "number", unit: "cycles", min: 1, step: 1 },
    { id: "completedCycles", label: "Completed cycles", kind: "number", unit: "cycles", min: 0, step: 1 },
    { id: "treatmentDay", label: "Treatment day within current cycle", kind: "number", unit: "day", min: 1, step: 1, optional: true, helpText: "Enter only when the protocol explicitly defines a treatment day for the current cycle." },
  ],
  calculate: (inputs) => {
    const currentCycle = num(inputs, "currentCycle")
    const planned = num(inputs, "plannedCycles")
    const completed = num(inputs, "completedCycles")
    const treatmentDay = optionalNum(inputs, "treatmentDay")

    assertPositive(currentCycle, "Current cycle number")
    assertPositive(planned, "Planned total cycles")
    assertNonNegative(completed, "Completed cycles")
    if (!Number.isInteger(currentCycle) || !Number.isInteger(planned) || !Number.isInteger(completed)) {
      throw new Error("Cycle numbers must be whole numbers.")
    }
    if (completed > planned) throw new Error("Completed cycles cannot exceed planned total cycles.")
    if (currentCycle > planned) throw new Error("Current cycle cannot exceed planned total cycles.")
    if (treatmentDay !== undefined) {
      if (!Number.isInteger(treatmentDay) || treatmentDay < 1) throw new Error("Treatment day must be a positive whole number.")
    }

    const remaining = planned - completed
    const progress = round((completed / planned) * 100, 1)
    const position = treatmentDay === undefined
      ? `Cycle ${currentCycle} of ${planned}`
      : `Cycle ${currentCycle}, treatment day ${treatmentDay}`

    return {
      value: remaining,
      unit: "cycles remaining",
      display: `${position}  to  ${remaining} planned cycle${remaining === 1 ? "" : "s"} remaining`,
      secondary: [
        { label: "Completed cycles", value: `${completed} of ${planned}` },
        { label: "Course progress", value: `${progress}%` },
        { label: "Current cycle", value: String(currentCycle) },
        ...(treatmentDay !== undefined ? [{ label: "Treatment day", value: String(treatmentDay) }] : []),
      ],
      calculationSteps: [
        `${planned} planned cycles − ${completed} completed cycles = ${remaining} remaining cycles`,
        `(${completed} ÷ ${planned}) × 100 = ${progress}% course progress`,
      ],
      interpretation: "Course arithmetic only. The current cycle and treatment day must come from the documented protocol and treatment record; this calculator does not infer missed, delayed or rescheduled doses.",
      warnings: [
        "Do not use remaining-cycle arithmetic to decide whether treatment should continue, be delayed or be discontinued.",
        "Dose reductions, omissions and treatment delays can change the actual course and must be assessed against the applicable protocol and clinical record.",
      ],
    }
  },
}

/** Phase 35: calculates explicit course exposure from documented per-cycle exposure. */
export const oncologyCourseCompletionCalculator: CalculatorDefinition = {
  id: "oncology-course-completion",
  name: "Oncology Course Completion",
  shortName: "Course Completion",
  category: "oncology",
  subcategory: "cycle-course-calculations",
  description: "Calculates completed and remaining treatment-course exposure from an explicitly documented per-cycle dose and cycle count.",
  formula: "Completed exposure = dose/cycle × completed cycles; remaining planned exposure = dose/cycle × remaining cycles",
  keywords: ["oncology", "course", "cycle", "cumulative exposure", "remaining treatment", "chemotherapy"],
  inputs: [
    { id: "dosePerCycle", label: "Documented dose per cycle", kind: "number", unit: "mg", min: 0, step: 0.1 },
    { id: "plannedCycles", label: "Planned total cycles", kind: "number", unit: "cycles", min: 1, step: 1 },
    { id: "completedCycles", label: "Completed cycles", kind: "number", unit: "cycles", min: 0, step: 1 },
  ],
  calculate: (inputs) => {
    const dosePerCycle = num(inputs, "dosePerCycle")
    const planned = num(inputs, "plannedCycles")
    const completed = num(inputs, "completedCycles")
    assertPositive(dosePerCycle, "Documented dose per cycle")
    assertPositive(planned, "Planned total cycles")
    assertNonNegative(completed, "Completed cycles")
    if (!Number.isInteger(planned) || !Number.isInteger(completed)) throw new Error("Cycle numbers must be whole numbers.")
    if (completed > planned) throw new Error("Completed cycles cannot exceed planned total cycles.")

    const remaining = planned - completed
    const plannedExposure = round(dosePerCycle * planned, 2)
    const completedExposure = round(dosePerCycle * completed, 2)
    const remainingExposure = round(dosePerCycle * remaining, 2)
    const progress = round((completed / planned) * 100, 1)

    return {
      value: completedExposure,
      unit: "mg completed exposure",
      display: `${fmt(completedExposure, 2, "mg")} completed exposure  to  ${remaining} cycle${remaining === 1 ? "" : "s"} remaining`,
      secondary: [
        { label: "Planned course exposure", value: fmt(plannedExposure, 2, "mg") },
        { label: "Completed exposure", value: fmt(completedExposure, 2, "mg") },
        { label: "Remaining planned exposure", value: fmt(remainingExposure, 2, "mg") },
        { label: "Course progress", value: `${progress}%` },
      ],
      calculationSteps: [
        `${dosePerCycle} mg/cycle × ${completed} completed cycles = ${completedExposure} mg completed exposure`,
        `${planned} planned − ${completed} completed = ${remaining} cycles remaining`,
        `${dosePerCycle} mg/cycle × ${remaining} remaining cycles = ${remainingExposure} mg remaining planned exposure`,
      ],
      interpretation: "Arithmetic exposure tracking only. It assumes the entered dose per cycle is the documented protocol dose and does not account for dose reductions, omissions, substitutions or changes in schedule.",
      warnings: [
        "Use a drug-specific dose per cycle only when the protocol defines that exposure consistently across the course.",
        "For multidrug regimens, calculate each drug separately when their doses or schedules differ.",
        "Do not treat remaining planned exposure as an instruction to administer the remaining doses.",
      ],
    }
  },
}
