"use client"

import { useCallback, useEffect, useState } from "react"
import { markSeen, parseSeen, unseen, type InboxMessage } from "@/lib/push/inbox"

const SEEN_KEY = "clinexia:push-seen:v1"
type Item = InboxMessage & { private?: boolean }

/** Private messages from the Clinexia team, shown at the top of the account page until the person closes them. */
export function InboxNotice() {
  const [items, setItems] = useState<Item[]>([])
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/push/recent", { cache: "no-store" })
      if (!res.ok) return
      const j = (await res.json()) as { messages?: Item[] }
      const seen = parseSeen(localStorage.getItem(SEEN_KEY))
      setItems(unseen((j.messages ?? []).filter((m) => m.private === true), seen, Date.now()))
    } catch { /* no notice is better than an error here */ }
  }, [])
  useEffect(() => { void load() }, [load])
  if (items.length === 0) return null
  const close = (id: string) => {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(markSeen(parseSeen(localStorage.getItem(SEEN_KEY)), id))) } catch { /* ignore */ }
    setItems((cur) => cur.filter((m) => m.id !== id))
  }
  return (
    <div className="space-y-3" aria-live="polite">
      {items.map((m) => (
        <section key={m.id} role="alert" className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Message from Clinexia</p>
          <p className="font-medium">{m.title}</p>
          <p className="whitespace-pre-line text-sm">{m.body}</p>
          <button className="text-sm underline" onClick={() => close(m.id)}>Close</button>
        </section>
      ))}
    </div>
  )
}
