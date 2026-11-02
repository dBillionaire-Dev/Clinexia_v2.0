// clinexia-upgrade:phase2 — clinical review register.
//
// Content that goes beyond a plain calculation (interpretation bands, emergency dosing) is shown to users
// only when a qualified person has reviewed it. To release an item, replace its { status: "pending" } with
// an "approved" record: who reviewed it, their credentials, the date, and what exactly was reviewed.
//
// New calculator tools (qSOFA, SOFA, PECARN, Sampson LDL, blood volume) have their own register inside the calculator
// library, in clinical-modules/review.ts, because that library cannot read environment variables.
//
// For internal evaluation of bands and emergency dosing, set NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES=1 at build time. Preview content is
// always labelled "pending clinical review" in the UI.

export type ReviewState =
  | { status: "pending" }
  | { status: "approved"; reviewer: string; credentials: string; reviewedAt: string; scope: string; notes?: string }

export const CLINICAL_REVIEWS: Record<string, ReviewState> = {
  "pediatric-sheets:tachycardia": { status: "pending" }, // clinexia-upgrade:phase10
  "pediatric-sheets:shock-fluids": { status: "pending" },
  "pediatric-sheets:anaphylaxis": { status: "pending" },
  "pediatric-sheets:seizure": { status: "pending" },
  "emergency-weight-estimation": { status: "pending" }, // clinexia-upgrade:phase9
  "patient:bmi": { status: "pending" }, // clinexia-upgrade:phase8
  "patient:egfr-ckd-epi": { status: "pending" },
  "patient:hba1c-eag": { status: "pending" },
  "patient:ldl-friedewald": { status: "pending" },
  "patient:ldl-sampson": { status: "pending" },
  "patient:cha2ds2-vasc": { status: "pending" },
  "patient:has-bled": { status: "pending" },
  "patient:mean-arterial-pressure": { status: "pending" },
  "cha2ds2-vasc:bands": { status: "pending" },
  "has-bled:bands": { status: "pending" },
  "emergency-doses": { status: "pending" }, // clinexia-upgrade:phase6
}

export function previewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES === "1"
}

export function isReviewApproved(key: string): boolean {
  return CLINICAL_REVIEWS[key]?.status === "approved"
}

/** True when the content may be shown: reviewed, or preview mode is on. Unknown keys are never released. */
export function isReleased(key: string): boolean {
  if (!(key in CLINICAL_REVIEWS)) return false
  return isReviewApproved(key) || previewEnabled()
}

export function reviewSummary(key: string): string {
  const state = CLINICAL_REVIEWS[key]
  if (!state) return ""
  if (state.status === "approved") return `Reviewed by ${state.reviewer} (${state.credentials}) on ${state.reviewedAt}.`
  return previewEnabled() ? "PREVIEW: pending clinical review. Not for clinical use." : "Pending clinical review."
}
