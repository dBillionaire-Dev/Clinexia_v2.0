import type { CalculatorDefinition } from "./types"
import { EVERYDAY_REFERENCES } from "./everyday-references"

export interface CalculatorReference {
  source: string
  version: string
  url?: string
  applicablePopulation?: string
  indication?: string
  lastVerified: string
  status?: "current" | "review-needed" | "supporting"
  note?: string
}

const VERIFIED_ON = "2026-09-15"

const WHO_MALARIA: CalculatorReference = {
  source: "World Health Organization  -  WHO guidelines for malaria",
  version: "10 September 2026",
  url: "https://www.who.int/publications/i/item/guidelines-for-malaria/",
  applicablePopulation: "Patients with malaria; use the specific regimen and weight/age bands shown by the calculator.",
  lastVerified: VERIFIED_ON,
  status: "current",
}

const WHO_AWARE: CalculatorReference = {
  source: "World Health Organization  -  AWaRe antibiotic book",
  version: "2022 edition",
  url: "https://www.who.int/publications/i/item/9789240062382",
  applicablePopulation: "Children and adults for the infection-specific regimens covered by the source.",
  lastVerified: VERIFIED_ON,
  status: "supporting",
  note: "WHO states that the AWaRe antibiotic book is being updated to reflect newer 2024–2025 guidelines. Verify newer syndrome-specific guidance where applicable.",
}

const WHO_INFANTS: CalculatorReference = {
  source: "World Health Organization  -  Serious bacterial infections in infants aged 0–59 days",
  version: "8 December 2024 guideline",
  url: "https://www.who.int/publications/i/item/9789240102903/",
  applicablePopulation: "Infants aged 0–59 days with suspected serious bacterial infection.",
  lastVerified: VERIFIED_ON,
  status: "current",
}

const TDM_VANCOMYCIN: CalculatorReference = {
  source: "ASHP/IDSA/PIDS/SIDP  -  Vancomycin monitoring consensus guideline",
  version: "2020 consensus guideline",
  url: "https://www.idsociety.org/practice-guideline/vancomycin/",
  applicablePopulation: "Serious invasive MRSA infections where AUC-guided monitoring is applicable.",
  lastVerified: VERIFIED_ON,
  status: "supporting",
  note: "AUC targets and monitoring strategy require patient-specific pharmacokinetic context; this calculator is a target/check aid, not a dosing model.",
}


const LINEZOLID_REFERENCE: CalculatorReference = {
  source: "World Health Organization  -  AWaRe antibiotic book",
  version: "2022 edition",
  url: "https://www.who.int/publications/i/item/9789240062382",
  applicablePopulation: "Selected pediatric and neonatal patients for reserve-antibiotic use.",
  indication: "Selected serious invasive Gram-positive infections; use only when the specific indication is appropriate.",
  lastVerified: VERIFIED_ON,
  status: "supporting",
  note: "WHO states pediatric empiric use should be limited to very selected seriously ill patients with invasive infections known to be colonized with VRE or VRSA. Verify current local stewardship guidance.",
}

const DOXYCYCLINE_REFERENCE: CalculatorReference = {
  source: "WHO Model Formulary for Children",
  version: "2010 edition",
  url: "https://iris.who.int/bitstream/10665/44309/1/9789241599320_eng.pdf",
  applicablePopulation: "Children over 8 years for bacterial infections covered by the source.",
  indication: "Bacterial infections; indication-specific current guidance takes precedence.",
  lastVerified: VERIFIED_ON,
  status: "supporting",
  note: "This is older supporting guidance. Verify against a current indication-specific guideline before use.",
}


const WHO_PNEUMONIA_2024: CalculatorReference = {
  source: "World Health Organization  -  Guideline on management of pneumonia and diarrhoea in children up to 10 years of age",
  version: "31 December 2024 guideline",
  url: "https://www.who.int/publications/i/item/9789240103412",
  applicablePopulation: "Children aged 2–59 months with pneumonia presentations covered by the guideline.",
  indication: "Fast breathing only or chest indrawing without general danger signs.",
  lastVerified: VERIFIED_ON,
  status: "current",
  note: "The calculator exposes only the specific oral-amoxicillin regimens represented by the guideline and does not cover general danger signs, treatment failure or HIV-specific management.",
}


const WHO_ORS_2025: CalculatorReference = {
  source: "World Health Organization  -  Clinical tools for cholera / diarrhoeal rehydration",
  version: "2025 clinical tool",
  url: "https://iris.who.int/bitstream/handle/10665/379760/B09194-eng.pdf?sequence=1",
  applicablePopulation: "Children with some dehydration for whom oral rehydration is appropriate.",
  indication: "WHO Plan B oral rehydration: 75 mL/kg ORS over 4 hours.",
  lastVerified: VERIFIED_ON,
  status: "current",
  note: "Use after clinical assessment confirms some dehydration and suitability for oral/enteral rehydration; reassess after 4 hours. Severe dehydration or shock requires the applicable emergency rehydration protocol.",
}

const WHO_ORS_HOME_SUPPORTING: CalculatorReference = {
  source: "World Health Organization  -  The treatment of diarrhoea",
  version: "4th revision, 2005; supporting home-treatment guidance",
  url: "https://www.who.int/publications/i/item/9241593180",
  applicablePopulation: "Children receiving home/maintenance oral rehydration after loose stools.",
  indication: "Extra ORS after each loose stool: 50–100 mL under 2 years; 100–200 mL from 2 to under 10 years; older children take as much as wanted.",
  lastVerified: VERIFIED_ON,
  status: "supporting",
  note: "Older WHO guidance retained here as supporting protocol context. Verify the current national/facility Plan A protocol before use; this calculator does not assess dehydration.",
}

const WHO_DIARRHOEA_2024: CalculatorReference = {
  source: "World Health Organization  -  Guideline on management of pneumonia and diarrhoea in children up to 10 years of age",
  version: "31 December 2024 guideline",
  url: "https://www.who.int/publications/i/item/9789240103412",
  applicablePopulation: "Children up to 10 years with acute watery or persistent diarrhoea.",
  indication: "Adjunctive oral zinc treatment for acute watery or persistent diarrhoea.",
  lastVerified: VERIFIED_ON,
  status: "current",
  note: "The 2024 guideline suggests 5 mg oral zinc; treatment duration follows the existing 10–14 day recommendation. Verify the actual product's elemental-zinc content.",
}


const WHO_MAINTENANCE_FLUID: CalculatorReference = {
  source: "World Health Organization  -  Handbook for clinical management of dengue / normal maintenance IV fluid calculation",
  version: "WHO clinical handbook",
  url: "https://iris.who.int/bitstream/handle/10665/76887/9789241504713_eng.pdf?sequence=1",
  applicablePopulation: "Children requiring normal maintenance intravenous fluid calculation.",
  indication: "Normal maintenance IV fluid rate using the Holliday-Segar weight formula.",
  lastVerified: VERIFIED_ON,
  status: "supporting",
  note: "WHO describes 4 mL/kg/hour for the first 10 kg, 2 mL/kg/hour for the next 10 kg and 1 mL/kg/hour for subsequent kg. The source notes that ideal body weight may be used for overweight/obese patients. Clinical condition and local protocol determine the actual fluid plan.",
}


const PEDIATRIC_FLUID_DEFICIT: CalculatorReference = {
  source: "World Health Organization  -  The treatment of diarrhoea",
  version: "4th revision, 2005; supporting fluid-deficit calculation guidance",
  url: "https://www.who.int/publications/i/item/9241593180",
  applicablePopulation: "Children with clinically assessed dehydration requiring an estimated fluid deficit calculation.",
  indication: "Estimated fluid deficit from clinician-assessed dehydration percentage.",
  lastVerified: VERIFIED_ON,
  status: "supporting",
  note: "This reference supports the mathematical deficit estimate. It does not determine dehydration severity, route, fluid type, rate or replacement schedule; use the current applicable WHO, national or facility rehydration protocol.",
}

const ONCOLOGY_REGIMEN: CalculatorReference = {
  source: "eviQ  -  Calculating anti-cancer drug doses / source protocol registry",
  version: "Current eviQ education and Clinexia protocol registry",
  url: "https://education.eviq.org.au/getmedia/aa5ddb9b-b698-4cdd-91de-9c0564ec775e/ADAC-V4-M4-Workbook-Adult-v2.aspx",
  applicablePopulation: "Patients receiving a specifically selected source-backed oncology regimen in Clinexia.",
  lastVerified: VERIFIED_ON,
  status: "supporting",
  note: "BSA-based anti-cancer dosing is protocol-dependent. The selected regimen source remains authoritative for indication, population, schedule, dose modifications and administration requirements.",
}

const ONCOLOGY_REGIMEN_IDS = new Set(["oncology-regimen-dose"])

const GENERIC: CalculatorReference = {
  source: "Clinexia calculation method",
  version: "Mathematical reference",
  applicablePopulation: "General calculation use; no drug-specific regimen is selected.",
  lastVerified: VERIFIED_ON,
  status: "current",
  note: "For drug-specific decisions, use the applicable current product information, guideline and local protocol.",
}

const CATEGORY_REFERENCES: Partial<Record<CalculatorDefinition["category"], CalculatorReference>> = {
  general: {
    source: "National Cancer Institute  -  Body Surface Area formula reference; Clinexia general calculation methods",
    version: "Mosteller formula reference",
    url: "https://ctep.cancer.gov/branches/pmb/inside_pmb/nov2011.pdf",
    applicablePopulation: "General calculation use; verify the intended population and formula for the specific clinical application.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "General calculators may have method-specific references; use the calculator's formula and limitations as the immediate scope.",
  },
  hematology: {
    source: "American Society of Hematology  -  Platelet transfusion refractoriness / corrected count increment guidance",
    version: "ASH Education Program 2020",
    url: "https://ashpublications.org/hematology/article/2020/1/527/474305/Platelet-transfusion-refractoriness-how-do-I",
    applicablePopulation: "Hematology and transfusion calculations covered by the specific calculator.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "Individual hematology calculators may require a more specific disease- or assay-specific reference.",
  },
  chemistry: {
    source: "Clinexia clinical chemistry formula references",
    version: "Formula reference set",
    applicablePopulation: "Clinical chemistry calculations in the Clinexia registry.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "Formula-specific references are provided where available; remaining chemistry tools are mathematical calculation aids and require method-specific laboratory validation where clinically applied.",
  },
  microbiology: {
    source: "Clinical and Laboratory Standards Institute  -  microbiology and antimicrobial susceptibility testing standards",
    version: "M100 Ed36 / M07 Ed12, 2026",
    url: "https://clsi.org/shop/packages/ast-m100-pkg/",
    applicablePopulation: "Microbiology laboratory calculations and workflows; apply the laboratory's validated method.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "CLSI standards govern validated microbiology methods; these calculators do not establish organism identity, susceptibility interpretation, or clinical significance.",
  },
  "lab-solutions": {
    source: "World Health Organization  -  Laboratory Quality Management System: Handbook",
    version: "2011 handbook",
    url: "https://www.who.int/publications-detail-redirect/9789241548274",
    applicablePopulation: "Laboratory preparation and quality-management context.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "Preparation calculations must be performed within the laboratory's validated SOPs and reagent instructions.",
  },
  spectrophotometry: {
    source: "NIST  -  Standard Reference Materials / spectrophotometric measurement references",
    version: "NIST reference material",
    url: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nbsspecialpublication260-81.pdf",
    applicablePopulation: "Spectrophotometric calculations represented by the calculator.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "Instrument qualification, blanking, calibration, linearity and method validation remain laboratory responsibilities.",
  },
  cardiovascular: {
    source: "American College of Cardiology  -  AnticoagEvaluator / cardiovascular risk tools",
    version: "Updated through 2023 ACC/AHA/ACCP/HRS AF guidance; app updated November 2024",
    url: "https://www.acc.org/anticoagevaluator",
    applicablePopulation: "Cardiovascular risk calculations covered by the specific calculator.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "Scores support assessment and do not by themselves determine treatment. Use the current applicable guideline.",
  },
  "stem-cell-transplant": {
    source: "EBMT  -  The EBMT Handbook, 2nd edition",
    version: "Second edition, 2024",
    url: "https://www.ebmt.org/sites/default/files/2024-04/978-3-031-44080-9.pdf",
    applicablePopulation: "Hematopoietic cell transplantation and cellular therapy calculations represented by the calculator.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "Transplant protocols, graft specifications and institutional procedures take precedence for patient-specific decisions.",
  },
  oncology: {
    source: "eviQ  -  oncology protocol and anti-cancer treatment resources",
    version: "Current source-backed Clinexia oncology registry",
    url: "https://www.eviq.org.au/",
    applicablePopulation: "Oncology calculations represented by the selected calculator or regimen.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "The selected current regimen/protocol remains authoritative for indication, population, schedule, dose modification and administration requirements.",
  },
}


const CHEMISTRY_REFERENCES: Record<string, CalculatorReference> = {
  "ldl-friedewald": {
    source: "Friedewald equation  -  peer-reviewed validation literature",
    version: "Published validation literature; verify assay-specific applicability",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9106156/",
    applicablePopulation: "Use for LDL-C estimation when the calculator's input assumptions are met.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "Friedewald estimation has known limitations, including high triglycerides and low LDL-C; direct or alternative validated methods may be appropriate.",
  },
  "non-hdl-cholesterol": {
    source: "Peer-reviewed lipid laboratory guidance  -  non-HDL cholesterol calculation",
    version: "Current supporting literature",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5778427/",
    applicablePopulation: "Lipid profile calculation use.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
  },
  "hba1c-eag": {
    source: "NIDDK  -  The A1C Test & Diabetes / ADAG relationship",
    version: "Current NIDDK patient/laboratory information",
    url: "https://www.niddk.nih.gov/health-information/diagnostic-tests/a1c-test",
    applicablePopulation: "HbA1c results for estimating average glucose; eAG is a population-derived estimate and may not equal an individual's measured average glucose.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
  },
  "corrected-sodium-hyperglycemia": {
    source: "Peer-reviewed review  -  corrected serum sodium in hyperglycemic crises",
    version: "Published clinical review",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7479837/",
    applicablePopulation: "Hyperglycemia-associated corrected sodium estimation.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "Correction coefficients vary in the literature; the calculator identifies the coefficient used by its formula and does not determine fluid therapy.",
  },
  "estimated-osmolality": {
    source: "Peer-reviewed serum osmolality calculation literature",
    version: "Current supporting literature",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4596287/",
    applicablePopulation: "Estimated serum osmolality from measured laboratory values.",
    lastVerified: VERIFIED_ON,
    status: "supporting",
    note: "Calculated osmolality is an estimate; measured osmolality and the laboratory's validated method take precedence when available.",
  },
}

const MALARIA_IDS = new Set([
  "artemether-lumefantrine-uncomplicated-malaria",
  "artesunate-amodiaquine-uncomplicated-malaria",
  "artesunate-mefloquine-uncomplicated-malaria",
  "dihydroartemisinin-piperaquine-uncomplicated-malaria",
  "artesunate-sulfadoxine-pyrimethamine-uncomplicated-malaria",
  "artesunate-pyronaridine-uncomplicated-malaria",
  "artesunate-severe-malaria",
])

const INFANT_IDS = new Set([
  "who-young-infant-sepsis-pneumonia",
  "who-young-infant-meningitis",
])

const VANCOMYCIN_IDS = new Set(["vancomycin-pediatric-dose", "vancomycin-auc24-target-check"])

const GENERIC_DOSING_IDS = new Set([
  "mg-per-kg-dose",
  "mg-per-kg-per-day-dose",
  "mg-per-m2-dose",
  "dose-per-administration",
  "dose-to-volume",
  "drug-concentration",
  "infusion-rate",
  "drops-per-minute",
  "maximum-dose-check",
  "oral-liquid-dose-volume",
  "tablet-capsule-dose-count",
  "dose-volume-rounding",
  "loading-dose",
  "maintenance-dose",
  "infusion-duration",
  "course-total-dose",
])

export function getCalculatorReferences(definition: CalculatorDefinition): CalculatorReference[] {
  if (EVERYDAY_REFERENCES[definition.id]) return [EVERYDAY_REFERENCES[definition.id]]
  if (CHEMISTRY_REFERENCES[definition.id]) return [CHEMISTRY_REFERENCES[definition.id]]
  if (MALARIA_IDS.has(definition.id)) return [WHO_MALARIA]
  if (INFANT_IDS.has(definition.id)) return [WHO_INFANTS]
  if (definition.id === "who-pediatric-pneumonia-regimen") return [WHO_PNEUMONIA_2024]
  if (definition.id === "who-pediatric-ors-plan-b") return [WHO_ORS_2025]
  if (definition.id === "who-pediatric-ors-ongoing-loss") return [WHO_ORS_HOME_SUPPORTING]
  if (definition.id === "who-pediatric-maintenance-fluid") return [WHO_MAINTENANCE_FLUID]
  if (definition.id === "pediatric-fluid-deficit") return [PEDIATRIC_FLUID_DEFICIT]
  if (definition.id === "who-pediatric-diarrhoea-zinc") return [WHO_DIARRHOEA_2024]
  if (VANCOMYCIN_IDS.has(definition.id)) return [TDM_VANCOMYCIN]
  if (definition.id === "linezolid-pediatric-dose") return [LINEZOLID_REFERENCE]
  if (definition.id === "doxycycline-pediatric-dose") return [DOXYCYCLINE_REFERENCE]
  if (ONCOLOGY_REGIMEN_IDS.has(definition.id)) return [ONCOLOGY_REGIMEN]
  if (GENERIC_DOSING_IDS.has(definition.id)) return [GENERIC]
  if (definition.category === "dosing") return [WHO_AWARE]
  return CATEGORY_REFERENCES[definition.category] ? [CATEGORY_REFERENCES[definition.category]!] : [GENERIC]
}
