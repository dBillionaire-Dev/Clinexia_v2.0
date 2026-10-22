"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { confirmDialog, promptDialog } from "@/components/ui/app-dialogs"
import { api } from "@/lib/billing/client"
import { MARKETS, type Market, type PricingConfig } from "@/lib/billing/config"
import { formatMoney } from "@/lib/billing/pricing"
import { PlanDialog, type PlanChoice } from "./plan-dialog"

type UserRow = {
  id: string; email: string; fullName: string; accountType: string; source: string; market: Market; status: "active" | "suspended"; createdAt: string | null; lastSignInAt: string | null; confirmed: boolean
  plan: { plan: string; specialties: string[]; status: string; currentPeriodEnd: string | null } | null; organisations: number
}
type OrgRow = { id: string; name: string; orgType: string; market: Market; seats: number; managedStatus: string; suspended: boolean; subscription: { plan: string; status: string; currentPeriodEnd: string | null } | null }
type DeviceRow = { anonymousId: string; displayName: string; firstSeenAt: string | null; lastSeenAt: string | null; lastCalculationAt: string | null; source: string; appVersion: string; linkedAt: string | null }
type HistoryRow = { calculator_id: string; calculator_name: string; category: string; occurred_at: string; source?: string; anonymous_id?: string }
type Detail = { devices: DeviceRow[]; history: { total: number; capped: boolean; top: Array<{ name: string; count: number }>; firstAt: string | null; lastAt: string | null; recent: HistoryRow[] }; user: { email: string }; status: { status: string; reason: string | null }; memberships: Array<{ orgId: string; role: string; name: string }>; orders: Array<{ reference: string; amountMinor: number; currency: string; status: string; createdAt: string }>; audit: Array<{ id: number; at: string; action: string }> }
type AuditRow = { id: number; at: string; action: string; org_id: string | null; actor_kind: string; detail: Record<string, unknown> }

const d = (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—")
const TABS = ["Users", "Organisations", "Pricing", "Audit"] as const

// ----- pricing editor: values are typed in naira/dollars and saved as kobo/cents -----
const INDIVIDUAL = [["specialtyMinor", "One specialty / month"], ["additionalSpecialtyMinor", "Each additional specialty / month"], ["allAccessMinor", "All-access / month"]] as const
const ENTERPRISE = [
  ["specialtyPerSeatMinor", "One specialty, per seat / month"], ["additionalSpecialtyPerSeatMinor", "Each additional specialty, per seat"], ["allAccessPerSeatMinor", "All-access, per seat / month"],
  ["allAccessBlockMinor", "All-access cap for the first block of seats"], ["extraSeatMinor", "Each seat beyond the block"],
] as const

function PricingEditor({ initial, onSaved }: { initial: PricingConfig; onSaved: (p: PricingConfig) => void }) {
  const [cfg, setCfg] = useState<PricingConfig>(initial)
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const setPrice = (m: Market, group: "individual" | "enterprise", key: string, value: string) => {
    const minor = Math.max(0, Math.round((Number(value) || 0) * 100))
    setCfg((c) => ({ ...c, markets: { ...c.markets, [m]: { ...c.markets[m], [group]: { ...(c.markets[m][group] as Record<string, number>), [key]: minor } } } }))
  }
  async function save() {
    setBusy(true); setMsg("")
    const r = await api<{ pricing: PricingConfig }>("/api/admin/billing", { action: "setPricing", config: cfg })
    setBusy(false)
    if (r.ok) { setCfg(r.data.pricing); onSaved(r.data.pricing); setMsg("Saved. New prices apply to the next checkout; payments already started keep the price they showed.") } else setMsg(r.error)
  }
  const box = "w-32 rounded-md border bg-background px-2 py-1.5 text-sm"
  return (
    <div className="space-y-6">
      {(["ng", "intl"] as Market[]).map((m) => (
        <section key={m} className="rounded-lg border p-4 space-y-4">
          <h3 className="font-medium">{MARKETS[m].label} prices ({MARKETS[m].currency})</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><p className="text-sm font-medium">Individual</p>
              {INDIVIDUAL.map(([k, label]) => <label key={k} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><input type="number" min={0} step="0.01" className={box} value={(cfg.markets[m].individual as Record<string, number>)[k] / 100} onChange={(e) => setPrice(m, "individual", k, e.target.value)} /></label>)}</div>
            <div className="space-y-2"><p className="text-sm font-medium">Organisation</p>
              {ENTERPRISE.map(([k, label]) => <label key={k} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><input type="number" min={0} step="0.01" className={box} value={(cfg.markets[m].enterprise as Record<string, number>)[k] / 100} onChange={(e) => setPrice(m, "enterprise", k, e.target.value)} /></label>)}
              <label className="flex items-center justify-between gap-3 text-sm"><span>Seats in the first block</span><input type="number" min={1} step={1} className={box} value={cfg.markets[m].enterprise.allAccessBlockSeats} onChange={(e) => setCfg((c) => ({ ...c, markets: { ...c.markets, [m]: { ...c.markets[m], enterprise: { ...c.markets[m].enterprise, allAccessBlockSeats: Math.max(1, Math.floor(Number(e.target.value) || 1)) } } } }))} /></label></div>
          </div>
          <p className="text-xs text-muted-foreground">Preview: one specialty {formatMoney(cfg.markets[m].individual.specialtyMinor, MARKETS[m].currency)} · all-access {formatMoney(cfg.markets[m].individual.allAccessMinor, MARKETS[m].currency)} · organisation all-access capped at {formatMoney(cfg.markets[m].enterprise.allAccessBlockMinor, MARKETS[m].currency)} for {cfg.markets[m].enterprise.allAccessBlockSeats} seats</p>
        </section>
      ))}
      <section className="rounded-lg border p-4 grid gap-3 sm:grid-cols-2 text-sm">
        <label className="flex items-center justify-between gap-3"><span>Verified managed-organisation discount (%)</span><input type="number" min={0} max={50} step="0.5" className={box} value={cfg.managedDiscountBps / 100} onChange={(e) => setCfg({ ...cfg, managedDiscountBps: Math.max(0, Math.min(5000, Math.round((Number(e.target.value) || 0) * 100))) })} /></label>
        <label className="flex items-center justify-between gap-3"><span>Grace days after a period ends</span><input type="number" min={0} max={60} step={1} className={box} value={cfg.graceDays} onChange={(e) => setCfg({ ...cfg, graceDays: Math.max(0, Math.min(60, Math.floor(Number(e.target.value) || 0))) })} /></label>
      </section>
      <p className="text-xs text-muted-foreground">Dollar prices only work if your Paystack account has international (USD) payments enabled.</p>
      <div className="flex items-center gap-3"><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save prices"}</Button>{msg && <span role="status" className="text-sm">{msg}</span>}</div>
    </div>
  )
}

export function AccountsAdmin() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Users")
  const [q, setQ] = useState("")
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [pricing, setPricing] = useState<PricingConfig | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [planUser, setPlanUser] = useState<UserRow | null>(null)
  const [detailId, setDetailId] = useState("")
  const [historyShown, setHistoryShown] = useState(20)
  const [deviceInput, setDeviceInput] = useState("")
  const [msg, setMsg] = useState("")

  const loadUsers = useCallback(async (query: string) => {
    const r = await api<{ users: UserRow[]; truncated: boolean }>(`/api/admin/accounts?q=${encodeURIComponent(query)}`)
    if (r.ok) { setUsers(r.data.users); setTruncated(r.data.truncated) } else { setUsers([]); setMsg(r.status === 401 ? "Admin session expired. Sign in again." : r.error) }
  }, [])
  const loadBilling = useCallback(async () => {
    const r = await api<{ pricing: PricingConfig; organisations: OrgRow[]; audit: AuditRow[] }>("/api/admin/billing")
    if (r.ok) { setPricing(r.data.pricing); setOrgs(r.data.organisations); setAudit(r.data.audit) }
  }, [])
  useEffect(() => { void loadUsers(""); void loadBilling() }, [loadUsers, loadBilling])

  const run = async (body: Record<string, unknown>, done: () => Promise<void> | void) => {
    setMsg("")
    const r = await api<{ email?: string }>("/api/admin/accounts", body)
    if (!r.ok) return setMsg(r.error)
    const e = r.data.email
    setMsg(e === "sent" ? "Done. The person was emailed a notice." : e === "not_configured" ? "Done. No email provider is configured, so no email was sent (a suspended person still sees the notice when they try to sign in)." : e === "failed" ? "Done, but the notice email failed to send." : "Done.")
    await done()
    void loadBilling()
  }
  const askReason = (title: string, confirmLabel: string) =>
    promptDialog({ title, description: "The person is told this reason. Be specific and factual.", label: "Reason", multiline: true, placeholder: "e.g. Several people sharing one login", confirmLabel, destructive: true, validate: (v) => (v.length >= 5 ? null : "Give a reason of at least 5 characters.") })

  const suspendUser = async (u: UserRow) => { const reason = await askReason(`Suspend ${u.email}?`, "Suspend"); if (reason) void run({ action: "suspendUser", userId: u.id, reason }, () => loadUsers(q)) }
  const restoreUser = async (u: UserRow) => { if (await confirmDialog({ title: `Restore ${u.email}?`, description: "They will be able to sign in again.", confirmLabel: "Restore" })) void run({ action: "restoreUser", userId: u.id }, () => loadUsers(q)) }
  const deleteUser = async (u: UserRow) => {
    const reason = await askReason(`Delete ${u.email}?`, "Next"); if (!reason) return
    const typed = await promptDialog({ title: "This cannot be undone", description: `Type ${u.email} to permanently delete this account.`, label: "Email address", mustType: u.email, confirmLabel: "Delete account", destructive: true })
    if (typed) void run({ action: "deleteUser", userId: u.id, reason, confirm: typed }, () => loadUsers(q))
  }
  const suspendOrg = async (o: OrgRow) => { const reason = await askReason(`Suspend ${o.name}?`, "Suspend"); if (reason) void run({ action: "suspendOrg", orgId: o.id, reason }, loadBilling) }
  const deleteOrg = async (o: OrgRow) => {
    const reason = await askReason(`Delete ${o.name}?`, "Next"); if (!reason) return
    const typed = await promptDialog({ title: "This cannot be undone", description: `Type ${o.name} to permanently delete this organisation, its members' access and its subscription.`, label: "Organisation name", mustType: o.name, confirmLabel: "Delete organisation", destructive: true })
    if (typed) void run({ action: "deleteOrg", orgId: o.id, reason, confirm: typed }, loadBilling)
  }
  const savePlan = async (u: UserRow, c: PlanChoice) => {
    const r = await api<{ email?: string; label: string }>("/api/admin/accounts", { action: "setUserPlan", userId: u.id, ...c })
    if (!r.ok) throw new Error(r.error)
    setPlanUser(null)
    setMsg(`Plan set: ${r.data.label}. ${r.data.email === "sent" ? "They were emailed." : "No email was sent (no email provider configured)."}`)
    await loadUsers(q)
  }
  const planText = (u: UserRow) => (u.plan && (u.plan.status === "active" || u.plan.status === "cancelled") ? `${u.plan.plan === "all_access" ? "All-access" : u.plan.specialties.join(", ")} (${u.plan.status})` : "Free")
  const showDetail = async (u: UserRow) => { const r = await api<Detail>(`/api/admin/accounts?userId=${u.id}`); if (r.ok) { setDetail(r.data); setDetailId(u.id); setHistoryShown(20); setDeviceInput("") } else setMsg(r.error) }
  const changeDevice = async (action: "linkDevice" | "unlinkDevice", anonymousId: string) => {
    const r = await api("/api/admin/accounts", { action, userId: detailId, anonymousId: anonymousId.trim() })
    if (!r.ok) return setMsg(r.error)
    setDeviceInput("")
    const again = await api<Detail>(`/api/admin/accounts?userId=${detailId}`)
    if (again.ok) setDetail(again.data)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button className="underline" onClick={async () => {
            if (!(await confirmDialog({ title: "Link devices from existing activity?", description: "Devices that registered for notifications or answered a form while signed in are attached to those accounts, and every linked device gets its account's name. Safe to repeat.", confirmLabel: "Link devices" }))) return
            const r = await api<{ linksAdded: number; renamed: number }>("/api/admin/accounts", { action: "backfillLinks" })
            setMsg(r.ok ? `Done. ${r.data.linksAdded} new link${r.data.linksAdded === 1 ? "" : "s"}, ${r.data.renamed} device${r.data.renamed === 1 ? "" : "s"} now show the account's name.` : r.error)
          }}>Link devices from existing activity</button>
          <Link href="/admin/setup" className="underline">Setup check</Link>
          <Link href="/admin" className="underline">← Admin home</Link>
        </div>
      </header>
      <nav className="flex gap-2" aria-label="Sections">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} aria-current={tab === t} className={`rounded-full border px-4 py-1.5 text-sm ${tab === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{t}</button>)}
      </nav>
      {msg && <p role="status" className="rounded-md border p-2 text-sm">{msg}</p>}
      {msg && /Run supabase|missing|Could not load/i.test(msg) && <p className="text-sm"><Link href="/admin/setup" className="underline">Open the setup check</Link> to see exactly what is missing.</p>}
      {planUser && <PlanDialog email={planUser.email} current={planText(planUser)} onClose={() => setPlanUser(null)} onSave={(c) => savePlan(planUser, c)} />}

      {tab === "Users" && (
        <section className="space-y-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void loadUsers(q) }}>
            <input className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm" placeholder="Search email or name" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit" variant="outline">Search</Button>
          </form>
          {users === null ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" /> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr><th className="p-2">Person</th><th className="p-2">Type</th><th className="p-2">Market</th><th className="p-2">Plan</th><th className="p-2">Joined / last sign-in</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t align-top">
                      <td className="p-2">{u.fullName || "—"}<span className="block text-xs text-muted-foreground">{u.email}{u.confirmed ? "" : " (unconfirmed)"}</span></td>
                      <td className="p-2">{u.accountType || "—"}{u.organisations ? ` · ${u.organisations} org` : ""}<span className="block text-xs text-muted-foreground">{u.source === "android" ? "Android app" : u.source === "mobile_web" ? "Mobile site" : "Website"}</span></td>
                      <td className="p-2"><select className="rounded border bg-background px-1 py-0.5" value={u.market} onChange={(e) => void run({ action: "setUserMarket", userId: u.id, market: e.target.value }, () => loadUsers(q))}><option value="ng">Nigeria (₦)</option><option value="intl">International ($)</option></select></td>
                      <td className="p-2">{u.plan ? `${u.plan.plan === "all_access" ? "All-access" : u.plan.specialties.join(", ")} · ${u.plan.status}` : "Free"}</td>
                      <td className="p-2 text-xs">{d(u.createdAt)} / {d(u.lastSignInAt)}</td>
                      <td className="p-2">{u.status === "suspended" ? <span className="text-destructive">Suspended</span> : "Active"}</td>
                      <td className="p-2 space-x-3 whitespace-nowrap">
                        <button className="underline" onClick={() => void showDetail(u)}>Details</button>
                        <button className="underline" onClick={() => setPlanUser(u)}>Plan</button>
                        {u.status === "suspended" ? <button className="underline" onClick={() => void restoreUser(u)}>Restore</button> : <button className="underline" onClick={() => void suspendUser(u)}>Suspend</button>}
                        <button className="underline text-destructive" onClick={() => void deleteUser(u)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={7}>No accounts found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {truncated && <p className="text-xs text-muted-foreground">Showing the first 1,000 accounts. Use search to narrow down.</p>}
          {detail && (
            <div className="rounded-lg border p-4 text-sm space-y-2">
              <div className="flex justify-between"><p className="font-medium">{detail.user.email}</p><button className="underline" onClick={() => setDetail(null)}>Close</button></div>
              <p>Status: {detail.status.status}{detail.status.reason ? ` (${detail.status.reason})` : ""}</p>
              <p>Organisations: {detail.memberships.length ? detail.memberships.map((m) => `${m.name} (${m.role})`).join(", ") : "none"}</p>
              <p className="font-medium">Devices linked to this account ({detail.devices.length})</p>
              {detail.devices.length === 0 ? <p className="text-xs text-muted-foreground">None yet. A device links when this person registers or signs in on it. Devices used before they registered are included from then on.</p> : (
                <ul className="space-y-1 text-xs">
                  {detail.devices.map((d) => (
                    <li key={d.anonymousId} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                      <span><span className="font-medium">{d.displayName}</span> · {d.source}{d.appVersion ? ` · v${d.appVersion}` : ""} · first seen {d.firstSeenAt ? new Date(d.firstSeenAt).toLocaleDateString() : "?"}, last seen {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleDateString() : "?"}<span className="block break-all text-muted-foreground">{d.anonymousId}</span></span>
                      <button className="underline text-destructive" onClick={() => void changeDevice("unlinkDevice", d.anonymousId)}>Unlink</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <input className="w-full max-w-sm rounded-md border bg-background px-2 py-1.5 text-xs" placeholder="Link another device: paste its device ID" value={deviceInput} onChange={(e) => setDeviceInput(e.target.value)} />
                <Button size="sm" variant="outline" disabled={!deviceInput.trim()} onClick={() => void changeDevice("linkDevice", deviceInput)}>Link device</Button>
              </div>
              <p className="font-medium">Calculation history ({detail.history.total}{detail.history.capped ? "+" : ""})</p>
              {detail.history.total === 0 ? <p className="text-xs text-muted-foreground">No calculations recorded on the linked devices.</p> : (
                <>
                  <p className="text-xs text-muted-foreground">Most used: {detail.history.top.map((t) => `${t.name} (${t.count})`).join(", ")}. {detail.history.firstAt ? `From ${new Date(detail.history.firstAt).toLocaleDateString()} to ${new Date(detail.history.lastAt ?? detail.history.firstAt).toLocaleDateString()}.` : ""}</p>
                  <ul className="max-h-64 divide-y overflow-y-auto rounded border text-xs">
                    {detail.history.recent.slice(0, historyShown).map((h, i) => <li key={`${h.occurred_at}-${i}`} className="flex justify-between gap-3 p-1.5"><span>{h.calculator_name} <span className="text-muted-foreground">· {h.category}</span></span><span className="shrink-0 text-muted-foreground">{new Date(h.occurred_at).toLocaleString()}</span></li>)}
                  </ul>
                  {historyShown < detail.history.recent.length && <button className="text-xs underline" onClick={() => setHistoryShown((n) => n + 20)}>Show more</button>}
                </>
              )}
              <p className="font-medium">Payments</p>
              <ul className="text-xs">{detail.orders.length ? detail.orders.map((o) => <li key={o.reference}>{d(o.createdAt)} · {formatMoney(o.amountMinor, o.currency === "USD" ? "USD" : "NGN")} · {o.status}</li>) : <li>None</li>}</ul>
              <p className="font-medium">Recent activity</p>
              <ul className="text-xs">{detail.audit.length ? detail.audit.map((a) => <li key={a.id}>{new Date(a.at).toLocaleString()} · {a.action}</li>) : <li>None</li>}</ul>
            </div>
          )}
        </section>
      )}

      {tab === "Organisations" && (
        <section className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left"><tr><th className="p-2">Organisation</th><th className="p-2">Market</th><th className="p-2">Seats</th><th className="p-2">Plan</th><th className="p-2">Managed discount</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-t align-top">
                  <td className="p-2">{o.name}<span className="block text-xs text-muted-foreground">{o.orgType}</span></td>
                  <td className="p-2"><select className="rounded border bg-background px-1 py-0.5" value={o.market} onChange={(e) => void run({ action: "setOrgMarket", orgId: o.id, market: e.target.value }, () => loadBilling())}><option value="ng">Nigeria (₦)</option><option value="intl">International ($)</option></select></td>
                  <td className="p-2">{o.seats}</td>
                  <td className="p-2">{o.subscription ? `${o.subscription.plan} · ${o.subscription.status}${o.subscription.currentPeriodEnd ? ` · to ${d(o.subscription.currentPeriodEnd)}` : ""}` : "None"}</td>
                  <td className="p-2 space-x-2">{o.managedStatus}{o.managedStatus === "requested" && <><button className="underline" onClick={() => void run({ action: "verifyManaged", orgId: o.id }, loadBilling)}>Verify</button><button className="underline" onClick={() => void run({ action: "rejectManaged", orgId: o.id }, loadBilling)}>Reject</button></>}</td>
                  <td className="p-2">{o.suspended ? <span className="text-destructive">Suspended</span> : "Active"}</td>
                  <td className="p-2 space-x-3 whitespace-nowrap">
                    {o.suspended ? <button className="underline" onClick={() => void run({ action: "restoreOrg", orgId: o.id }, loadBilling)}>Restore</button> : <button className="underline" onClick={() => void suspendOrg(o)}>Suspend</button>}
                    <button className="underline text-destructive" onClick={() => void deleteOrg(o)}>Delete</button>
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={7}>No organisations yet.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {tab === "Pricing" && (pricing ? <PricingEditor initial={pricing} onSaved={setPricing} /> : <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" />)}

      {tab === "Audit" && (
        <section className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-2">When</th><th className="p-2">By</th><th className="p-2">Action</th><th className="p-2">Detail</th></tr></thead>
            <tbody>{audit.map((a) => <tr key={a.id} className="border-t align-top"><td className="p-2 whitespace-nowrap">{new Date(a.at).toLocaleString()}</td><td className="p-2">{a.actor_kind}</td><td className="p-2">{a.action}</td><td className="p-2 text-xs break-all">{JSON.stringify(a.detail)}</td></tr>)}</tbody></table>
        </section>
      )}
    </div>
  )
}
