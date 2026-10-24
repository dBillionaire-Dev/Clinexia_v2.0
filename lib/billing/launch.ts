// Whether payments have been introduced, whether premium calculators are locked yet, and who is still inside a free period.
// Pure; the stored state (set from the admin page) comes from launch-store.ts. The old BILLING_ENFORCE_PREMIUM=true setting
// still works and forces locking on, so nothing changes for anyone who already uses it.
import { billingEnabled } from "./config"

const DAY = 86_400_000

export interface LaunchState {
  enforce: boolean
  /** Everyone has full access until this moment (the launch free period). */
  freeUntil: string | null
  /** When payments were introduced. People who joined after this are "new users". */
  introducedAt: string | null
  /** Free days from signup for each new user. */
  newUserTrialDays: number
}
export const DEFAULT_NEW_USER_TRIAL_DAYS = 7
export const NO_LAUNCH: LaunchState = { enforce: false, freeUntil: null, introducedAt: null, newUserTrialDays: DEFAULT_NEW_USER_TRIAL_DAYS }

export interface LaunchStatus {
  /** Locks apply right now (switched on and the launch free period is over or absent). */
  enforced: boolean
  /** Switched on, but everyone still has full access until freeUntil. */
  trial: boolean
  freeUntil: string | null
  /** Payments are introduced: prices, plans and checkout are shown to users. False = hidden. */
  switchedOn: boolean
  adminOn: boolean
  envForced: boolean
  introducedAt: string | null
  newUserTrialDays: number
}

export function resolveLaunch(state: LaunchState, env: Record<string, string | undefined>, now: number): LaunchStatus {
  const on = billingEnabled(env)
  const envForced = on && env.BILLING_ENFORCE_PREMIUM === "true"
  const adminOn = on && state.enforce
  const switchedOn = envForced || adminOn
  const end = state.freeUntil ? Date.parse(state.freeUntil) : NaN
  const hasEnd = Number.isFinite(end)
  const trial = switchedOn && hasEnd && now < end
  return {
    enforced: switchedOn && !trial, trial, freeUntil: switchedOn && hasEnd ? state.freeUntil : null, switchedOn, adminOn, envForced,
    introducedAt: switchedOn ? state.introducedAt : null, newUserTrialDays: state.newUserTrialDays,
  }
}

/** Free-period end for "introduce with N free days": null when there is none (0 days). */
export function trialEnd(now: number, days: number): string | null {
  return days > 0 ? new Date(now + days * DAY).toISOString() : null
}

/**
 * The end of a new user's own free period: their signup date plus the new-user days. Only for people who joined AFTER payments were
 * introduced; people who joined earlier are covered by the launch free period instead.
 */
export function personalTrialEnd(l: Pick<LaunchStatus, "switchedOn" | "introducedAt" | "newUserTrialDays">, createdAt: string | null): string | null {
  if (!l.switchedOn || !l.introducedAt || !createdAt || l.newUserTrialDays <= 0) return null
  const made = Date.parse(createdAt)
  const since = Date.parse(l.introducedAt)
  if (!Number.isFinite(made) || !Number.isFinite(since) || made < since) return null
  return new Date(made + l.newUserTrialDays * DAY).toISOString()
}

export const stillRunning = (end: string | null, now: number) => end !== null && now < Date.parse(end)

const wholeDays = (v: unknown, max: number): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null
}
export const cleanTrialDays = (v: unknown) => wholeDays(v, 365)
export const cleanNewUserDays = (v: unknown) => wholeDays(v, 60)
