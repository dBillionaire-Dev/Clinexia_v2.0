// When a campaign is shown to one person on one device. Pure; the browser keeps the small per-campaign state.
import { audienceMatches, isLive, platformMatches, type Campaign, type Platform } from "./model"

export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000

export interface LocalState { version: number; seenAt: number | null; lastShownAt: number | null; doneAt: number | null; nextAt: number }
export const freshState = (version: number): LocalState => ({ version, seenAt: null, lastShownAt: null, doneAt: null, nextAt: 0 })

/** Saved state counts only for the same version of the campaign. Raising the version ("show again to everyone") starts everyone fresh. */
export function normalizeState(raw: unknown, version: number): LocalState {
  if (!raw || typeof raw !== "object") return freshState(version)
  const s = raw as Partial<LocalState>
  if (s.version !== version) return freshState(version)
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
  return { version, seenAt: num(s.seenAt), lastShownAt: num(s.lastShownAt), doneAt: num(s.doneAt), nextAt: num(s.nextAt) ?? 0 }
}

export interface ShowContext { now: number; signedIn: boolean; shownThisSession: boolean; platform: Platform }

export function shouldShow(c: Campaign, st: LocalState, ctx: ShowContext): { show: boolean; reason: string } {
  if (!isLive(c, ctx.now)) return { show: false, reason: "not live" }
  if (!platformMatches(c, ctx.platform)) return { show: false, reason: "not for this app" }
  if (!audienceMatches(c, ctx.signedIn)) return { show: false, reason: "different audience" }
  if (st.doneAt) return { show: false, reason: "already answered" }
  if (ctx.shownThisSession) return { show: false, reason: "already shown this visit" }
  if (ctx.now < st.nextAt) return { show: false, reason: "reminder not due" }
  if (st.nextAt > 0) return { show: true, reason: "reminder due" } // they asked to be reminded ("Later")
  if (c.frequency === "once") return st.seenAt ? { show: false, reason: "shown once already" } : { show: true, reason: "first time" }
  if (c.frequency === "every_visit") return { show: true, reason: "every visit" }
  if (!st.lastShownAt || ctx.now - st.lastShownAt >= c.repeatDays * DAY_MS) return { show: true, reason: "repeat interval passed" }
  return { show: false, reason: "shown recently" }
}

export const afterShown = (st: LocalState, now: number): LocalState => ({ ...st, seenAt: st.seenAt ?? now, lastShownAt: now, nextAt: st.nextAt > 0 && now >= st.nextAt ? 0 : st.nextAt })
export const afterLater = (st: LocalState, c: Pick<Campaign, "laterHours">, now: number): LocalState => ({ ...st, nextAt: now + c.laterHours * HOUR_MS })
export const afterDone = (st: LocalState, now: number): LocalState => ({ ...st, doneAt: now, nextAt: 0 })

/** One at a time: newest start first. */
export function pickCampaign(list: Campaign[], states: Record<string, LocalState>, ctx: ShowContext): Campaign | null {
  const ordered = [...list].sort((a, b) => Date.parse(b.startsAt ?? "1970-01-01") - Date.parse(a.startsAt ?? "1970-01-01"))
  for (const c of ordered) if (shouldShow(c, states[c.id] ?? freshState(c.version), ctx).show) return c
  return null
}
