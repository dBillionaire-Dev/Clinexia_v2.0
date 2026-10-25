import type { CalculatorDefinition } from "@/lib/calculators/types"

/**
 * API key scopes.
 *
 *   read:catalog       list and describe calculators
 *   calculate:general  run every calculator EXCEPT dosing and oncology
 *   calculate:dosing   run dosing and oncology calculators (higher risk; never granted by default)
 *   convert            unit conversions
 *
 * Category to scope: "dosing" (drug dosing) and "oncology" (chemotherapy dosing and dose-modification tools) need
 * calculate:dosing. Every other category needs calculate:general. This is deliberately conservative: all oncology tools are
 * treated as dosing, including the supportive-care and cycle-progress ones (see docs/integration/FINDINGS.md, Decisions needed).
 */
export const API_SCOPES = ["read:catalog", "calculate:general", "calculate:dosing", "convert"] as const
export type ApiScope = (typeof API_SCOPES)[number]

/** What a new key gets unless an administrator explicitly adds calculate:dosing. */
export const DEFAULT_SCOPES: readonly ApiScope[] = ["read:catalog", "calculate:general", "convert"]

export const DOSING_CATEGORIES: readonly string[] = ["dosing", "oncology"]

export const scopeForCategory = (category: string): ApiScope => (DOSING_CATEGORIES.includes(category) ? "calculate:dosing" : "calculate:general")
export const scopeForCalculator = (def: Pick<CalculatorDefinition, "category">): ApiScope => scopeForCategory(def.category)

export const isApiScope = (v: unknown): v is ApiScope => typeof v === "string" && (API_SCOPES as readonly string[]).includes(v)
export const hasScope = (granted: readonly string[], needed: ApiScope): boolean => granted.includes(needed)

/** Keeps only known scopes, once each. Unknown strings are dropped, never passed through. */
export function cleanScopes(input: unknown): ApiScope[] {
  if (!Array.isArray(input)) return []
  return API_SCOPES.filter((s) => input.includes(s))
}
