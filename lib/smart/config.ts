import type { StaleThresholds } from "./mapping"
import { DEFAULT_STALE_THRESHOLDS } from "./mapping"

/**
 * SMART launcher configuration. Nothing partner-specific is hard-coded: the client id, the FHIR servers the app may talk to and the
 * staleness thresholds all come from environment variables (see .env.example). These helpers take plain values so they are testable;
 * lib/smart/env.ts reads the NEXT_PUBLIC_ variables (Next.js only inlines them when written out literally).
 */

/** Scopes, kept minimal on purpose: read the patient and their observations (age, sex, weight, height, creatinine and the like). */
export const SMART_SCOPES_EHR = "launch openid fhirUser patient/Patient.read patient/Observation.read"
/** A standalone launch asks for a patient context with launch/patient instead of launch (SMART App Launch requirement). */
export const SMART_SCOPES_STANDALONE = "launch/patient openid fhirUser patient/Patient.read patient/Observation.read"
export const smartScopes = (standalone: boolean) => (standalone ? SMART_SCOPES_STANDALONE : SMART_SCOPES_EHR)

/** Normalises one FHIR server URL ("iss"): https only (http only for localhost), no credentials, no query or fragment, no trailing slash. */
export function normaliseIss(raw: string | null | undefined): string | null {
  if (!raw) return null
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.username || u.password || u.search || u.hash) return null
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1"
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null
  return `${u.origin}${u.pathname}`.replace(/\/+$/, "")
}

export function parseAllowedIss(csv: string | null | undefined): string[] {
  const out: string[] = []
  for (const part of (csv ?? "").split(",")) {
    const n = normaliseIss(part)
    if (n && !out.includes(n)) out.push(n)
  }
  return out
}

/** The allowlist is the only gate: with none configured, every launch is refused. */
export const isAllowedIss = (iss: string | null | undefined, allowed: readonly string[]): boolean => {
  const n = normaliseIss(iss)
  return n !== null && allowed.includes(n)
}

const positiveDays = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 36500 ? n : fallback
}

export function parseThresholds(env: { creatinine?: string; height?: string; other?: string }): StaleThresholds {
  return {
    creatinineDays: positiveDays(env.creatinine, DEFAULT_STALE_THRESHOLDS.creatinineDays),
    heightDays: positiveDays(env.height, DEFAULT_STALE_THRESHOLDS.heightDays),
    otherDays: positiveDays(env.other, DEFAULT_STALE_THRESHOLDS.otherDays),
  }
}
