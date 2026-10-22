// Which notifications still need showing in the app. Pure, so it is tested.
export interface InboxMessage { id: string; title: string; body: string; url: string; createdAt: string }

export const MAX_SEEN = 50

export function parseSeen(raw: string | null): string[] {
  try {
    const j = JSON.parse(raw ?? "[]")
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string").slice(0, MAX_SEEN) : []
  } catch { return [] }
}

export const markSeen = (seen: string[], id: string): string[] => (seen.includes(id) ? seen : [id, ...seen].slice(0, MAX_SEEN))

/** Messages not yet closed on this device, oldest first, and not older than the cut-off. */
export function unseen(messages: InboxMessage[], seen: string[], now: number, maxAgeMs = 7 * 86_400_000): InboxMessage[] {
  return messages
    .filter((m) => !seen.includes(m.id) && now - Date.parse(m.createdAt) <= maxAgeMs)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}
