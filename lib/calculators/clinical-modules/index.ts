// clinexia-upgrade:phase4 — the tools in this folder, and the ones currently approved.
import type { CalculatorDefinition } from "../types"
import { bloodVolumeCalculator } from "./blood-volume"
import { pecarn2To17Calculator, pecarnUnder2Calculator } from "./pecarn"
import { qsofaCalculator } from "./qsofa"
import { sampsonLdlCalculator } from "./sampson-ldl"
import { selectApproved } from "./review"
import { sofaCalculator } from "./sofa"

export const ALL_CLINICAL_MODULES: CalculatorDefinition[] = [qsofaCalculator, sofaCalculator, pecarnUnder2Calculator, pecarn2To17Calculator, sampsonLdlCalculator, bloodVolumeCalculator]

/** Empty until a record in ./review.ts is approved. */
export function getApprovedClinicalModules(): CalculatorDefinition[] {
  return selectApproved(ALL_CLINICAL_MODULES)
}
