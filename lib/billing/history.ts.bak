// Pure helpers for showing an account's linked devices and calculation history in the admin.
export interface HistoryEvent { calculator_id: string; calculator_name: string; category: string; occurred_at: string; source?: string; anonymous_id?: string }

/** The name shown for a person: what they typed when registering, otherwise the part of their email before the @. */
export function accountNameFor(fullName: string | null | undefined, email: string): string {
  const typed = (fullName ?? "").replace(/\s+/g, " ").trim()
  if (typed) return typed.slice(0, 80)
  return (email.split("@")[0] || "User").slice(0, 80)
}

export const isDeviceId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export function summariseHistory(events: HistoryEvent[], cap = 1000) {
  const counts = new Map<string, { name: string; count: number }>()
  for (const e of events) {
    const row = counts.get(e.calculator_id) ?? { name: e.calculator_name, count: 0 }
    row.count++
    counts.set(e.calculator_id, row)
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5)
  const first = events.length ? events[events.length - 1].occurred_at : null // events arrive newest first
  const last = events.length ? events[0].occurred_at : null
  return { total: events.length, capped: events.length >= cap, top, firstAt: first, lastAt: last }
}
