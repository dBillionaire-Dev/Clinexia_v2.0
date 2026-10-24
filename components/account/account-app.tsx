"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { confirmDialog } from "@/components/ui/app-dialogs"
import { api } from "@/lib/billing/client"
import { ORGANISATION_TYPES, SPECIALTY_LABELS, type Specialty } from "@/lib/billing/config"
import { AuthForm } from "./auth-form"
import { notifySessionChanged } from "@/lib/billing/use-account-session"
import { PlanPicker } from "./plan-picker"
import { InboxNotice } from "./inbox-notice"
import { ProfileSettings, type ProfileData } from "./profile-settings"

type Me = {
  user: { id: string; email: string; avatarUrl?: string; avatarSource?: "upload" | "google" }
  profile?: ProfileData | null
  market: "ng" | "intl"
  entitlements: { all: boolean; specialties: Specialty[] }
  subscription: { plan: string; specialties: Specialty[]; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null
  organisations: Array<{ orgId: string; role: string; name: string }>
  payments?: boolean
  trialEndsAt?: string | null
}

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm"

function CreateOrganisation() {
  const [f, setF] = useState({ name: "", orgType: "", contactPhone: "", country: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError("")
    const r = await api<{ orgId: string }>("/api/billing/org", { action: "create", ...f })
    if (r.ok) window.location.href = `/account/organisation?org=${r.data.orgId}`
    else { setError(r.error); setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm"><span className="mb-1 block font-medium">Organisation name</span><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">Organisation type</span>
        <select className={field} value={f.orgType} onChange={(e) => setF({ ...f, orgType: e.target.value })} required><option value="">Choose…</option>{ORGANISATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="mb-1 block font-medium">Phone (optional)</span><Input value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Country (optional)</span><Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></label>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create organisation"}</Button>
    </form>
  )
}

export function AccountApp() {
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const load = useCallback(async () => {
    const r = await api<Me>("/api/account/me")
    setMe(r.ok ? r.data : null)
    notifySessionChanged()
  }, [])
  useEffect(() => { void load() }, [load])

  if (me === undefined) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" /></div>
  if (me === null) return <AuthForm onDone={load} />

  const sub = me.subscription
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Your account</h1><p className="text-sm text-muted-foreground">{me.user.email} · {me.market === "intl" ? "International pricing (USD)" : "Nigeria pricing (₦)"}</p></div>
        <Button variant="outline" onClick={async () => { await api("/api/account/logout", {}); setMe(null); notifySessionChanged() }}>Sign out</Button>
      </header>

      <InboxNotice />

      <ProfileSettings key={`${me.user.avatarUrl ?? ""}|${me.profile?.fullName ?? ""}`} email={me.user.email} avatarUrl={me.user.avatarUrl} avatarSource={me.user.avatarSource} profile={me.profile ?? null} onChanged={() => void load()} />

      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="font-medium">What you can use</h2>
        <p className="text-sm text-muted-foreground">Free calculators and tools are always available.</p>
        <p className="text-sm">{me.entitlements.all ? "All premium specialties." : me.entitlements.specialties.length ? me.entitlements.specialties.map((s) => SPECIALTY_LABELS[s]).join(", ") : "No premium specialties yet."}</p>
        {me.trialEndsAt && <p className="text-sm font-medium">Free trial: full access until {new Date(me.trialEndsAt).toLocaleDateString()}.</p>}
        {sub && <p className="text-xs text-muted-foreground">Your plan: {sub.plan === "all_access" ? "all-access" : sub.specialties.map((s) => SPECIALTY_LABELS[s]).join(", ")} · {sub.status}{sub.currentPeriodEnd ? ` · paid until ${new Date(sub.currentPeriodEnd).toLocaleDateString()}` : ""}{sub.cancelAtPeriodEnd ? " · will not continue" : ""}</p>}
        {sub && (sub.status === "active" || sub.status === "grace") && !sub.cancelAtPeriodEnd && (
          <button className="text-xs underline" onClick={async () => { if (await confirmDialog({ title: "Stop your plan?", description: "You keep access until the end of the month you have paid for. It will not renew.", confirmLabel: "Stop plan", destructive: true })) { await api("/api/billing/cancel", {}); void load() } }}>Cancel at the end of the paid period</button>
        )}
      </section>

      {me.organisations.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Your organisations</h2>
          <ul className="divide-y rounded-lg border">
            {me.organisations.map((o) => (
              <li key={o.orgId} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>{o.name} <span className="text-muted-foreground">({o.role})</span></span>
                <Link className="underline" href={`/account/organisation?org=${o.orgId}`}>Open</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {me.payments && (
        <section className="space-y-3">
          <h2 className="font-medium">{sub ? "Change or renew your plan" : "Choose a plan"}</h2>
          <PlanPicker kind="individual" />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">Set up an organisation</h2>
        <p className="text-sm text-muted-foreground">For labs, pharmacies, hospitals, clinics and schools. You become the administrator and each staff member signs in with their own account.</p>
        <CreateOrganisation />
      </section>
    </div>
  )
}
