"use client"
// clinexia-upgrade:phase3 — tells the user when they are offline and whether the offline copy is complete.

import { useEffect, useState } from "react"

interface Status { version?: string; completedAt?: string; failed?: string[]; total?: number }

async function readStatus(): Promise<Status | null> {
  try {
    if (typeof caches === "undefined") return null
    const hit = await caches.match("/__precache-status.json")
    return hit ? ((await hit.json()) as Status) : null
  } catch {
    return null
  }
}

export function OfflineIndicator() {
  const [online, setOnline] = useState(true)
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update) }
  }, [])

  useEffect(() => { if (!online) void readStatus().then(setStatus) }, [online])
  if (online) return null

  const missing = status?.failed?.length ?? 0
  return (
    <div role="status" aria-live="polite" className="fixed bottom-3 left-1/2 z-[60] w-[min(92vw,34rem)] -translate-x-1/2 rounded-md border bg-background p-3 text-sm shadow-lg">
      <p className="font-medium">You are offline</p>
      <p className="text-muted-foreground">
        Calculators and pages saved on this device still work. Sign-in, updates and sharing need a connection.
        {status === null ? " This device has no complete offline copy yet; connect once and keep the app open for a minute." : null}
        {missing > 0 ? ` ${missing} page(s) were not saved for offline use. Reconnect once to finish.` : null}
      </p>
    </div>
  )
}
