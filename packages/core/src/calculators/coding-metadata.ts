import type { CalculatorDefinition, FhirMapping, InputDefinition } from "./types"

/**
 * Clinical coding metadata (LOINC, UCUM, FHIR mapping) for the highest-value non-dosing calculators.
 *
 * It lives in this one table, not in each definition file, so no calculator definition or formula is touched. The
 * registry merges it into the matching inputs (withCodingMetadata). Nothing here changes calculate().
 *
 * EVERY LOINC CODE BELOW IS UNVERIFIED. It was written without access to loinc.org. Each code passes the LOINC mod-10 check
 * digit (see coding-metadata.test.ts), which catches typos but says nothing about whether the code means what the comment says.
 * Before anyone relies on a code, check it with scripts/verify-loinc.mjs against a Loinc.csv from loinc.org and list the result
 * in docs/integration/FINDINGS.md. Where the right code was not known, none is given (ucum only) rather than a guess.
 *
 * UCUM strings follow the UCUM specification (e.g. "10*9/L", "mm[Hg]", "/min", "a" for years) and were also not machine-validated.
 */

export interface InputCoding {
  loinc?: string
  ucum?: string
  fhir?: FhirMapping
}

export interface ResultCoding {
  loinc?: string
  ucum?: string
}

/** An Observation-backed input: the LOINC code and the FHIR Observation it is read from. */
const obs = (loinc: string, ucum: string): InputCoding => ({ loinc, ucum, fhir: { resource: "Observation", loinc } })
const age: InputCoding = { ucum: "a", fhir: { resource: "Patient", path: "birthDate" } } // age in years is derived from Patient.birthDate
const sex: InputCoding = { fhir: { resource: "Patient", path: "gender" } }
const plain = (ucum: string): InputCoding => ({ ucum })

const WEIGHT = obs("29463-7", "kg") // UNVERIFIED: Body weight
const HEIGHT = obs("8302-2", "cm") // UNVERIFIED: Body height
const CREATININE_MASS = obs("2160-0", "mg/dL") // UNVERIFIED: Creatinine [Mass/volume] in Serum or Plasma
const BUN = obs("3094-0", "mg/dL") // UNVERIFIED: Urea nitrogen [Mass/volume] in Serum or Plasma
const GLUCOSE_MASS = obs("2345-7", "mg/dL") // UNVERIFIED: Glucose [Mass/volume] in Serum or Plasma
const CALCIUM_MASS = obs("17861-6", "mg/dL") // UNVERIFIED: Calcium [Mass/volume] in Serum or Plasma
const ALBUMIN = obs("1751-7", "g/dL") // UNVERIFIED: Albumin [Mass/volume] in Serum or Plasma
const SODIUM = obs("2951-2", "mmol/L") // UNVERIFIED: Sodium [Moles/volume] in Serum or Plasma
const CHLORIDE = obs("2075-0", "mmol/L") // UNVERIFIED: Chloride [Moles/volume] in Serum or Plasma
const BICARBONATE = obs("1963-8", "mmol/L") // UNVERIFIED: Bicarbonate [Moles/volume] in Serum or Plasma

export const INPUT_CODING: Record<string, Record<string, InputCoding>> = {
  "creatinine-clearance": { age, weight: WEIGHT, creatinine: CREATININE_MASS, sex },
  "egfr-ckd-epi": { age, creatinine: CREATININE_MASS, sex },
  "egfr-mdrd": { age, creatinine: CREATININE_MASS, sex },
  "bun-creatinine-ratio": { bun: BUN, creatinine: CREATININE_MASS },
  bmi: { weight: WEIGHT, height: HEIGHT },
  bsa: { height: HEIGHT, weight: WEIGHT },
  "ideal-body-weight": { sex, height: HEIGHT },
  "adjusted-body-weight": { sex, height: HEIGHT, actualWeight: WEIGHT },
  "anion-gap": { na: SODIUM, cl: CHLORIDE, hco3: BICARBONATE, albumin: ALBUMIN },
  "albumin-corrected-anion-gap": { sodium: SODIUM, chloride: CHLORIDE, bicarbonate: BICARBONATE, albumin: ALBUMIN },
  "corrected-calcium": { calcium: CALCIUM_MASS, albumin: ALBUMIN },
  "corrected-sodium-hyperglycemia": { sodium: SODIUM, glucose: GLUCOSE_MASS },
  // ldl-friedewald: tc/hdl/tg have no fixed unit (a unit select applies to all three), so no per-input UCUM is given.
  "ldl-friedewald": {
    tc: { fhir: { resource: "Observation", loinc: "2093-3" }, loinc: "2093-3" }, // UNVERIFIED: Cholesterol [Mass/volume] in Serum or Plasma
    hdl: { fhir: { resource: "Observation", loinc: "2085-9" }, loinc: "2085-9" }, // UNVERIFIED: Cholesterol in HDL [Mass/volume] in Serum or Plasma
    tg: { fhir: { resource: "Observation", loinc: "2571-8" }, loinc: "2571-8" }, // UNVERIFIED: Triglyceride [Mass/volume] in Serum or Plasma
  },
  "non-hdl-cholesterol": {
    tc: obs("2093-3", "mg/dL"), // UNVERIFIED: Cholesterol [Mass/volume] in Serum or Plasma
    hdl: obs("2085-9", "mg/dL"), // UNVERIFIED: Cholesterol in HDL [Mass/volume] in Serum or Plasma
  },
  "estimated-osmolality": { na: SODIUM, glucose: GLUCOSE_MASS, bun: BUN, measuredOsmolality: plain("mosm/kg") },
  "red-cell-indices": {
    hgb: obs("718-7", "g/dL"), // UNVERIFIED: Hemoglobin [Mass/volume] in Blood
    hct: obs("4544-3", "%"), // UNVERIFIED: Hematocrit [Volume Fraction] of Blood by Automated count
    rbc: obs("789-8", "10*12/L"), // UNVERIFIED: Erythrocytes [#/volume] in Blood by Automated count
  },
  "absolute-cell-count": { wbc: obs("6690-2", "10*9/L"), percent: plain("%") }, // UNVERIFIED: Leukocytes [#/volume] in Blood by Automated count
  inr: { pt: obs("5902-2", "s"), meanNormalPt: plain("s") }, // UNVERIFIED: Prothrombin time (PT)
  "mean-arterial-pressure": {
    sbp: obs("8480-6", "mm[Hg]"), // UNVERIFIED: Systolic blood pressure
    dbp: obs("8462-4", "mm[Hg]"), // UNVERIFIED: Diastolic blood pressure
  },
  // qtc-correction: no LOINC code is given for QT because the right one could not be recalled with confidence.
  "qtc-correction": { qt: plain("ms"), heartRate: obs("8867-4", "/min") }, // UNVERIFIED: Heart rate
}

/** What the primary result is, in UCUM, and a LOINC code where one is known. Result units are the ones the calculators already display. */
export const RESULT_CODING: Record<string, ResultCoding> = {
  "creatinine-clearance": { ucum: "mL/min" }, // no LOINC given: the Cockcroft-Gault code was not recalled with confidence
  "egfr-ckd-epi": { ucum: "mL/min/{1.73_m2}", loinc: "98979-8" }, // UNVERIFIED: believed to be the CKD-EPI 2021 creatinine equation (the formula shown is the 2021 one)
  "egfr-mdrd": { ucum: "mL/min/{1.73_m2}", loinc: "33914-3" }, // UNVERIFIED: believed to be GFR predicted by MDRD
  "bun-creatinine-ratio": {},
  bmi: { ucum: "kg/m2", loinc: "39156-5" }, // UNVERIFIED: Body mass index
  bsa: { ucum: "m2", loinc: "8277-6" }, // UNVERIFIED: Body surface area derived from formula
  "ideal-body-weight": { ucum: "kg" },
  "adjusted-body-weight": { ucum: "kg" },
  "anion-gap": { ucum: "mmol/L", loinc: "33037-3" }, // UNVERIFIED: Anion gap in Serum or Plasma
  "corrected-calcium": { ucum: "mg/dL" },
  "corrected-sodium-hyperglycemia": { ucum: "mmol/L" },
  "non-hdl-cholesterol": { ucum: "mg/dL", loinc: "43396-1" }, // UNVERIFIED: Cholesterol non HDL [Mass/volume] in Serum or Plasma
  "estimated-osmolality": { ucum: "mosm/kg" },
  "absolute-cell-count": { ucum: "10*9/L" },
  "mean-arterial-pressure": { ucum: "mm[Hg]", loinc: "8478-0" }, // UNVERIFIED: Mean blood pressure
  "qtc-correction": { ucum: "ms" },
}

export const getResultCoding = (calculatorId: string): ResultCoding | undefined => RESULT_CODING[calculatorId]

/** Returns the definition with coding added to its inputs. calculate() is the very same function. Inputs without an entry are untouched. */
export function withCodingMetadata(def: CalculatorDefinition): CalculatorDefinition {
  const coding = INPUT_CODING[def.id]
  if (!coding) return def
  const inputs: InputDefinition[] = def.inputs.map((input) => {
    const c = coding[input.id]
    return c ? { ...input, ...c } : input
  })
  return { ...def, inputs }
}
