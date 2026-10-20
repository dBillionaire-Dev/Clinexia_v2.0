"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/components/ui/app-dialogs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/billing/client"
import { PLATFORMS, type Campaign, type CampaignFields, type Platform, type Question, type QuestionType } from "@/lib/campaigns/model"
import { CampaignView } from "@/components/campaigns/campaign-view"
import { PushAdmin } from "./push-admin"

type Listed = Campaign & { responses: number }
type Response = { id: string; version: number; platform: string | null; createdAt: string; answers: Record<string, unknown> }

const BLANK: CampaignFields = {
  title: "", kind: "notice", presentation: "modal", heading: "", body: "", ctaLabel: "", ctaUrl: "", questions: [], audience: "everyone", platforms: [...PLATFORMS], frequency: "once", repeatDays: 7,
  allowLater: true, laterHours: 8, durationSeconds: null, dismissible: true, startsAt: null, endsAt: null, status: "draft",
}
const REVIEW: CampaignFields = {
  ...BLANK, title: "Review form", kind: "form", heading: "How is Clinexia working for you?", body: "It takes about a minute.",
  questions: [
    { id: "q1", type: "rating", label: "How would you rate Clinexia?", required: true },
    { id: "q2", type: "text", label: "What should we improve?", required: false },
  ],
}
const PLATFORM_LABEL: Record<Platform, string> = { web: "Website", android: "Android app", mobile_web: "Mobile website" }
const TYPE_LABEL: Record<QuestionType, string> = { rating: "Star rating (1–5)", text: "Written answer", choice: "Pick one", multi: "Pick several", yesno: "Yes / No" }
const field = "w-full rounded-md border bg-background px-3 py-2 text-sm"
const toLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null)
const when = (c: CampaignFields) => (c.startsAt ? `from ${new Date(c.startsAt).toLocaleString()}` : "starts when switched on") + (c.endsAt ? `, until ${new Date(c.endsAt).toLocaleString()}` : "")

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}</label>
}

function QuestionEditor({ questions, onChange }: { questions: Question[]; onChange: (q: Question[]) => void }) {
  const patch = (i: number, p: Partial<Question>) => onChange(questions.map((q, k) => (k === i ? { ...q, ...p } : q)))
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= questions.length) return; const next = [...questions]; [next[i], next[j]] = [next[j], next[i]]; onChange(next) }
  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Question {i + 1}</span>
            <select className="rounded-md border bg-background px-2 py-1 text-sm" value={q.type} onChange={(e) => patch(i, { type: e.target.value as QuestionType, options: e.target.value === "choice" || e.target.value === "multi" ? q.options ?? ["", ""] : undefined })}>
              {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={q.required} onChange={(e) => patch(i, { required: e.target.checked })} />Required</label>
            <span className="ml-auto space-x-2 text-sm"><button type="button" className="underline" onClick={() => move(i, -1)}>Up</button><button type="button" className="underline" onClick={() => move(i, 1)}>Down</button><button type="button" className="underline text-destructive" onClick={() => onChange(questions.filter((_, k) => k !== i))}>Remove</button></span>
          </div>
          <input className={field} placeholder="The question people will see" value={q.label} onChange={(e) => patch(i, { label: e.target.value })} />
          {(q.type === "choice" || q.type === "multi") && <textarea className={field} rows={3} placeholder="One option per line" value={(q.options ?? []).join("\n")} onChange={(e) => patch(i, { options: e.target.value.split("\n") })} />}
        </div>
      ))}
      {questions.length < 12 && <Button type="button" variant="outline" size="sm" onClick={() => onChange([...questions, { id: `q${questions.length + 1}`, type: "text", label: "", required: false }])}>Add a question</Button>}
    </div>
  )
}

function Editor({ initial, id, version, onSaved, onBack }: { initial: CampaignFields; id?: string; version?: number; onSaved: (c: Campaign) => void; onBack: () => void }) {
  const [c, setC] = useState<CampaignFields>(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const set = <K extends keyof CampaignFields>(k: K, v: CampaignFields[K]) => setC((cur) => ({ ...cur, [k]: v }))
  const compactKind = c.presentation !== "modal"

  async function save(status?: CampaignFields["status"]) {
    setBusy(true); setMsg("")
    const body = { ...c, ...(status ? { status } : {}), questions: c.kind === "form" ? c.questions.map((q) => ({ ...q, options: q.options?.map((o) => o.trim()).filter(Boolean) })) : [] }
    const r = await api<{ campaign: Campaign }>("/api/admin/campaigns", { action: "save", id, campaign: body })
    setBusy(false)
    if (!r.ok) return setMsg(r.error)
    setMsg(status === "active" ? "Saved and switched on." : "Saved.")
    setC({ ...c, ...(status ? { status } : {}) })
    onSaved(r.data.campaign)
  }

  const preview = { ...c, id: id ?? "preview", version: version ?? 1 }
  return (
    <div className="space-y-6">
      <button className="text-sm underline" onClick={onBack}>← All campaigns</button>
      <h2 className="text-xl font-semibold">{id ? "Edit campaign" : "New campaign"}</h2>

      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="font-medium">What people see</h3>
        <Row label="Name (only you see this)"><input className={field} value={c.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. November review" /></Row>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Type"><select className={field} value={c.kind} onChange={(e) => set("kind", e.target.value as CampaignFields["kind"])}><option value="notice">Notice (a message)</option><option value="form">Review form (questions)</option></select></Row>
          <Row label="How it appears"><select className={field} value={c.presentation} onChange={(e) => set("presentation", e.target.value as CampaignFields["presentation"])}><option value="modal">Pop-up window</option><option value="banner">Bar under the header</option><option value="toast">Small alert in the corner</option></select></Row>
        </div>
        <Row label="Heading"><input className={field} value={c.heading} onChange={(e) => set("heading", e.target.value)} /></Row>
        <Row label="Message (optional)"><textarea className={field} rows={3} value={c.body} onChange={(e) => set("body", e.target.value)} /></Row>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Button label (optional)"><input className={field} value={c.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="e.g. See what's new" /></Row>
          <Row label="Button link" hint="A page in the app like /calculators, or an https:// address."><input className={field} value={c.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} placeholder="/calculators" /></Row>
        </div>
      </section>

      {c.kind === "form" && <section className="space-y-3 rounded-lg border p-4"><h3 className="font-medium">Questions</h3><QuestionEditor questions={c.questions} onChange={(q) => set("questions", q)} /></section>}

      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="font-medium">Who, when and how often</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Who sees it"><select className={field} value={c.audience} onChange={(e) => set("audience", e.target.value as CampaignFields["audience"])}><option value="everyone">Everyone</option><option value="guests">People not signed in</option><option value="signed_in">Signed-in people</option></select></Row>
          <div className="sm:col-span-2 text-sm"><span className="mb-1 block font-medium">Where it shows</span>
            <div className="flex flex-wrap gap-x-5 gap-y-1">{PLATFORMS.map((p) => <label key={p} className="flex items-center gap-2"><input type="checkbox" checked={c.platforms.includes(p)} onChange={(e) => set("platforms", e.target.checked ? [...c.platforms, p] : c.platforms.filter((x) => x !== p))} />{PLATFORM_LABEL[p]}</label>)}</div>
            <span className="mt-1 block text-xs text-muted-foreground">Untick the places you do not want it, for example only the Android app.</span></div>
          <Row label="How often"><select className={field} value={c.frequency} onChange={(e) => set("frequency", e.target.value as CampaignFields["frequency"])}><option value="once">Once per person</option><option value="every_visit">Every visit</option><option value="every_days">Every few days</option></select></Row>
          {c.frequency === "every_days" && <Row label="Repeat every (days)"><input type="number" min={1} max={365} className={field} value={c.repeatDays} onChange={(e) => set("repeatDays", Number(e.target.value) || 1)} /></Row>}
          <Row label="Starts" hint="Leave empty to start as soon as it is switched on. Uses your local time."><input type="datetime-local" className={field} value={toLocal(c.startsAt)} onChange={(e) => set("startsAt", fromLocal(e.target.value))} /></Row>
          <Row label="Ends (optional)"><input type="datetime-local" className={field} value={toLocal(c.endsAt)} onChange={(e) => set("endsAt", fromLocal(e.target.value))} /></Row>
          {compactKind && <Row label="Hide by itself after (seconds)" hint="Leave empty to keep it until closed."><input type="number" min={3} max={600} className={field} value={c.durationSeconds ?? ""} onChange={(e) => set("durationSeconds", e.target.value === "" ? null : Number(e.target.value))} /></Row>}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={c.allowLater} onChange={(e) => set("allowLater", e.target.checked)} />Show "Remind me later"</label>
          {c.allowLater && <label className="flex items-center gap-2">Remind after <input type="number" min={1} max={720} className="w-20 rounded-md border bg-background px-2 py-1" value={c.laterHours} onChange={(e) => set("laterHours", Number(e.target.value) || 1)} /> hours</label>}
          <label className="flex items-center gap-2"><input type="checkbox" checked={c.dismissible} onChange={(e) => set("dismissible", e.target.checked)} />Can be closed without acting</label>
        </div>
        <p className="text-xs text-muted-foreground">People who answer a form are never shown it again unless you choose "Show again to everyone". People who tap "Remind me later" see it again after the wait.</p>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h3 className="font-medium">Preview</h3>
        <div className="rounded-md border bg-muted/30 p-4">
          <div className={c.presentation === "modal" ? "mx-auto max-w-lg rounded-lg border bg-background p-5 shadow-lg" : c.presentation === "banner" ? "rounded-md border-b bg-primary/10 p-3" : "ml-auto max-w-sm rounded-lg border bg-background p-4 shadow-lg"}>
            <CampaignView campaign={preview} variant={c.presentation} inlineForm preview onClose={() => undefined} onLater={() => undefined} onCta={() => undefined} onOpenForm={() => undefined} onSubmit={async () => null} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Buttons here do nothing. In the app a banner or alert opens the form in a pop-up window.</p>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="font-medium">Status: {c.status === "active" ? "On" : c.status === "paused" ? "Paused" : "Draft"} ({when(c)})</h3>
        {msg && <p role="status" className="text-sm">{msg}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
          {c.status !== "active" && <Button variant="outline" onClick={() => void save("active")} disabled={busy}>Save and switch on</Button>}
          {c.status === "active" && <Button variant="outline" onClick={() => void save("paused")} disabled={busy}>Pause</Button>}
        </div>
      </section>
    </div>
  )
}

function Responses({ id, questions }: { id: string; questions: Question[] }) {
  const [rows, setRows] = useState<Response[] | null>(null)
  const [open, setOpen] = useState<Response | null>(null)
  const load = useCallback(async () => { const r = await api<{ responses: Response[] }>(`/api/admin/campaigns?id=${id}`); setRows(r.ok ? r.data.responses : []) }, [id])
  useEffect(() => { void load() }, [load])
  const show = (a: unknown) => (Array.isArray(a) ? a.join(", ") : a === undefined || a === "" ? "—" : String(a))
  const first = (r: Response) => { const q = questions[0]; return q ? `${q.label}: ${show(r.answers[q.id])}` : "" }
  async function remove(r: Response) {
    if (!(await confirmDialog({ title: "Delete this response?", destructive: true, confirmLabel: "Delete" }))) return
    await api("/api/admin/campaigns", { action: "deleteResponse", responseId: r.id }); setOpen(null); void load()
  }
  if (rows === null) return <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" />
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Responses ({rows.length})</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No responses yet.</p> : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => <li key={r.id}><button type="button" onClick={() => setOpen(r)} className="flex w-full items-start justify-between gap-3 p-3 text-left text-sm hover:bg-muted/50"><span className="min-w-0 truncate">{first(r)}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span></button></li>)}
        </ul>
      )}
      <Dialog open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {open && (<>
            <DialogHeader><DialogTitle>Response</DialogTitle><DialogDescription>{new Date(open.createdAt).toLocaleString()} · {open.platform ?? "unknown device"} · version {open.version}</DialogDescription></DialogHeader>
            <div className="space-y-3 text-sm">{questions.map((q) => <div key={q.id}><p className="text-xs font-medium uppercase text-muted-foreground">{q.label}</p><p className="whitespace-pre-wrap">{show(open.answers[q.id])}</p></div>)}</div>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => void remove(open)}>Delete this response</Button>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function CampaignsAdmin() {
  const [list, setList] = useState<Listed[] | null>(null)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<{ fields: CampaignFields; id?: string; version?: number; responses?: number } | null>(null)
  const [note, setNote] = useState("")
  const [tab, setTab] = useState<"campaigns" | "push">("campaigns")

  const load = useCallback(async () => {
    const r = await api<{ campaigns: Listed[] }>("/api/admin/campaigns")
    if (r.ok) { setList(r.data.campaigns); setError("") } else { setList([]); setError(r.status === 401 ? "Admin session expired. Sign in again." : r.error) }
  }, [])
  useEffect(() => { void load() }, [load])

  const fieldsOf = (c: Campaign): CampaignFields => { const { id: _i, version: _v, ...rest } = c; return rest }
  async function setStatus(c: Listed, status: "active" | "paused") { const r = await api("/api/admin/campaigns", { action: "setStatus", id: c.id, status }); if (!r.ok) setNote(r.error); await load() }
  async function again(c: Listed) {
    if (!(await confirmDialog({ title: "Show again to everyone?", description: "People who already answered or closed it will see it again, as if it were new.", confirmLabel: "Show again" }))) return
    await api("/api/admin/campaigns", { action: "showAgain", id: c.id }); setNote("It will be shown again to everyone."); await load()
  }
  async function remove(c: Listed) {
    if (!(await confirmDialog({ title: `Delete "${c.title}"?`, description: "Its responses are deleted too. This cannot be undone.", confirmLabel: "Delete", destructive: true }))) return
    await api("/api/admin/campaigns", { action: "delete", id: c.id }); await load()
  }

  if (editing)
    return (
      <div className="space-y-8">
        <Editor key={editing.id ?? "new"} initial={editing.fields} id={editing.id} version={editing.version} onSaved={(c) => { setEditing({ fields: fieldsOf(c), id: c.id, version: c.version }); void load() }} onBack={() => { setEditing(null); void load() }} />
        {editing.id && editing.fields.kind === "form" && <Responses id={editing.id} questions={editing.fields.questions} />}
      </div>
    )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Campaigns</h1><p className="text-sm text-muted-foreground">Notices and review forms shown inside the app. Choose what they say, how they appear, who sees them and when. No code needed.</p></div>
        <Link href="/admin" className="text-sm underline">← Admin home</Link>
      </header>
      <nav className="flex gap-2" aria-label="Sections">
        {([["campaigns", "Campaigns"], ["push", "Phone notifications"]] as const).map(([k, label]) => <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={`rounded-full border px-4 py-1.5 text-sm ${tab === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{label}</button>)}
      </nav>
      {tab === "push" ? <PushAdmin /> : (<>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditing({ fields: REVIEW })}>New review form</Button>
        <Button variant="outline" onClick={() => setEditing({ fields: { ...BLANK, title: "Announcement", heading: "What's new in Clinexia", presentation: "banner" } })}>New announcement</Button>
        <Button variant="outline" onClick={() => setEditing({ fields: BLANK })}>Start from blank</Button>
      </div>
      {note && <p role="status" className="rounded-md border p-2 text-sm">{note}</p>}
      {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {list === null ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" /> : list.length === 0 && !error ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">No campaigns yet. Start with a review form or an announcement.</p> : (
        <ul className="divide-y rounded-lg border">
          {list.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing({ fields: fieldsOf(c), id: c.id, version: c.version })}>
                <span className="block truncate font-medium">{c.title}</span>
                <span className="block text-xs text-muted-foreground">{c.kind === "form" ? "Review form" : "Notice"} · {c.presentation === "modal" ? "pop-up" : c.presentation === "banner" ? "banner" : "alert"} · {c.audience === "everyone" ? "everyone" : c.audience === "guests" ? "guests" : "signed in"} · {c.platforms.length === 3 ? "all apps" : c.platforms.map((p) => PLATFORM_LABEL[p]).join(" + ")} · {when(c)}{c.kind === "form" ? ` · ${c.responses} response${c.responses === 1 ? "" : "s"}` : ""}</span>
              </button>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs ${c.status === "active" ? "border-green-600/50 text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>{c.status === "active" ? "On" : c.status === "paused" ? "Paused" : "Draft"}</span>
              <span className="space-x-3 text-sm">
                {c.status === "active" ? <button className="underline" onClick={() => void setStatus(c, "paused")}>Pause</button> : <button className="underline" onClick={() => void setStatus(c, "active")}>Switch on</button>}
                <button className="underline" onClick={() => void again(c)}>Show again to everyone</button>
                <button className="underline text-destructive" onClick={() => void remove(c)}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      </>)}
    </div>
  )
}
