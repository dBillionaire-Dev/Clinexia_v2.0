"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { confirmDialog, type ConfirmOptions } from "@/components/ui/app-dialogs"
import { api } from "@/lib/billing/client"
import { SPECIALTIES, SPECIALTY_LABELS, type Specialty } from "@/lib/billing/config"
import { PlanPicker } from "./plan-picker"
import { useAccountSession } from "@/lib/billing/use-account-session"

type Member = { userId: string; email: string; fullName: string; role: "owner" | "admin" | "staff"; allSpecialties: boolean; specialties: Specialty[] }
type Invite = { id: string; email: string; role: string; allSpecialties: boolean; specialties: Specialty[]; expiresAt: string }
type Dash = {
  org: { id: string; name: string; orgType: string; managedStatus: string; suspended: boolean }
  role: "owner" | "admin" | "staff"
  subscriptionStatus: string
  plan: { plan: "specialty" | "all_access"; specialties: Specialty[]; currentPeriodEnd: string | null } | null
  members: Member[]
  invitations: Invite[]
  seats: { used: number; available: number; seats: number; label: string }
}

const manages = (actor: Dash["role"], target: Member["role"]) => target !== "owner" && (actor === "owner" || (actor === "admin" && target === "staff"))

export function OrganisationDashboard({ orgId }: { orgId: string }) {
  const session = useAccountSession()
  const [d, setD] = useState<Dash | null | undefined>(undefined)
  const [error, setError] = useState("")
  const [links, setLinks] = useState<Array<{ email: string; link: string; emailed?: boolean }>>([])
  const [skipped, setSkipped] = useState<Array<{ email: string; reason: string }>>([])
  const [invite, setInvite] = useState({ emails: "", role: "staff", all: true, specialties: [] as Specialty[] })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await api<Dash>(`/api/billing/org?orgId=${encodeURIComponent(orgId)}`)
    if (r.ok) setD(r.data)
    else { setD(null); setError(r.status === 401 ? "Please sign in first." : r.error) }
  }, [orgId])
  useEffect(() => { void load() }, [load])

  const act = async (body: Record<string, unknown>, ask?: ConfirmOptions) => {
    if (ask && !(await confirmDialog(ask))) return null
    setError("")
    const r = await api<any>("/api/billing/org", { orgId, ...body })
    if (!r.ok) setError(r.error)
    else await load()
    return r
  }

  if (d === undefined) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" /></div>
  if (d === null) return <div className="space-y-3"><p className="text-sm text-destructive" role="alert">{error || "Organisation not found."}</p><Link className="underline text-sm" href="/account">Back to your account</Link></div>

  const isManager = d.role === "owner" || d.role === "admin"
  const assignable: Specialty[] = d.plan ? (d.plan.plan === "all_access" ? [...SPECIALTIES] : d.plan.specialties) : []
  const active = d.subscriptionStatus === "active" || d.subscriptionStatus === "grace"

  async function sendInvites(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await act({ action: "invite", emails: invite.emails, role: invite.role, allSpecialties: invite.all, specialties: invite.specialties })
    setBusy(false)
    if (r?.ok) { setLinks(r.data.created); setSkipped(r.data.skipped); setInvite({ ...invite, emails: "" }) }
  }

  return (
    <div className="space-y-8">
      <header>
        <Link href="/account" className="text-sm underline">← Your account</Link>
        <h1 className="mt-2 text-2xl font-semibold">{d.org.name}</h1>
        <p className="text-sm text-muted-foreground">
          {d.seats.label} · Subscription: {d.subscriptionStatus}
          {d.plan?.currentPeriodEnd ? ` · paid until ${new Date(d.plan.currentPeriodEnd).toLocaleDateString()}` : ""}
          {d.org.suspended ? " · suspended" : ""}
        </p>
        {d.subscriptionStatus === "grace" && <p role="status" className="mt-2 rounded-md border border-amber-500/50 p-2 text-sm">Your subscription has ended. Access continues for a short grace period. Renew to keep it.</p>}
      </header>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <section className="space-y-3">
        <h2 className="font-medium">{isManager ? "Members" : "Your access"}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left"><tr><th className="p-2">Name</th><th className="p-2">Role</th><th className="p-2">Specialties</th>{isManager && <th className="p-2" />}</tr></thead>
            <tbody>
              {d.members.map((m) => (
                <tr key={m.userId} className="border-t align-top">
                  <td className="p-2">{m.fullName || m.email || "—"}<span className="block text-xs text-muted-foreground">{m.email}</span></td>
                  <td className="p-2">{m.role}</td>
                  <td className="p-2">{m.allSpecialties ? "Everything the plan covers" : m.specialties.map((s) => SPECIALTY_LABELS[s]).join(", ") || "None"}</td>
                  {isManager && (
                    <td className="p-2 space-x-3 whitespace-nowrap">
                      {manages(d.role, m.role) && (
                        <>
                          <button className="underline" onClick={() => act({ action: "setSpecialties", userId: m.userId, allSpecialties: !m.allSpecialties, specialties: m.allSpecialties ? assignable.slice(0, 1) : [] })}>
                            {m.allSpecialties ? "Limit access" : "Give full plan access"}
                          </button>
                          <button className="underline text-destructive" onClick={() => act({ action: "remove", userId: m.userId }, { title: `Remove ${m.fullName || m.email}?`, description: "They lose access straight away and their seat is freed.", confirmLabel: "Remove", destructive: true })}>Remove</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.role !== "owner" && <Button variant="outline" onClick={async () => { const r = await act({ action: "leave" }, { title: "Leave this organisation?", description: "You will lose the access it gave you. An administrator can invite you again.", confirmLabel: "Leave", destructive: true }); if (r?.ok) window.location.href = "/account" }}>Leave organisation</Button>}
      </section>

      {isManager && (
        <section className="space-y-3">
          <h2 className="font-medium">Invite staff</h2>
          {!active ? <p className="text-sm text-muted-foreground">Choose and pay for a plan below before inviting staff.</p> : (
            <form onSubmit={sendInvites} className="space-y-3">
              <label className="block text-sm"><span className="mb-1 block font-medium">Email addresses (one per line, or separated by commas)</span>
                <textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" value={invite.emails} onChange={(e) => setInvite({ ...invite, emails: e.target.value })} required /></label>
              {d.role === "owner" && <label className="block text-sm"><span className="mb-1 block font-medium">Role</span>
                <select className="rounded-md border bg-background px-3 py-2 text-sm" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}><option value="staff">Staff</option><option value="admin">Administrator</option></select></label>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={invite.all} onChange={(e) => setInvite({ ...invite, all: e.target.checked })} />Everything the organisation plan covers</label>
              {!invite.all && (
                <div role="group" aria-label="Specialties" className="flex flex-wrap gap-2">
                  {assignable.map((s) => (
                    <button key={s} type="button" aria-pressed={invite.specialties.includes(s)} onClick={() => setInvite({ ...invite, specialties: invite.specialties.includes(s) ? invite.specialties.filter((x) => x !== s) : [...invite.specialties, s] })}
                      className={`rounded-full border px-3 py-1.5 text-sm ${invite.specialties.includes(s) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{SPECIALTY_LABELS[s]}</button>
                  ))}
                </div>
              )}
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invitations"}</Button>
            </form>
          )}
          {links.length > 0 && (
            <div className="rounded-lg border p-3 text-sm space-y-2">
              {links.some((l) => l.emailed) && <p className="font-medium">Invitation emailed to: {links.filter((l) => l.emailed).map((l) => l.email).join(", ")}</p>}
              {links.some((l) => !l.emailed) && <p className="font-medium">We could not email these people. Share their private links yourself (shown once; each works only for the invited email):</p>}
              {links.filter((l) => !l.emailed).map((l) => <div key={l.email}><span className="text-muted-foreground">{l.email}</span><input readOnly className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-xs" value={l.link} onFocus={(e) => e.currentTarget.select()} /></div>)}
              {links.some((l) => l.emailed) && <details><summary className="cursor-pointer text-xs text-muted-foreground">Backup links for the emailed invitations</summary>{links.filter((l) => l.emailed).map((l) => <div key={l.email} className="mt-2"><span className="text-muted-foreground">{l.email}</span><input readOnly className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-xs" value={l.link} onFocus={(e) => e.currentTarget.select()} /></div>)}</details>}
            </div>
          )}
          {skipped.length > 0 && <ul className="text-sm text-muted-foreground">{skipped.map((s) => <li key={s.email}>{s.email}: {s.reason}</li>)}</ul>}
          {d.invitations.length > 0 && (
            <ul className="divide-y rounded-lg border text-sm">
              {d.invitations.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 p-2"><span>{i.email} <span className="text-muted-foreground">· {i.role} · expires {new Date(i.expiresAt).toLocaleDateString()}</span></span>
                  <button className="underline" onClick={() => act({ action: "revoke", inviteId: i.id })}>Revoke</button></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {d.role === "owner" && (
        <section className="space-y-3">
          <h2 className="font-medium">Plan and billing</h2>
          {session.payments && <PlanPicker kind="enterprise" orgId={orgId} minSeats={Math.max(1, d.seats.used)} />}
          <div className="rounded-lg border p-3 text-sm space-y-2">
            <p className="font-medium">Centrally managed organisations</p>
            <p className="text-muted-foreground">If your organisation manages staff centrally (for example with Microsoft Entra ID), you can ask Clinexia to review it for a discount. It applies only after Clinexia verifies it. Single sign-in is not available yet.</p>
            {d.org.managedStatus === "none" || d.org.managedStatus === "rejected" ? <Button variant="outline" onClick={() => act({ action: "requestManaged" })}>Request verification</Button> : <p>Status: {d.org.managedStatus}</p>}
          </div>
          {active && <button className="text-sm underline" onClick={async () => { if (await confirmDialog({ title: "Stop the organisation plan?", description: "Everyone keeps access until the end of the paid month. It will not renew.", confirmLabel: "Stop plan", destructive: true })) { await api("/api/billing/cancel", { orgId }); void load() } }}>Cancel at the end of the paid period</button>}
        </section>
      )}
    </div>
  )
}
