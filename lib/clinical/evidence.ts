// clinexia-upgrade:phase2 — evidence records.
//
// Each record states what kind of result a tool gives, who it is for, where it comes from, and its limits.
// Rules for editing this file:
//  - Add a source only after opening it. Every url must resolve (run scripts/verify-evidence-links.mjs).
//  - Do not add a band or threshold you cannot point to in a listed source.
//  - Bands are shown to users only when review.ts releases "<id>:bands".

import { findBand, type Band } from "./interpretation"
import { isReleased } from "./review"

export type ResultKind = "risk-score" | "severity-score" | "screening-score" | "decision-rule" | "calculation"

export interface EvidenceSource {
  title: string
  citation: string
  url: string
}

export interface EvidenceRecord {
  calculatorId: string
  resultKind: ResultKind
  intendedPopulation: string
  notIntendedFor?: string[]
  sources: EvidenceSource[]
  limitations: string[]
  bands?: Band[]
  /** Bump when any text, source or band in this record changes. */
  contentVersion: string
}

export const RESULT_KIND_TEXT: Record<ResultKind, string> = {
  "risk-score": "Risk score. It estimates the likelihood of an outcome in a defined population. It is not a diagnosis and not a treatment order.",
  "severity-score": "Severity score. It describes the degree of organ dysfunction. It is not a diagnosis and not a treatment order.",
  "screening-score": "Screening score. A positive result prompts further assessment. It is not a diagnosis.",
  "decision-rule": "Clinical decision rule. It supports, and does not replace, the clinician's judgement and local protocol.",
  calculation: "Calculated estimate. A published formula applied to the values you entered. It is an estimate, not a measurement.",
}

const LIP_2010: EvidenceSource = {
  title: "Lip et al. 2010: CHA2DS2-VASc derivation (Euro Heart Survey)",
  citation: "Lip GYH, Nieuwlaat R, Pisters R, Lane DA, Crijns HJGM. Chest. 2010;137(2):263-272.",
  url: "https://doi.org/10.1378/chest.09-1584",
}
const ACC_AHA_AF_2023: EvidenceSource = {
  title: "2023 ACC/AHA/ACCP/HRS atrial fibrillation guideline",
  citation: "Joglar JA, Chung MK, Armbruster AL, et al. J Am Coll Cardiol. 2024;83(1):109-279.",
  url: "https://doi.org/10.1016/j.jacc.2023.08.017",
}
const ESC_AF_2024: EvidenceSource = {
  title: "2024 ESC atrial fibrillation guidelines",
  citation: "Van Gelder IC, Rienstra M, Bunting KV, et al. Eur Heart J. 2024;45(36):3314-3414.",
  url: "https://doi.org/10.1093/eurheartj/ehae176",
}
const PISTERS_2010: EvidenceSource = {
  title: "Pisters et al. 2010: HAS-BLED derivation (Euro Heart Survey)",
  citation: "Pisters R, Lane DA, Nieuwlaat R, de Vos CB, Crijns HJ, Lip GY. Chest. 2010;138(5):1093-1100.",
  url: "https://doi.org/10.1378/chest.10-0134",
}
export const SEYMOUR_2016: EvidenceSource = {
  title: "Seymour et al. 2016: clinical criteria for sepsis (qSOFA)",
  citation: "Seymour CW, Liu VX, Iwashyna TJ, et al. JAMA. 2016;315(8):762-774.",
  url: "https://doi.org/10.1001/jama.2016.0288",
}
export const SINGER_2016: EvidenceSource = {
  title: "Sepsis-3 definitions",
  citation: "Singer M, Deutschman CS, Seymour CW, et al. JAMA. 2016;315(8):801-810.",
  url: "https://doi.org/10.1001/jama.2016.0287",
}
export const VINCENT_1996: EvidenceSource = {
  title: "Vincent et al. 1996: the SOFA score",
  citation: "Vincent JL, Moreno R, Takala J, et al. Intensive Care Med. 1996;22(7):707-710.",
  url: "https://doi.org/10.1007/BF01709751",
}
export const SSC_2026: EvidenceSource = {
  title: "Surviving Sepsis Campaign adult guidelines 2026",
  citation: "Prescott HC, Antonelli M, Alhazzani W, et al. Intensive Care Med. 2026;52(5):863-936.",
  url: "https://doi.org/10.1007/s00134-026-08361-1",
}
export const KUPPERMANN_2009: EvidenceSource = {
  title: "Kuppermann et al. 2009: PECARN pediatric head trauma rules",
  citation: "Kuppermann N, Holmes JF, Dayan PS, et al. Lancet. 2009;374(9696):1160-1170 (erratum: Lancet. 2014;383(9914):308).",
  url: "https://doi.org/10.1016/S0140-6736(09)61558-0",
}

const CHA2DS2_VASC: EvidenceRecord = {
  calculatorId: "cha2ds2-vasc",
  resultKind: "risk-score",
  intendedPopulation: "Adults with atrial fibrillation. The score was derived in patients with non-valvular atrial fibrillation.",
  notIntendedFor: [
    "Deciding anticoagulation in atrial fibrillation with a mechanical heart valve or moderate-to-severe mitral stenosis; those have separate indications.",
  ],
  sources: [LIP_2010, ACC_AHA_AF_2023, ESC_AF_2024],
  limitations: [
    "It estimates stroke risk only. It does not estimate bleeding risk (see HAS-BLED).",
    "The 2023 ACC/AHA/ACCP/HRS guideline bases anticoagulation on estimated annual stroke risk of 2% or more, which it maps to a score of 2 or more in men and 3 or more in women, and it allows other validated risk scores.",
    "The 2024 ESC guideline uses CHA2DS2-VA, which leaves out the sex-category point (subtract 1 for female patients).",
    "A score alone is not a treatment decision.",
  ],
  bands: [
    { id: "below-male", min: 0, max: 1, appliesTo: { sex: "male" }, label: "Below the 2%/year guideline level", meaning: "Under the level at which the 2023 ACC/AHA/ACCP/HRS guideline recommends anticoagulation for most patients. The guideline suggests considering other stroke-risk modifiers and shared decision-making rather than relying on the score alone.", sourceIds: [1] },
    { id: "at-male", min: 2, max: 9, appliesTo: { sex: "male" }, label: "At or above the 2%/year guideline level", meaning: "At or above the estimated annual stroke risk (2% or more) at which the 2023 ACC/AHA/ACCP/HRS guideline recommends anticoagulation for most patients with atrial fibrillation, after individual assessment.", sourceIds: [1] },
    { id: "below-female", min: 0, max: 2, appliesTo: { sex: "female" }, label: "Below the 2%/year guideline level", meaning: "Under the level at which the 2023 ACC/AHA/ACCP/HRS guideline recommends anticoagulation for most patients. The guideline suggests considering other stroke-risk modifiers and shared decision-making rather than relying on the score alone.", sourceIds: [1] },
    { id: "at-female", min: 3, max: 9, appliesTo: { sex: "female" }, label: "At or above the 2%/year guideline level", meaning: "At or above the estimated annual stroke risk (2% or more) at which the 2023 ACC/AHA/ACCP/HRS guideline recommends anticoagulation for most patients with atrial fibrillation, after individual assessment.", sourceIds: [1] },
  ],
  contentVersion: "2026-10-25.1",
}

const HAS_BLED: EvidenceRecord = {
  calculatorId: "has-bled",
  resultKind: "risk-score",
  intendedPopulation: "Adults with atrial fibrillation, to estimate 1-year risk of major bleeding. It was derived in the Euro Heart Survey cohort.",
  sources: [PISTERS_2010, ACC_AHA_AF_2023],
  limitations: [
    "The 2023 ACC/AHA/ACCP/HRS guideline says bleeding-risk scores should not be used on their own to decide eligibility for anticoagulation. Use them to find and correct modifiable bleeding-risk factors and to inform decisions.",
    "Each factor has a published definition (for example, abnormal renal or liver function). Check the help text on each question.",
    "Reviewer note: a commonly quoted cut-point (score of 3 or more) is not included because it was not verified against a listed source in this build.",
  ],
  bands: [
    { id: "any", min: 0, max: 9, label: "Higher score = higher estimated bleeding risk", meaning: "Higher scores indicate a higher estimated 1-year risk of major bleeding in the derivation cohort. Use the score to find and modify bleeding-risk factors, not to withhold indicated anticoagulation on its own.", sourceIds: [0, 1] },
  ],
  contentVersion: "2026-10-25.1",
}

const RECORDS: Record<string, EvidenceRecord> = {
  "cha2ds2-vasc": CHA2DS2_VASC,
  "has-bled": HAS_BLED,
}

/** Used by the Phase 4 modules to register their records. */
export function registerEvidence(record: EvidenceRecord): void {
  RECORDS[record.calculatorId] = record
}

export function getEvidence(calculatorId: string): EvidenceRecord | null {
  return RECORDS[calculatorId] ?? null
}

export function allEvidence(): EvidenceRecord[] {
  return Object.values(RECORDS)
}

export interface BandLookup {
  band: Band | null
  /** True when a band exists for this tool but is withheld because it has not been clinically reviewed. */
  withheld: boolean
}

export function lookupBand(calculatorId: string, value: number, inputs: Record<string, string | number> = {}): BandLookup {
  const record = getEvidence(calculatorId)
  if (!record?.bands?.length) return { band: null, withheld: false }
  if (!isReleased(`${calculatorId}:bands`)) return { band: null, withheld: true }
  return { band: findBand(record.bands, value, inputs), withheld: false }
}

// clinexia-upgrade:phase4 evidence — records for the tools in the calculator library's clinical-modules folder.
// They are registered here, in the app layer, because the library itself cannot hold sources or review text.
// Source links marked "search" open a PubMed search because no identifier was verified; replace with a DOI or PMID when you have one.
const SAMPSON_2020: EvidenceSource = {
  title: "Sampson et al. 2020: new equation for calculated LDL-C (NIH equation)",
  citation: "Sampson M, Ling C, Sun Q, et al. JAMA Cardiol. 2020;5(5):540-548.",
  url: "https://doi.org/10.1001/jamacardio.2020.0013",
}
const NADLER_1962: EvidenceSource = {
  title: "Nadler et al. 1962: prediction of blood volume in normal human adults (PubMed search)",
  citation: "Nadler SB, Hidalgo JH, Bloch T. Surgery. 1962;51(2):224-232.",
  url: "https://pubmed.ncbi.nlm.nih.gov/?term=Nadler+Hidalgo+Bloch+prediction+of+blood+volume+in+normal+human+adults",
}
const LEMMENS_2006: EvidenceSource = {
  title: "Lemmens et al. 2006: estimating blood volume in obese and morbidly obese patients (PubMed search)",
  citation: "Lemmens HJM, Bernstein DP, Brodsky JB. Obes Surg. 2006;16(6):773-776.",
  url: "https://pubmed.ncbi.nlm.nih.gov/?term=Lemmens+Bernstein+Brodsky+estimating+blood+volume+in+obese+and+morbidly+obese+patients",
}

registerEvidence({
  calculatorId: "qsofa",
  resultKind: "screening-score",
  intendedPopulation: "Adults with suspected infection outside the ICU.",
  notIntendedFor: ["Children", "Use as the only sepsis screening tool"],
  sources: [SEYMOUR_2016, SINGER_2016, SSC_2026],
  limitations: ["Insensitive as a rule-out. The 2026 Surviving Sepsis Campaign guideline recommends other tools (NEWS, NEWS2, MEWS, SIRS) over qSOFA as a single screening tool."],
  contentVersion: "2026-10-26.1",
})
registerEvidence({
  calculatorId: "sofa",
  resultKind: "severity-score",
  intendedPopulation: "Adults with suspected or confirmed infection, to describe organ dysfunction.",
  notIntendedFor: ["Children", "Stand-alone diagnosis of sepsis"],
  sources: [VINCENT_1996, SINGER_2016, SSC_2026],
  limitations: ["Needs a baseline score to apply the Sepsis-3 definition (acute change of 2 or more points)."],
  contentVersion: "2026-10-26.1",
})
for (const [id, pop] of [["pecarn-head-injury-under-2", "Children under 2 years"], ["pecarn-head-injury-2-to-17", "Children aged 2 to under 18 years"]] as const) {
  registerEvidence({
    calculatorId: id,
    resultKind: "decision-rule",
    intendedPopulation: `${pop} with blunt head trauma within 24 hours and GCS 14 to 15.`,
    notIntendedFor: ["Penetrating trauma", "GCS below 14", "Known brain tumor, ventricular shunt, bleeding disorder, or neuroimaging already done"],
    sources: [KUPPERMANN_2009],
    limitations: ["Risk percentages come from the derivation and validation data and describe groups, not an individual child."],
    contentVersion: "2026-10-26.1",
  })
}
registerEvidence({
  calculatorId: "ldl-sampson",
  resultKind: "calculation",
  intendedPopulation: "Adults with a lipid panel when a direct LDL measurement is not available, including when triglycerides are above the Friedewald limit. Validated for triglycerides up to 800 mg/dL (9.0 mmol/L).",
  notIntendedFor: ["Triglycerides above 800 mg/dL (9.0 mmol/L): use a direct LDL measurement"],
  sources: [SAMPSON_2020],
  limitations: ["An estimate, not a measured value. A direct LDL measurement is preferred when triglycerides are high."],
  contentVersion: "2026-10-26.1",
})
registerEvidence({
  calculatorId: "blood-volume-nadler-lemmens",
  resultKind: "calculation",
  intendedPopulation: "Adults (18 years or over), for an estimate of total blood volume. Lemmens is intended to cover obesity as well.",
  notIntendedFor: ["Children and neonates", "Pregnancy"],
  sources: [NADLER_1962, LEMMENS_2006],
  limitations: ["Population equations: individual blood volume varies.", "Red cell and plasma volume use the venous PCV as entered. Whole-body hematocrit is generally lower, so that split is approximate."],
  contentVersion: "2026-10-26.1",
})
