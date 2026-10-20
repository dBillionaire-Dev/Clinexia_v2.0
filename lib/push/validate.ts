// Phone notifications sent from the admin screen. Pure checks, tested.
import { safeUrl } from "../campaigns/model"

export const PUSH_LIMITS = { title: 65, body: 240, url: 300 }
export type PushAudience = "everyone" | "signed_in" | "guests"
export interface PushInput { title: string; body: string; url: string; audience: PushAudience }
export type Cleaned<T> = { ok: true; value: T } | { ok: false; error: string }

// eslint-disable-next-line no-control-regex
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "")

export function validatePush(raw: unknown): Cleaned<PushInput> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "No details received." }
  const r = raw as Record<string, unknown>
  const title = clean(r.title, PUSH_LIMITS.title)
  const body = clean(r.body, PUSH_LIMITS.body)
  if (!title) return { ok: false, error: "Write the notification's title." }
  if (!body) return { ok: false, error: "Write the notification's message." }
  const url = clean(r.url, PUSH_LIMITS.url)
  if (url && !safeUrl(url)) return { ok: false, error: "The link must start with / (a page in the app) or https://." }
  const audience = r.audience === "signed_in" || r.audience === "guests" || r.audience === "everyone" ? r.audience : null
  if (!audience) return { ok: false, error: "Choose who receives it." }
  return { ok: true, value: { title, body, url, audience } }
}

/** A device token from the phone: letters, digits and a few separators, never anything that could be a command. */
export const validPushToken = (t: unknown): t is string => typeof t === "string" && t.length >= 20 && t.length <= 4096 && /^[A-Za-z0-9:_\-.]+$/.test(t)
