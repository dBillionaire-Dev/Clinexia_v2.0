// "Remind me later" parks a campaign behind the profile icon. This is the list of parked ones (pure rules; storage is in use-pending.ts).
import type { Campaign } from "./model"

export type PendingCampaign = Omit<Campaign, "title" | "status">
export interface PendingItem { id: string; version: number; addedAt: number; campaign: PendingCampaign }

export const MAX_PENDING = 5

export function addPending(list: PendingItem[], campaign: PendingCampaign, now: number): PendingItem[] {
  const rest = list.filter((p) => p.id !== campaign.id)
  return [{ id: campaign.id, version: campaign.version, addedAt: now, campaign }, ...rest].slice(0, MAX_PENDING)
}

export const removePending = (list: PendingItem[], id: string): PendingItem[] => list.filter((p) => p.id !== id)

/** Keeps only campaigns that are still live and unchanged. Ended, paused, deleted or re-versioned ones disappear from the menu. */
export function prunePending(list: PendingItem[], live: Array<Pick<Campaign, "id" | "version">>): PendingItem[] {
  return list.filter((p) => live.some((l) => l.id === p.id && l.version === p.version))
}

export function parsePending(raw: string | null): PendingItem[] {
  if (!raw) return []
  try {
    const j = JSON.parse(raw)
    if (!Array.isArray(j)) return []
    return j
      .filter((p) => p && typeof p.id === "string" && Number.isInteger(p.version) && typeof p.addedAt === "number" && p.campaign && typeof p.campaign.heading === "string" && (p.campaign.kind === "form" || p.campaign.kind === "notice"))
      .slice(0, MAX_PENDING)
  } catch {
    return []
  }
}
