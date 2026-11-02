// clinexia-upgrade:phase4 — approval register for the tools in this folder.
//
// A tool here is part of the calculator library only when a qualified person has approved it. Everything starts
// as pending, so nothing in this folder reaches the registry (or the API, or the app) until you change a record.
// Core must stay free of environment and browser access, so there is deliberately NO preview switch in this file.
//
// To approve a tool:
//   1. Have a clinician read the tool file and the matching record in lib/clinical/evidence.ts.
//   2. Replace { status: "pending" } with an "approved" record (who, credentials, date, what was reviewed).
//   3. Add its entry to FORMULA_VERSIONS and its test vectors (your integration layer). The existing integration
//      tests fail until you do, which is intended: a tool cannot reach EMR clients without them.
//   4. Run the full test suite.
import type { CalculatorDefinition } from "../types"

export type ModuleReview =
  | { status: "pending" }
  | { status: "approved"; reviewer: string; credentials: string; reviewedAt: string; scope: string; notes?: string }

export const CLINICAL_MODULE_REVIEWS: Record<string, ModuleReview> = {
  qsofa: { status: "pending" },
  sofa: { status: "pending" },
  "pecarn-head-injury-under-2": { status: "pending" },
  "pecarn-head-injury-2-to-17": { status: "pending" },
  "ldl-sampson": { status: "pending" },
  "blood-volume-nadler-lemmens": { status: "pending" },
}

/** Pure: the modules whose record is approved. The reviews map is a parameter so this can be tested. */
export function selectApproved(modules: CalculatorDefinition[], reviews: Record<string, ModuleReview> = CLINICAL_MODULE_REVIEWS): CalculatorDefinition[] {
  return modules.filter((m) => reviews[m.id]?.status === "approved")
}
