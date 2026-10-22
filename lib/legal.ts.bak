/**
 * Shared wording and rules for clinical-use notices.
 * Keep the text here so the on-screen notice, the shared/copied result and the
 * Terms of Use page never drift apart.
 */

/** Calculators in these categories can influence treatment or transplant decisions. */
export const HIGH_RISK_CATEGORIES = ["dosing", "oncology", "stem-cell-transplant"] as const

export function isHighRiskCategory(category: string | undefined | null): boolean {
  return !!category && (HIGH_RISK_CATEGORIES as readonly string[]).includes(category)
}

export const CLINICAL_NOTICE_TITLE = "For qualified professionals: verify before use"

export const CLINICAL_NOTICE_BODY =
  "This tool supports, and does not replace, the judgement of a qualified health professional. Check every input and result against the current guideline, product information and your local protocol before acting on it. Do not enter patient-identifying information."

/** Appended to copied and shared results, which leave the app without its on-screen notices. */
export const SHARE_FOOTER =
  "Calculation aid only. Verify against current guidelines and local protocol before clinical use."

export const TERMS_LAST_UPDATED = "12 October 2026"
