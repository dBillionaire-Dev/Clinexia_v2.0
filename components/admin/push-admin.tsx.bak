"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/components/ui/app-dialogs"
import { api } from "@/lib/billing/client"
import { PUSH_LIMITS, type PushAudience } from "@/lib/push/validate"

type Info = {
  configured: boolean
  devices: { total: number; signedIn: number; guests: number }
  messages: Array<{ id: string; title: string; body: string; url: string; audience: string; sent: number; failed: number; removed: number; createdAt: string }>
}
const field = "w-full rounded-md border bg-background px-3 py-2 text-sm"
const AUDIENCE: Record<PushAudience, string> = { everyone: "Everyone with the app", signed_in: "Signed-in people", guests: "People not signed in" }

/** Phone notifications: they reach the Android app even when it is closed. */
export function PushAdmin() {
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState("")
  const [f, setF] = useState({ title: "", body: "", url: "", audience: "everyone" as PushAudience })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  const load = useCallback(async () => {
    const r = await api<Info>("/api/admin/push")
    if (r.ok) { setInfo(r.data); setError("") } else setError(r.status === 401 ? "Admin session expired. Sign in again." : r.error)
  }, [])
  useEffect(() => { void load() }, [load])

  const reach = info ? (f.audience === "everyone" ? info.devices.total : f.audience === "signed_in" ? info.devices.signedIn : info.devices.guests) : 0

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setMsg("")
    if (!(await confirmDialog({ title: `Send to ${reach} phone${reach === 1 ? "" : "s"}?`, description: `"${f.title}" will arrive on ${AUDIENCE[f.audience].toLowerCase()} right away. This cannot be undone.`, confirmLabel: "Send now" }))) return
    setBusy(true)
    const r = await api<{ sent: number; failed: number; removed: number }>("/api/admin/push", f)
    setBusy(false)
    if (!r.ok) return setMsg(r.error)
    setMsg(`Sent to ${r.data.sent} phone${r.data.sent === 1 ? "" : "s"}${r.data.failed ? `, ${r.data.failed} failed` : ""}${r.data.removed ? `, ${r.data.removed} old phone${r.data.removed === 1 ? "" : "s"} removed` : ""}.`)
    setF({ ...f, title: "", body: "", url: "" })
    void load()
  }

  if (!info && !error) return <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" />
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Notifications arrive on people's phones even when the app is closed. They are sent as soon as you press the button (they cannot be scheduled yet).</p>
      {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {info && !info.configured && <p role="alert" className="rounded-md border border-amber-500/50 p-3 text-sm">Notifications are not set up on the server yet: add <code>FCM_SERVICE_ACCOUNT_JSON</code> (see docs/billing.md). You can prepare a message but it cannot be sent.</p>}
      {info && <p className="text-sm">Registered phones: <strong>{info.devices.total}</strong> ({info.devices.signedIn} signed in, {info.devices.guests} not signed in)</p>}

      <form onSubmit={send} className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">New notification</h2>
        <label className="block text-sm"><span className="mb-1 block font-medium">Title</span><input className={field} maxLength={PUSH_LIMITS.title} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Message</span><textarea className={field} rows={3} maxLength={PUSH_LIMITS.body} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required /><span className="mt-1 block text-xs text-muted-foreground">{f.body.length} of {PUSH_LIMITS.body}</span></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Opens (optional)</span><input className={field} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="/account or https://..." /><span className="mt-1 block text-xs text-muted-foreground">A page in the app like /calculators, or an https:// address. Tapping the notification opens it.</span></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Who receives it</span>
          <select className={field} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as PushAudience })}>{(Object.keys(AUDIENCE) as PushAudience[]).map((a) => <option key={a} value={a}>{AUDIENCE[a]}</option>)}</select></label>
        {msg && <p role="status" className="text-sm">{msg}</p>}
        <Button type="submit" disabled={busy || !info?.configured}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send to ${reach} phone${reach === 1 ? "" : "s"}`}</Button>
      </form>

      <section className="space-y-2">
        <h2 className="font-medium">Sent so far</h2>
        {info && info.messages.length === 0 ? <p className="text-sm text-muted-foreground">Nothing sent yet.</p> : (
          <ul className="divide-y rounded-lg border">
            {info?.messages.map((m) => (
              <li key={m.id} className="p-3 text-sm"><p className="font-medium">{m.title}</p><p className="text-muted-foreground">{m.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()} · {AUDIENCE[m.audience as PushAudience] ?? m.audience} · delivered {m.sent}{m.failed ? `, failed ${m.failed}` : ""}{m.removed ? `, removed ${m.removed}` : ""}</p></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
