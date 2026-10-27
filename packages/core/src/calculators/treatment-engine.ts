/**
 * Phase 25: protocol-aware clinical treatment engine primitives.
 *
 * This layer intentionally stores treatment-regimen metadata separately from
 * CalculatorDefinition. It does not prescribe therapy or calculate a drug
 * dose by itself. Drug/regimen entries should only be added when supported by
 * a current, attributable protocol or product reference.
 */

export type TreatmentSpecialty =
  | "oncology"
  | "hematology"
  | "cardiovascular"
  | "transfusion"
  | "stem-cell-transplant"
  | "infectious-disease"
  | "supportive-care"
  | "other"

export type TreatmentPopulation = "adult" | "pediatric" | "neonatal" | "all-ages"

export type DoseBasis =
  | "mg/m2"
  | "mg/kg"
  | "mcg/kg"
  | "units/kg"
  | "units/m2"
  | "AUC"
  | "fixed"
  | "percent"
  | "other"

export interface TreatmentReference {
  source: string
  version: string
  url?: string
  lastVerified: string
  status: "current" | "supporting" | "review-needed"
  note?: string
}

export interface RegimenDrug {
  id: string
  drug: string
  doseBasis: DoseBasis
  dose?: number
  doseUnit?: string
  route?: string
  frequency?: string
  schedule?: string
  maximum?: number
  maximumUnit?: string
  notes?: string[]
}

export type DoseModificationDomain = "hematologic" | "renal" | "hepatic" | "toxicity" | "other"

export type ToxicityType = "peripheral-neuropathy" | "mucositis-stomatitis" | "diarrhoea" | "hand-foot-syndrome" | "cardiac" | "immune-related-adverse-event" | "other"

export type HepaticDysfunction = "none" | "minimal" | "mild" | "moderate" | "severe"

export interface DoseModificationCriteria {
  allOf?: DoseModificationCriteria[]
  anyOf?: DoseModificationCriteria[]
  ancLessThan?: number
  ancAtLeast?: number
  ancLessThanOrEqual?: number
  plateletsLessThan?: number
  plateletsAtLeast?: number
  plateletsLessThanOrEqual?: number
  febrileNeutropenia?: boolean
  renalEgfLessThan?: number
  renalEgfAtLeast?: number
  hepaticDysfunction?: HepaticDysfunction
  bilirubinGreaterThan?: number
  bilirubinAtLeast?: number
  bilirubinLessThan?: number
  astAltGreaterThan?: number
  astAltAtLeast?: number
  astAltLessThanOrEqual?: number
  toxicityType?: ToxicityType
  toxicityGrade?: number
  toxicityGradeAtLeast?: number
  occurrence?: number
  persistentAtNextCycle?: boolean
}

export interface ToxicityDoseModificationContext {
  toxicityType?: ToxicityType
  toxicityGrade?: number
  occurrence?: number
  persistentAtNextCycle?: boolean
}

export interface OrganFunctionDoseModificationContext {
  eGfr?: number
  bilirubin?: number
  astAlt?: number
  hepaticDysfunction?: HepaticDysfunction
}

export interface DoseModificationRule {
  id: string
  trigger: string
  action: string
  domain?: DoseModificationDomain
  appliesTo?: string[]
  criteria?: DoseModificationCriteria
  notes?: string[]
}

export interface HematologicDoseModificationContext {
  anc?: number
  platelets?: number
  febrileNeutropenia?: boolean
}

export interface DoseModificationAssessment {
  ruleId: string
  trigger: string
  action: string
  appliesTo?: string[]
  domain?: DoseModificationDomain
}

function matchesDoseModificationCriteria(
  criteria: DoseModificationCriteria,
  context: HematologicDoseModificationContext & OrganFunctionDoseModificationContext & ToxicityDoseModificationContext,
): boolean {
  if (criteria.allOf?.length && !criteria.allOf.every((item) => matchesDoseModificationCriteria(item, context))) return false
  if (criteria.anyOf?.length && !criteria.anyOf.some((item) => matchesDoseModificationCriteria(item, context))) return false
  if (criteria.ancLessThan !== undefined && !(context.anc !== undefined && context.anc < criteria.ancLessThan)) return false
  if (criteria.ancAtLeast !== undefined && !(context.anc !== undefined && context.anc >= criteria.ancAtLeast)) return false
  if (criteria.ancLessThanOrEqual !== undefined && !(context.anc !== undefined && context.anc <= criteria.ancLessThanOrEqual)) return false
  if (criteria.plateletsLessThan !== undefined && !(context.platelets !== undefined && context.platelets < criteria.plateletsLessThan)) return false
  if (criteria.plateletsAtLeast !== undefined && !(context.platelets !== undefined && context.platelets >= criteria.plateletsAtLeast)) return false
  if (criteria.plateletsLessThanOrEqual !== undefined && !(context.platelets !== undefined && context.platelets <= criteria.plateletsLessThanOrEqual)) return false
  if (criteria.febrileNeutropenia !== undefined && context.febrileNeutropenia !== criteria.febrileNeutropenia) return false
  if (criteria.renalEgfLessThan !== undefined && !(context.eGfr !== undefined && context.eGfr < criteria.renalEgfLessThan)) return false
  if (criteria.renalEgfAtLeast !== undefined && !(context.eGfr !== undefined && context.eGfr >= criteria.renalEgfAtLeast)) return false
  if (criteria.hepaticDysfunction !== undefined && context.hepaticDysfunction !== criteria.hepaticDysfunction) return false
  if (criteria.bilirubinGreaterThan !== undefined && !(context.bilirubin !== undefined && context.bilirubin > criteria.bilirubinGreaterThan)) return false
  if (criteria.bilirubinAtLeast !== undefined && !(context.bilirubin !== undefined && context.bilirubin >= criteria.bilirubinAtLeast)) return false
  if (criteria.bilirubinLessThan !== undefined && !(context.bilirubin !== undefined && context.bilirubin < criteria.bilirubinLessThan)) return false
  if (criteria.astAltGreaterThan !== undefined && !(context.astAlt !== undefined && context.astAlt > criteria.astAltGreaterThan)) return false
  if (criteria.astAltAtLeast !== undefined && !(context.astAlt !== undefined && context.astAlt >= criteria.astAltAtLeast)) return false
  if (criteria.astAltLessThanOrEqual !== undefined && !(context.astAlt !== undefined && context.astAlt <= criteria.astAltLessThanOrEqual)) return false
  if (criteria.toxicityType !== undefined && context.toxicityType !== criteria.toxicityType) return false
  if (criteria.toxicityGrade !== undefined && context.toxicityGrade !== criteria.toxicityGrade) return false
  if (criteria.toxicityGradeAtLeast !== undefined && !(context.toxicityGrade !== undefined && context.toxicityGrade >= criteria.toxicityGradeAtLeast)) return false
  if (criteria.occurrence !== undefined && context.occurrence !== criteria.occurrence) return false
  if (criteria.persistentAtNextCycle !== undefined && context.persistentAtNextCycle !== criteria.persistentAtNextCycle) return false
  return true
}

export function assessDoseModifications(
  regimen: TreatmentRegimen,
  context: HematologicDoseModificationContext & OrganFunctionDoseModificationContext & ToxicityDoseModificationContext,
): DoseModificationAssessment[] {
  if (!regimen.doseModifications?.length) return []

  return regimen.doseModifications
    .filter((rule) => rule.criteria && matchesDoseModificationCriteria(rule.criteria, context))
    .map((rule) => ({
      ruleId: rule.id,
      trigger: rule.trigger,
      action: rule.action,
      appliesTo: rule.appliesTo,
      domain: rule.domain,
    }))
}
export function assessToxicityDoseModifications(
  regimen: TreatmentRegimen,
  context: ToxicityDoseModificationContext,
): DoseModificationAssessment[] {
  if (!regimen.doseModifications?.length) return []

  return regimen.doseModifications
    .filter((rule) => rule.domain === "toxicity" && rule.criteria && matchesDoseModificationCriteria(rule.criteria, context as HematologicDoseModificationContext & OrganFunctionDoseModificationContext & ToxicityDoseModificationContext))
    .map((rule) => ({
      ruleId: rule.id,
      trigger: rule.trigger,
      action: rule.action,
      appliesTo: rule.appliesTo,
      domain: "toxicity" as const,
    }))
}



/**
 * Evaluate only explicitly structured haematological modification rules.
 * This returns protocol guidance; it never changes a calculated dose.
 */
export function assessHematologicDoseModifications(
  regimen: TreatmentRegimen,
  context: HematologicDoseModificationContext,
): DoseModificationAssessment[] {
  if (!regimen.doseModifications?.length) return []

  return regimen.doseModifications
    .filter((rule) => rule.criteria && matchesDoseModificationCriteria(rule.criteria, context))
    .map((rule) => ({
      ruleId: rule.id,
      trigger: rule.trigger,
      action: rule.action,
      appliesTo: rule.appliesTo,
      domain: rule.domain ?? "hematologic",
    }))
}


export interface TreatmentRegimen {
  id: string
  name: string
  specialty: TreatmentSpecialty
  disease: string
  indication: string
  population: TreatmentPopulation
  ageRange?: string
  cycleLength?: string
  cycleCount?: string
  drugs: RegimenDrug[]
  prerequisites?: string[]
  monitoring?: string[]
  doseModifications?: DoseModificationRule[]
  contraindications?: string[]
  warnings?: string[]
  references: TreatmentReference[]
  status: "draft" | "reference-only" | "current"
  notes?: string[]
}


export interface TreatmentDoseCalculationContext {
  bsa?: number
  weightKg?: number
  gfr?: number
}

export interface CalculatedTreatmentDose {
  drug: string
  dose: number
  doseUnit?: string
  route?: string
  frequency?: string
  schedule?: string
  capped: boolean
  calculation: string
}

/**
 * Convert protocol dose bases into patient-specific arithmetic without
 * inventing a regimen, schedule, reduction, or rounding rule.
 */
export function calculateTreatmentRegimenDoses(
  regimen: TreatmentRegimen,
  context: TreatmentDoseCalculationContext,
): CalculatedTreatmentDose[] {
  return regimen.drugs.map((drug) => {
    if (drug.dose === undefined) {
      throw new Error(`No dose is defined for ${drug.drug} in ${regimen.name}.`)
    }

    let dose: number
    let calculation: string
    let calculatedDoseUnit = drug.doseUnit

    switch (drug.doseBasis) {
      case "mg/m2":
      case "units/m2": {
        if (context.bsa === undefined || !Number.isFinite(context.bsa) || context.bsa <= 0) {
          throw new Error(`BSA is required to calculate ${drug.drug}.`)
        }
        dose = drug.dose * context.bsa
        calculatedDoseUnit = drug.doseBasis === "mg/m2" ? "mg" : "International Units"
        calculation = `${drug.dose} ${drug.doseUnit ?? "per m²"} × ${context.bsa} m²`
        break
      }
      case "mg/kg":
      case "mcg/kg":
      case "units/kg": {
        if (context.weightKg === undefined || !Number.isFinite(context.weightKg) || context.weightKg <= 0) {
          throw new Error(`Weight is required to calculate ${drug.drug}.`)
        }
        dose = drug.dose * context.weightKg
        calculatedDoseUnit = drug.doseBasis === "mcg/kg" ? "mcg" : drug.doseBasis === "mg/kg" ? "mg" : "International Units"
        calculation = `${drug.dose} ${drug.doseUnit ?? "per kg"} × ${context.weightKg} kg`
        break
      }
      case "AUC": {
        if (context.gfr === undefined || !Number.isFinite(context.gfr) || context.gfr <= 0) {
          throw new Error(`GFR is required to calculate AUC-based carboplatin dosing for ${drug.drug}.`)
        }
        // Calvert formula: total dose (mg) = target AUC × (GFR + 25).
        // The protocol remains responsible for selecting the target AUC and renal-function method.
        dose = drug.dose * (context.gfr + 25)
        calculatedDoseUnit = "mg"
        calculation = `${drug.dose} AUC × (${context.gfr} mL/min + 25) = ${dose} mg`
        break
      }
      case "fixed":
        dose = drug.dose
        calculation = `Fixed protocol dose: ${drug.dose} ${drug.doseUnit ?? ""}`.trim()
        break
      default:
        throw new Error(`Dose basis ${drug.doseBasis} is not supported by the patient-specific engine yet (${drug.drug}).`)
    }

    const capped = drug.maximum !== undefined && dose > drug.maximum
    if (capped) dose = drug.maximum as number

    return {
      drug: drug.drug,
      dose,
      doseUnit: calculatedDoseUnit,
      route: drug.route,
      frequency: drug.frequency,
      schedule: drug.schedule ?? drug.frequency,
      capped,
      calculation: capped
        ? `${calculation}  to  capped at ${drug.maximum} ${drug.maximumUnit ?? drug.doseUnit ?? ""}`.trim()
        : calculation,
    }
  })
}

export interface TreatmentSearchOptions {
  specialty?: TreatmentSpecialty
  population?: TreatmentPopulation
}

/** Return a regimen only when its identifier exists in the registry. */
export function getTreatmentRegimenById(
  regimens: TreatmentRegimen[],
  id: string,
): TreatmentRegimen | undefined {
  return regimens.find((regimen) => regimen.id === id)
}

export function getTreatmentRegimensBySpecialty(
  regimens: TreatmentRegimen[],
  specialty: TreatmentSpecialty,
): TreatmentRegimen[] {
  return regimens.filter((regimen) => regimen.specialty === specialty)
}

export function searchTreatmentRegimens(
  regimens: TreatmentRegimen[],
  query: string,
  options: TreatmentSearchOptions = {},
): TreatmentRegimen[] {
  const q = query.trim().toLowerCase()

  return regimens.filter((regimen) => {
    if (options.specialty && regimen.specialty !== options.specialty) return false
    if (options.population && regimen.population !== options.population) return false
    if (!q) return true

    const haystack = [
      regimen.name,
      regimen.disease,
      regimen.indication,
      regimen.specialty,
      regimen.population,
      ...regimen.drugs.map((drug) => drug.drug),
    ]
      .join(" ")
      .toLowerCase()

    return haystack.includes(q)
  })
}

/**
 * Structural validation only. This intentionally cannot decide whether a
 * clinical regimen is safe, appropriate, or current.
 */
export function validateTreatmentRegimen(regimen: TreatmentRegimen): string[] {
  const errors: string[] = []

  if (!regimen.id.trim()) errors.push("Regimen id is required.")
  if (!regimen.name.trim()) errors.push("Regimen name is required.")
  if (!regimen.disease.trim()) errors.push("Disease is required.")
  if (!regimen.indication.trim()) errors.push("Indication is required.")
  if (!regimen.drugs.length) errors.push("At least one regimen drug is required.")
  if (!regimen.references.length) errors.push("At least one protocol/reference is required.")

  const drugIds = new Set<string>()
  for (const drug of regimen.drugs) {
    if (!drug.id.trim()) errors.push("Every regimen drug requires an id.")
    if (drugIds.has(drug.id)) errors.push(`Duplicate regimen drug id: ${drug.id}.`)
    drugIds.add(drug.id)

    if (!drug.drug.trim()) errors.push(`Drug ${drug.id || "(unnamed)"} requires a name.`)
    if (drug.dose !== undefined && (!Number.isFinite(drug.dose) || drug.dose < 0)) {
      errors.push(`Drug ${drug.id} has an invalid dose.`)
    }
    if (drug.maximum !== undefined && (!Number.isFinite(drug.maximum) || drug.maximum < 0)) {
      errors.push(`Drug ${drug.id} has an invalid maximum dose.`)
    }
  }

  for (const reference of regimen.references) {
    if (!reference.source.trim()) errors.push("Every reference requires a source.")
    if (!reference.version.trim()) errors.push("Every reference requires a version.")
    if (!reference.lastVerified.trim()) errors.push("Every reference requires a verification date.")
  }

  return errors
}

/** Validate a complete regimen registry for duplicate IDs and malformed entries. */
export function validateTreatmentRegistry(regimens: TreatmentRegimen[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()

  for (const regimen of regimens) {
    if (ids.has(regimen.id)) errors.push(`Duplicate treatment regimen id: ${regimen.id}.`)
    ids.add(regimen.id)
    errors.push(...validateTreatmentRegimen(regimen).map((error) => `${regimen.id}: ${error}`))
  }

  return errors
}
