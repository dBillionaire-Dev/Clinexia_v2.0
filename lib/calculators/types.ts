export type InputKind = "number" | "select" | "date"

export interface SelectOption {
  value: string
  label: string
}

/** Where an input can be read from in a FHIR record. Optional metadata, used by integrations (see lib/calculators/coding-metadata.ts). */
export interface FhirMapping {
  resource: "Patient" | "Observation"
  /** Element path on the resource, e.g. "birthDate" or "gender" for Patient. */
  path?: string
  /** LOINC code of the Observation to read. UNVERIFIED unless docs/integration/FINDINGS.md says otherwise. */
  loinc?: string
}

export interface InputDefinition {
  id: string
  label: string
  kind: InputKind
  unit?: string
  placeholder?: string
  min?: number
  max?: number
  step?: number
  defaultValue?: number | string
  options?: SelectOption[]
  helpText?: string
  optional?: boolean
  /** LOINC code of the observation this input corresponds to (integration metadata; UNVERIFIED until checked, see FINDINGS.md). */
  loinc?: string
  /** UCUM unit string for the input's unit, e.g. "mg/dL", "10*9/L". */
  ucum?: string
  /** How to read this input from a FHIR Patient or Observation. */
  fhir?: FhirMapping
}

export interface CalculationField {
  label: string
  value: string
}

export interface CalculationResult {
  /** Primary numeric or textual result */
  value: number | string
  /** Unit for the primary result, if any */
  unit?: string
  /** Human readable formatted result, e.g. "24.7 kg/m²" */
  display: string
  /** Secondary values worth surfacing (e.g. category, interpretation) */
  secondary?: CalculationField[]
  /** Step-by-step substitution, e.g. "70 / (1.75 x 1.75)" */
  calculationSteps?: string[]
  /** Free-form interpretation text (never a diagnosis) */
  interpretation?: string
  /** Non-fatal warnings, e.g. "value outside typical range" */
  warnings?: string[]
  /** The dose of ONE administration in mg (a range when the source gives one). Lets the app also show the volume per dose. */
  perDoseMg?: { low: number; high?: number }
  /** Optional coding for the primary result (integration metadata). Calculators do not set these; see getResultCoding(). */
  loinc?: string
  ucum?: string
  fhir?: FhirMapping
}

export type CalculatorGroup =
  | "general"
  | "renal"
  | "chemistry"
  | "hematology"
  | "microbiology"
  | "lab-solutions"
  | "spectrophotometry"
  | "dosing"
  | "oncology"
  | "cardiovascular"
  | "stem-cell-transplant"

export interface CalculatorDefinition {
  id: string
  name: string
  shortName?: string
  category: CalculatorGroup
  /** Optional second-level navigation bucket inside the top-level clinical domain. */
  subcategory?: string
  description: string
  isEstimator?: boolean
  inputs: InputDefinition[]
  calculate: (inputs: Record<string, number | string>) => CalculationResult
  formula?: string
  notes?: string[]
  limitations?: string[]
  relatedTools?: string[]
  keywords?: string[]
}

export const CALCULATOR_CATEGORY_LABELS: Record<CalculatorGroup, string> = {
  general: "General",
  renal: "Renal",
  chemistry: "Clinical Chemistry",
  hematology: "Hematology",
  microbiology: "Microbiology",
  "lab-solutions": "Laboratory Solutions",
  spectrophotometry: "Spectrophotometry",
  dosing: "Drug Dosing",
  oncology: "Oncology",
  cardiovascular: "Cardiovascular",
  "stem-cell-transplant": "Stem Cell & Transplant",
}

export const CALCULATOR_SUBCATEGORY_LABELS: Record<CalculatorGroup, Record<string, string>> = {
  general: {},
  renal: {},
  chemistry: {},
  microbiology: {},
  "lab-solutions": {
    "dilution-preparation": "Dilution & Preparation",
    "concentration-preparation": "Concentration & Reagent Preparation",
  },
  spectrophotometry: {
    "absorbance-transmittance": "Absorbance & Transmittance",
    "calibration-curves": "Calibration Curves",
    "wavelength-photon": "Wavelength & Photon Calculations",
    "photometric-quality": "Photometric Quality & Precision",
  },
  hematology: {
    anemia: "Anemia",
    coagulation: "Coagulation",
    transfusion: "Transfusion",
    "blood-products": "Blood Products",
    "hematologic-malignancy": "Hematologic Malignancy",
  },
  dosing: {
    "general-dosing": "General Dosing",
    antimalarial: "Antimalarial",
    antibiotic: "Antibiotic",
    "renal-adjustment": "Renal Adjustment",
    "therapeutic-drug-monitoring": "Therapeutic Drug Monitoring",
  },
  oncology: {
    "body-surface-area": "Body Surface Area",
    "chemotherapy-dosing": "Chemotherapy Dosing",
    "dose-modifications": "Dose Modifications",
    "cycle-course-calculations": "Cycle / Course Calculations",
    "supportive-care": "Supportive Care",
    "toxicity-safety-checks": "Toxicity / Safety Checks",
  },
  cardiovascular: {
    hypertension: "Hypertension",
    "heart-failure": "Heart Failure",
    anticoagulation: "Anticoagulation",
    antiplatelet: "Antiplatelet",
    arrhythmia: "Arrhythmia",
    "risk-prevention": "Risk / Prevention",
  },
  "stem-cell-transplant": {
    hct: "HCT",
    conditioning: "Conditioning",
    "stem-cell-collection": "Stem Cell Collection",
    "cell-dose": "Cell Dose",
    engraftment: "Engraftment",
    "transplant-support": "Transplant Support",
  },
}

/** Standard disclaimer shown on every calculator result. */
export const CALCULATION_DISCLAIMER =
  "Clinexia provides mathematical calculations and estimates for educational and clinical reference purposes. Results should be interpreted according to local clinical protocols, product information, validated methods, clinical context, and professional judgment. Reference ranges, doses and formulas may vary."

/** Shown on laboratory preparation tools (dilutions, solutions, density/molar conversions). */
export const LAB_PREP_DISCLAIMER =
  "Always follow your laboratory's validated SOPs, reagent manufacturer's instructions, and applicable safety procedures."
