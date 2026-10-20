"use client"

// The parked campaigns, shared between the host (which parks them) and the profile menu (which shows them).
import { useSyncExternalStore } from "react"
import { addPending, parsePending, removePending, type PendingCampaign, type PendingItem } from "./pending"

const KEY = "clinexia:campaigns:pending:v1"
export const PENDING_EVENT = "clinexia:campaign-pending-changed"
export const ARRIVED_EVENT = "clinexia:campaign-arrived"
export const OPEN_EVENT = "clinexia:open-campaign"

let cachedRaw: string | null = null
let cachedList: PendingItem[] = []
const EMPTY: PendingItem[] = []

export function readPending(): PendingItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== cachedRaw) { cachedRaw = raw; cachedList = parsePending(raw) }
    return cachedList
  } catch {
    return EMPTY
  }
}

const save = (list: PendingItem[], notify: boolean) => {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* storage unavailable */ }
  if (notify) window.dispatchEvent(new Event(PENDING_EVENT))
}

/** `notify: false` stores it without lighting the "!" yet, so the badge can appear when the card lands in the icon. */
export const parkCampaign = (c: PendingCampaign, notify = true) => save(addPending(readPending(), c, Date.now()), notify)
export const unparkCampaign = (id: string) => save(removePending(readPending(), id), true)
export const announcePending = () => window.dispatchEvent(new Event(PENDING_EVENT))
export const replacePending = (list: PendingItem[]) => save(list, true)

export function usePendingCampaigns(): PendingItem[] {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(PENDING_EVENT, cb)
      window.addEventListener("storage", cb)
      return () => { window.removeEventListener(PENDING_EVENT, cb); window.removeEventListener("storage", cb) }
    },
    readPending,
    () => EMPTY,
  )
}
