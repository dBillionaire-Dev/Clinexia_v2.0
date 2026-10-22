"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/billing/client"

type Item = { group: string; label: string; ok: boolean; optional: boolean; fix?: string; detail?: string }
type Result = { checks: Item[]; summary: { failed: number; optionalMissing: number; files: string[]; ready: boolean } }

/** Shows what is and is not set up in this deployment, and exactly what to run or add. */
export function SetupCheck() {
  const [data, setData] = useState<Result | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setBusy(true)
    const r = await api<Result>("/api/admin/setup")
    setBusy(false)
    if (r.ok) { setData(r.data); setError("") } else setError(r.status === 401 ? "Admin session expired. Sign in again." : r.error)
  }, [])
  useEffect(() => { void load() }, [load])

  const groups = data ? [...new Set(data.checks.map((c) => c.group))] : []
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Setup check</h1><p className="text-sm text-muted-foreground">Checks this deployment (the site you are on now) against everything accounts, campaigns and phone notifications need.</p></div>
        <Link href="/admin" className="text-sm underline">← Admin home</Link>
      </header>
      <Button variant="outline" onClick={load} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check again"}</Button>
      {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {data && (
        <>
          <p role="status" className={`rounded-md border p-3 text-sm ${data.summary.ready ? "border-green-600/40" : "border-amber-500/50"}`}>
            {data.summary.ready ? "Everything required is in place." : `${data.summary.failed} required item${data.summary.failed === 1 ? " is" : "s are"} missing.`}
            {data.summary.files.length > 0 && <> Run in the Supabase SQL editor of THIS project: <strong>{data.summary.files.join(", ")}</strong>.</>}
            {data.summary.optionalMissing > 0 && ` ${data.summary.optionalMissing} optional item${data.summary.optionalMissing === 1 ? "" : "s"} not set up (payments, notifications or emails).`}
          </p>
          {groups.map((g) => (
            <section key={g} className="space-y-2">
              <h2 className="font-medium">{g}</h2>
              <ul className="divide-y rounded-lg border text-sm">
                {data.checks.filter((c) => c.group === g).map((c) => (
                  <li key={c.label} className="flex items-start gap-3 p-3">
                    {c.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="OK" /> : <X className={`mt-0.5 h-4 w-4 shrink-0 ${c.optional ? "text-amber-500" : "text-destructive"}`} aria-label="Missing" />}
                    <span className="min-w-0"><span className="block">{c.label}{c.optional && !c.ok ? <span className="text-muted-foreground"> (optional)</span> : null}</span>
                      {!c.ok && c.fix && <span className="block text-xs text-muted-foreground">Fix: {c.fix}</span>}
                      {!c.ok && c.detail && <span className="block break-words text-xs text-muted-foreground">{c.detail}</span>}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-xs text-muted-foreground">Environment variable changes need a redeploy on Vercel. SQL changes take effect straight away.</p>
        </>
      )}
    </div>
  )
}
