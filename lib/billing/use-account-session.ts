"use client"

// One shared, cached answer to "who is using the app and what is switched on?" for the navbar icon, free/premium badges and the
// guest allowance. It remembers the last answer in local storage so a brief offline spell does not change behaviour.
import { useEffect, useSyncExternalStore } from "react"
import type { Specialty } from "./config"
import { getAnonymousId } from "../analytics/client-id"
import { readSessionState, writeSessionState } from "./guest"

export interface AccountSession {
  loading: boolean
  enabled: boolean
  enforced: boolean
  /** Payments are introduced: prices, plans and checkout may be shown. False = hidden. */
  payments: boolean
  signedIn: boolean
  email?: string
  avatarUrl?: string
  entitlements?: { all: boolean; specialties: Specialty[] }
}

const LOADING: AccountSession = { loading: true, enabled: false, enforced: false, payments: false, signedIn: false }
let snapshot: AccountSession = LOADING
let started = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const LINKED_KEY = "clinexia:device-linked:v1"
/** Once per device and account: attach this device to the signed-in account (covers accounts made before linking existed). */
async function linkThisDevice(email: string) {
  try {
    const key = email.toLowerCase()
    if (localStorage.getItem(LINKED_KEY) === key) return
    const res = await fetch("/api/account/link-device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anonymousId: getAnonymousId() }) })
    if (res.ok) localStorage.setItem(LINKED_KEY, key)
  } catch { /* try again next time */ }
}

export async function refreshAccountSession(): Promise<void> {
  try {
    const res = await fetch("/api/account/session", { cache: "no-store" })
    if (!res.ok) throw new Error("status")
    const j = await res.json()
    snapshot = { loading: false, enabled: j.enabled === true, enforced: j.enforced === true, payments: j.payments === true, signedIn: j.signedIn === true, email: typeof j.email === "string" ? j.email : undefined, avatarUrl: typeof j.avatarUrl === "string" ? j.avatarUrl : undefined, entitlements: j.entitlements }
    try { writeSessionState(window.localStorage, { enforced: snapshot.enforced, signedIn: snapshot.signedIn }) } catch { /* ignore */ }
    if (snapshot.signedIn && snapshot.email) void linkThisDevice(snapshot.email)
  } catch {
    snapshot = { ...snapshot, loading: false } // unreachable (offline): keep the last known answer
  }
  emit()
}

/** Call after signing in or out so the navbar icon and badges update straight away. */
export const notifySessionChanged = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("clinexia:session-changed")) }

export function useAccountSession(): AccountSession {
  const value = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => snapshot,
    () => LOADING,
  )
  useEffect(() => {
    if (started) return
    started = true
    try {
      const last = readSessionState(window.localStorage)
      if (last) { snapshot = { loading: true, enabled: true, enforced: last.enforced, payments: false, signedIn: last.signedIn }; emit() }
    } catch { /* ignore */ }
    void refreshAccountSession()
    // Stay in step with sign-in or sign-out done anywhere else (another tab, the account page, an expired cookie).
    let last = Date.now()
    const again = () => { if (document.visibilityState === "visible" && Date.now() - last > 3000) { last = Date.now(); void refreshAccountSession() } }
    document.addEventListener("visibilitychange", again)
    window.addEventListener("focus", again)
    window.addEventListener("pageshow", again)
    window.addEventListener("clinexia:session-changed", () => void refreshAccountSession())
  }, [])
  return value
}
