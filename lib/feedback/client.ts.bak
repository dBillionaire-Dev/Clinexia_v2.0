"use client"

import { getAnonymousId } from "@/lib/analytics/client-id"
import { APP_VERSION } from "@/lib/build-info"
import { getPlatform } from "@/lib/platform"
import type { FeedbackAnswers } from "./questions"
import { DEFAULT_CONFIG, normalizeState, parseConfig, type FeedbackConfig, type FeedbackState } from "./schedule"

const STATE_KEY = "clinexia:feedback:v1"
const CONFIG_KEY = "clinexia:feedback:config"
export const DRAFT_KEY = "clinexia:feedback:draft"
const CONFIG_TTL_MS = 6 * 60 * 60 * 1000

export function readState(version: number): FeedbackState {
  let raw: unknown = null
  try {
    raw = JSON.parse(localStorage.getItem(STATE_KEY) ?? "null")
  } catch {}
  return normalizeState(raw, { version })
}

export function writeState(state: FeedbackState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {}
}

/** The server's settings, cached for 6 hours. Offline, it uses the last copy; with none it returns null (stay quiet). */
export async function loadConfig(): Promise<FeedbackConfig | null> {
  let cached: { at: number; config: FeedbackConfig } | null = null
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "null")
    const config = parseConfig(raw?.config)
    if (config && typeof raw.at === "number") cached = { at: raw.at, config }
  } catch {}
  if (cached && Date.now() - cached.at < CONFIG_TTL_MS) return cached.config
  try {
    const response = await fetch("/api/feedback/config", { cache: "no-store" })
    if (!response.ok) return cached?.config ?? null
    const config = parseConfig(await response.json())
    if (!config) return cached?.config ?? null
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ at: Date.now(), config }))
    } catch {}
    return config
  } catch {
    return cached?.config ?? null
  }
}

export async function submitFeedback(answers: FeedbackAnswers, version: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousId: getAnonymousId(),
        surveyVersion: version,
        platform: getPlatform(),
        appVersion: APP_VERSION,
        environment: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
        website: "", // hidden field; real people leave it empty
        answers,
      }),
    })
    if (response.ok) return { ok: true }
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: body.error ?? "Could not send your feedback. Please try again." }
  } catch {
    return { ok: false, error: "You seem to be offline. Your answers are saved here, so you can send them when you are back online." }
  }
}

export const defaultVersion = DEFAULT_CONFIG.version
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
