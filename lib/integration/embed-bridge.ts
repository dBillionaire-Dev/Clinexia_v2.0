import type { CalculationResult } from "@/lib/calculators/types"
import { getFormulaVersion } from "@/lib/calculators/versions"

/**
 * postMessage contract between an embedded calculator (child) and the host page (parent).
 *
 *   child -> parent  { source: "clinexia", type: "ready",  calculatorId }
 *   child -> parent  { source: "clinexia", type: "result", calculatorId, version, result }
 *   parent -> child  { type: "prefill", values: { age: 54, ... }, calculate?: true }
 *
 * The parent origin is decided on the SERVER (it must be on the allowlist) and handed to the client, so the client never
 * guesses and never uses "*" as a target origin.
 */
export const EMBED_MESSAGE_SOURCE = "clinexia"

export interface EmbedConfig {
  postMessage: boolean
  /** Allowlisted parent origin, or null when none could be established (then nothing is sent or accepted). */
  parentOrigin: string | null
}

/** The calculator's formula version (lib/calculators/versions.ts); "unversioned" for an unknown id. */
export const formulaVersionFor = (calculatorId: string): string => getFormulaVersion(calculatorId) ?? "unversioned"

export type OutgoingMessage =
  | { source: typeof EMBED_MESSAGE_SOURCE; type: "ready"; calculatorId: string }
  | { source: typeof EMBED_MESSAGE_SOURCE; type: "result"; calculatorId: string; version: string; result: CalculationResult }

export const buildReadyMessage = (calculatorId: string): OutgoingMessage => ({ source: EMBED_MESSAGE_SOURCE, type: "ready", calculatorId })

export const buildResultMessage = (calculatorId: string, version: string, result: CalculationResult): OutgoingMessage => ({
  source: EMBED_MESSAGE_SOURCE,
  type: "result",
  calculatorId,
  version,
  result,
})

/** Sends to the parent only if a specific allowlisted origin is known. Returns whether a message was posted. */
export function postToParent(
  target: { postMessage: (message: unknown, targetOrigin: string) => void } | null | undefined,
  parentOrigin: string | null,
  message: OutgoingMessage,
): boolean {
  if (!target || !parentOrigin || parentOrigin === "*") return false
  target.postMessage(message, parentOrigin)
  return true
}

/** Accept a message only from the allowlisted parent origin AND the actual parent window. */
export function isTrustedParentMessage(
  event: { origin: string; source: unknown },
  parentOrigin: string | null,
  parentWindow: unknown,
): boolean {
  return parentOrigin !== null && event.origin === parentOrigin && event.source === parentWindow && parentWindow != null
}

export interface PrefillMessage {
  values: Record<string, string>
  calculate: boolean
}

/** Validates the shape only; each value is then validated against the calculator's inputs by parsePrefill. */
export function parsePrefillMessage(data: unknown): PrefillMessage | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (d.type !== "prefill" || !d.values || typeof d.values !== "object" || Array.isArray(d.values)) return null
  const values: Record<string, string> = {}
  for (const [k, v] of Object.entries(d.values as Record<string, unknown>)) {
    if (typeof v === "string") values[k] = v
    else if (typeof v === "number" && Number.isFinite(v)) values[k] = String(v)
  }
  return { values, calculate: d.calculate === true }
}
