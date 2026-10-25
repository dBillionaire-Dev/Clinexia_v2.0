// Reads and saves the launch state (billing_launch, one row). Kept 15 seconds in memory because every calculator page asks.
// If the database cannot be read, the last known state is used, and with none yet the environment setting alone decides,
// so a missing table or a brief outage never locks or unlocks anything by surprise.
import { getAuthUser } from "./admin-users"
import { db } from "./db"
import { DEFAULT_NEW_USER_TRIAL_DAYS, NO_LAUNCH, personalTrialEnd, resolveLaunch, stillRunning, type LaunchState, type LaunchStatus } from "./launch"

let cache: { at: number; state: LaunchState } | null = null

const toState = (row: any): LaunchState => ({
  enforce: row.enforce === true,
  freeUntil: row.free_until ?? null,
  introducedAt: row.introduced_at ?? null,
  newUserTrialDays: Number.isInteger(row.new_user_trial_days) ? row.new_user_trial_days : DEFAULT_NEW_USER_TRIAL_DAYS,
  requireAccount: row.require_account === true,
})

export async function getLaunch(now = Date.now()): Promise<LaunchState> {
  if (cache && now - cache.at < 15_000) return cache.state
  try {
    let row: any
    try {
      ;[row] = await db.select("billing_launch", "select=enforce,free_until,introduced_at,new_user_trial_days,require_account&id=eq.1")
    } catch {
      try {
        ;[row] = await db.select("billing_launch", "select=enforce,free_until,introduced_at,new_user_trial_days&id=eq.1") // before billing-launch.sql was re-run
      } catch {
        ;[row] = await db.select("billing_launch", "select=enforce,free_until&id=eq.1")
      }
    }
    const state = row ? toState(row) : NO_LAUNCH
    cache = { at: now, state }
    return state
  } catch {
    return cache?.state ?? NO_LAUNCH
  }
}

export async function saveLaunch(state: LaunchState): Promise<LaunchState> {
  const row = { enforce: state.enforce, free_until: state.freeUntil, introduced_at: state.introducedAt, new_user_trial_days: state.newUserTrialDays, require_account: state.requireAccount, updated_at: new Date().toISOString() }
  try {
    const changed = await db.update("billing_launch", "id=eq.1", row)
    if (changed.length === 0) await db.insert("billing_launch", { id: 1, ...row })
  } catch (error) {
    // The newer column is missing until billing-launch.sql is re-run: everything else still saves; only turning the account requirement ON needs it.
    if (state.requireAccount) throw error
    const { require_account: _unused, ...rest } = row
    const changed = await db.update("billing_launch", "id=eq.1", rest)
    if (changed.length === 0) await db.insert("billing_launch", { id: 1, ...rest })
  }
  cache = { at: Date.now(), state }
  return state
}

export async function getLaunchStatus(now = Date.now()): Promise<LaunchStatus> {
  return resolveLaunch(await getLaunch(now), process.env, now)
}

// ---- new users' own free period -------------------------------------------------------------------------------------------
const created = new Map<string, { at: number; v: string | null }>()
async function userCreatedAt(userId: string, now: number): Promise<string | null> {
  const hit = created.get(userId)
  if (hit && now - hit.at < 600_000) return hit.v
  try {
    const v = (await getAuthUser(userId))?.createdAt ?? null
    if (created.size > 5000) created.clear()
    created.set(userId, { at: now, v })
    return v
  } catch { return null }
}

/** When this person's own free period ends, if they joined after payments were introduced and it is still running; else null. */
export async function activePersonalTrial(userId: string, launch: LaunchStatus, now = Date.now()): Promise<string | null> {
  if (!launch.switchedOn || !launch.introducedAt || launch.newUserTrialDays <= 0) return null
  const end = personalTrialEnd(launch, await userCreatedAt(userId, now))
  return stillRunning(end, now) ? end : null
}
