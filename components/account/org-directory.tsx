"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export type Group = { id: string; name: string; members: number }
type Result = { email: string; name: string; status: string; message?: string; emailed?: boolean }
type Act = (body: Record<string, unknown>, ask?: { title: string; description?: string; confirmLabel?: string; destructive?: boolean }) => Promise<{ ok: boolean; data?: any; error?: string } | null>

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm"
const STATUS: Record<string, string> = { created: "Account created", has_account: "Already has an account", no_capacity: "No free seats", invalid: "Not added", duplicate: "Listed twice", error: "Failed" }
const TEMPLATE = "name,email,role,group\nAda Obi,ada@example.com,staff,Laboratory\n"

/** The organisation directory: groups, and adding people (one at a time or a pasted spreadsheet). */
export function OrgDirectory({ role, groups, act }: { role: "owner" | "admin" | "staff"; groups: Group[]; act: Act }) {
  const [newGroup, setNewGroup] = useState("")
  const [names, setNames] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<"one" | "sheet">("one")
  const [one, setOne] = useState({ name: "", email: "", role: "staff", groupId: "" })
  const [csv, setCsv] = useState("")
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Result[] | null>(null)
  const [mailOff, setMailOff] = useState(false)

  async function addGroup(e: React.FormEvent) {
    e.preventDefault()
    const r = await act({ action: "groupCreate", name: newGroup })
    if (r?.ok) setNewGroup("")
  }
  async function submitPeople(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setResults(null)
    const body = mode === "one" ? { action: "addPeople", rows: [{ name: one.name, email: one.email, role: one.role }], groupId: one.groupId } : { action: "addPeople", csv }
    const r = await act(body)
    setBusy(false)
    if (r?.ok) {
      setResults(r.data.results); setMailOff(r.data.emailConfigured === false)
      if (mode === "one") setOne({ ...one, name: "", email: "" }); else setCsv("")
    }
  }
  async function readFile(f: File | undefined) {
    if (!f) return
    if (f.size > 200_000) return setResults([{ email: "", name: "", status: "invalid", message: "That file is too large. Keep it under 200 KB." }])
    setCsv(await f.text())
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-medium">Groups</h2>
        <p className="text-sm text-muted-foreground">Groups (departments, wards, teams) help you organise members. Put each member in a group from the members table above.</p>
        {groups.length > 0 && (
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 text-sm">
                <input className={`${input} max-w-xs`} aria-label={`Name of group ${g.name}`} value={names[g.id] ?? g.name} maxLength={60} onChange={(e) => setNames({ ...names, [g.id]: e.target.value })} />
                <span className="text-xs text-muted-foreground">{g.members} member{g.members === 1 ? "" : "s"}</span>
                {(names[g.id] ?? g.name) !== g.name && <button className="underline" onClick={() => act({ action: "groupRename", groupId: g.id, name: names[g.id] })}>Save name</button>}
                <button className="underline text-destructive" onClick={() => act({ action: "groupDelete", groupId: g.id }, { title: `Delete the group “${g.name}”?`, description: "Its members stay in the organisation, with no group.", confirmLabel: "Delete", destructive: true })}>Delete</button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addGroup} className="flex flex-wrap items-center gap-2"><input className={`${input} max-w-xs`} placeholder="New group name" value={newGroup} maxLength={60} onChange={(e) => setNewGroup(e.target.value)} required /><Button type="submit" variant="outline">Add group</Button></form>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Add people</h2>
        <p className="text-sm text-muted-foreground">Create accounts for your staff yourself. Each person gets an email with a link to choose their own password, and uses one seat. People who already have a Clinexia account must be invited instead, so they can accept.</p>
        <div className="flex gap-4 text-sm" role="tablist">
          <button role="tab" aria-selected={mode === "one"} className={mode === "one" ? "font-semibold underline" : "underline"} onClick={() => setMode("one")}>One person</button>
          <button role="tab" aria-selected={mode === "sheet"} className={mode === "sheet" ? "font-semibold underline" : "underline"} onClick={() => setMode("sheet")}>Spreadsheet (up to 50)</button>
        </div>
        <form onSubmit={submitPeople} className="space-y-3">
          {mode === "one" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm"><span className="mb-1 block font-medium">Full name</span><input className={input} value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} required minLength={2} maxLength={100} /></label>
              <label className="text-sm"><span className="mb-1 block font-medium">Email</span><input className={input} type="email" value={one.email} onChange={(e) => setOne({ ...one, email: e.target.value })} required /></label>
              <label className="text-sm"><span className="mb-1 block font-medium">Group</span><select className={input} value={one.groupId} onChange={(e) => setOne({ ...one, groupId: e.target.value })}><option value="">No group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
              {role === "owner" && <label className="text-sm"><span className="mb-1 block font-medium">Role</span><select className={input} value={one.role} onChange={(e) => setOne({ ...one, role: e.target.value })}><option value="staff">Staff</option><option value="admin">Administrator</option></select></label>}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm"><span className="mb-1 block font-medium">Paste your spreadsheet (first row: name, email, and optionally role, group)</span>
                <textarea className={`${input} min-h-36 font-mono text-xs`} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={TEMPLATE} required /></label>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="underline cursor-pointer">Load a .csv file<input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = "" }} /></label>
                <span className="text-xs text-muted-foreground">Groups that do not exist yet are created for you.</span>
              </div>
            </div>
          )}
          <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "one" ? "Create account" : "Create accounts"}</Button>
        </form>
        {results && (
          <div className="space-y-2 rounded-md border p-3 text-sm" role="status">
            {mailOff && <p className="text-amber-700">Email is not set up on the server, so nobody was emailed. Use “Send password email” in the members table once it is.</p>}
            <ul className="space-y-1">
              {results.map((r, i) => <li key={`${r.email}-${i}`}><strong>{r.email || "—"}</strong>: {STATUS[r.status] ?? r.status}{r.status === "created" ? (r.emailed ? ", email sent" : ", email not sent (use “Send password email”)") : r.message ? `. ${r.message}` : ""}</li>)}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
