"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/components/ui/app-dialogs"
import { api } from "@/lib/billing/client"

type Key = { id: string; name: string; keyPrefix: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }

/** Owners and admins: create and revoke API keys for server-to-server use (see /developers). The full key is shown once. */
export function ApiKeysPanel({ orgId, role }: { orgId: string; role: "owner" | "admin" | "staff" }) {
  const [keys, setKeys] = useState<Key[] | null>(null)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [dosing, setDosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState("")

  const load = useCallback(async () => {
    const r = await api<{ keys: Key[] }>(`/api/billing/org/api-keys?orgId=${encodeURIComponent(orgId)}`)
    if (r.ok) setKeys(r.data.keys)
    else { setKeys([]); setError(r.error) }
  }, [orgId])
  useEffect(() => { void load() }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(""); setFresh("")
    const r = await api<{ key: string }>("/api/billing/org/api-keys", { action: "create", orgId, name, allowDosing: dosing })
    setBusy(false)
    if (!r.ok) return setError(r.error)
    setFresh(r.data.key); setName(""); setDosing(false)
    await load()
  }

  const revoke = async (k: Key) => {
    if (!(await confirmDialog({ title: `Revoke “${k.name}”?`, description: "Anything using this key stops working straight away. This cannot be undone.", confirmLabel: "Revoke", destructive: true }))) return
    setError("")
    const r = await api("/api/billing/org/api-keys", { action: "revoke", orgId, keyId: k.id })
    if (!r.ok) setError(r.error)
    await load()
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium">API keys</h2>
      <p className="text-sm text-muted-foreground">
        For servers and software that call the Clinexia API (see <a className="underline" href="/developers">/developers</a>). Send numbers only, never patient identifiers.
        A new key can read the catalogue, run general calculators and convert units. Dosing and oncology calculators need an explicit grant.
      </p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <form onSubmit={create} className="space-y-2">
        <label className="block text-sm"><span className="mb-1 block font-medium">Key name</span>
          <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hospital EMR (production)" required /></label>
        {role === "owner" && (
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={dosing} onChange={(e) => setDosing(e.target.checked)} />
            <span>Also allow dosing and oncology calculators (higher risk: only for software that shows results to a clinician for checking)</span></label>
        )}
        <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create key"}</Button>
      </form>
      {fresh && (
        <div className="rounded-lg border p-3 text-sm space-y-2" role="status">
          <p className="font-medium">Copy this key now. It is shown only once and cannot be recovered.</p>
          <input readOnly className="w-full rounded-md border bg-background px-2 py-1 font-mono text-xs" value={fresh} onFocus={(e) => e.currentTarget.select()} />
          <Button type="button" variant="outline" onClick={() => void navigator.clipboard?.writeText(fresh)}>Copy</Button>
        </div>
      )}
      {keys === null ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" /> : keys.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 p-2">
              <span>
                {k.name} <span className="font-mono text-xs text-muted-foreground">{k.keyPrefix}…</span>
                <span className="block text-xs text-muted-foreground">
                  {k.scopes.includes("calculate:dosing") ? "includes dosing · " : ""}created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : " · never used"}{k.revokedAt ? " · revoked" : ""}
                </span>
              </span>
              {!k.revokedAt && <button className="underline text-destructive" onClick={() => void revoke(k)}>Revoke</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
