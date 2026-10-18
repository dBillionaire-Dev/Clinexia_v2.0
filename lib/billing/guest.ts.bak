// Guest allowance: a person who is not signed in gets GUEST_CALC_LIMIT calculations per device (browser, installed PWA or
// Android app each keep their own count in local storage). Only active while premium enforcement is switched on.
// This is a front-end limit: clearing site data resets it. It exists to steer people to create an account, not to stop a determined user.
export const GUEST_CALC_LIMIT = 3
export const GUEST_KEY = "clinexia-guest-calcs"
export const SESSION_STATE_KEY = "clinexia-session-state"

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface SessionState { enforced: boolean; signedIn: boolean }

export function readSessionState(s: StorageLike): SessionState | null {
  try {
    const raw = s.getItem(SESSION_STATE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    return typeof j?.enforced === "boolean" && typeof j?.signedIn === "boolean" ? { enforced: j.enforced, signedIn: j.signedIn } : null
  } catch {
    return null
  }
}

export function writeSessionState(s: StorageLike, state: SessionState): void {
  try { s.setItem(SESSION_STATE_KEY, JSON.stringify(state)) } catch { /* storage unavailable */ }
}

export function readGuestCount(s: StorageLike): number {
  try {
    const n = Number.parseInt(s.getItem(GUEST_KEY) ?? "0", 10)
    return Number.isFinite(n) && n > 0 ? Math.min(n, GUEST_CALC_LIMIT) : 0
  } catch {
    return 0
  }
}

export const isGuestLimited = (state: SessionState | null, count: number) => Boolean(state && state.enforced && !state.signedIn && count >= GUEST_CALC_LIMIT)

export interface GuestTally { counted: boolean; count: number; limit: number; remaining: number; limited: boolean }

/** Called once per finished calculation. Counts only for guests while enforcement is on; signed-in people are never counted. */
export function noteGuestCalculation(s: StorageLike): GuestTally {
  const state = readSessionState(s)
  const count = readGuestCount(s)
  const base = { limit: GUEST_CALC_LIMIT, count, remaining: Math.max(0, GUEST_CALC_LIMIT - count), limited: isGuestLimited(state, count) }
  if (!state || !state.enforced || state.signedIn) return { ...base, counted: false }
  if (count >= GUEST_CALC_LIMIT) return { ...base, counted: false }
  const next = count + 1
  try { s.setItem(GUEST_KEY, String(next)) } catch { return { ...base, counted: false } }
  return { counted: true, count: next, limit: GUEST_CALC_LIMIT, remaining: GUEST_CALC_LIMIT - next, limited: next >= GUEST_CALC_LIMIT }
}

/** Where to send someone after signing in: a same-site path they were heading to, otherwise the app home page. */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const p = raw.trim()
  if (p.length === 0 || p.length > 300 || !p.startsWith("/") || p.startsWith("//") || p.startsWith("/\\") || /[\r\n]/.test(p)) return null
  if (/^\/(login|register)(\/|\?|$)/.test(p)) return null
  return p
}
