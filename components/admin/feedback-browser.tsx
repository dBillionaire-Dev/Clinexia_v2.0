"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/components/ui/app-dialogs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface BrowserRow {
  id: string
  createdAt: string
  rating: number
  role: string
  texts: { improve: string | null; missing: string | null; other: string | null }
  details: Array<[string, string]>
}

const PAGE = 20
const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n)
const snippet = (r: BrowserRow) => r.texts.improve || r.texts.missing || r.texts.other || ""

/** Every response, newest first, a page at a time. Click one to read everything that person answered. */
export function FeedbackBrowser({ rows, deleteAction }: { rows: BrowserRow[]; deleteAction: (formData: FormData) => Promise<void> }) {
  const [onlyText, setOnlyText] = useState(false)
  const [q, setQ] = useState("")
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<BrowserRow | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (onlyText && !snippet(r)) return false
      if (!needle) return true
      return [r.texts.improve, r.texts.missing, r.texts.other, r.role].some((t) => t?.toLowerCase().includes(needle))
    })
  }, [rows, onlyText, q])

  async function remove() {
    if (!open) return
    if (!(await confirmDialog({ title: "Delete this response?", description: "Use this if it contains personal details. It cannot be undone.", confirmLabel: "Delete", destructive: true }))) return
    formRef.current?.requestSubmit()
    window.setTimeout(() => setOpen(null), 150)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} placeholder="Search what people wrote" className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm" />
        <label className="flex items-center gap-2"><input type="checkbox" checked={onlyText} onChange={(e) => { setOnlyText(e.target.checked); setShown(PAGE) }} />Only responses with written comments</label>
        <span className="text-muted-foreground">Showing {Math.min(shown, filtered.length)} of {filtered.length}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">No feedback matches.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-background">
          {filtered.slice(0, shown).map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r)} className="flex w-full items-start gap-4 p-3 text-left hover:bg-muted/50 focus-visible:outline focus-visible:outline-2">
                <span className="w-20 shrink-0 text-sm font-semibold text-amber-500" aria-label={`${r.rating} out of 5`}>{stars(r.rating)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{snippet(r) || <span className="text-muted-foreground">No written comment</span>}</span>
                  <span className="block text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()} · {r.role}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown < filtered.length && <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>Show more</Button>}

      <Dialog open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle><span className="text-amber-500">{stars(open.rating)}</span> <span className="ml-2 text-base font-normal">{open.role}</span></DialogTitle>
                <DialogDescription>{new Date(open.createdAt).toLocaleString()}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {([["What to improve", open.texts.improve], ["What is missing", open.texts.missing], ["Anything else", open.texts.other]] as const).map(([label, text]) => (
                  <div key={label}><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="whitespace-pre-wrap">{text || <span className="text-muted-foreground">Nothing written</span>}</p></div>
                ))}
                <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 border-t pt-3">
                  {open.details.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>))}
                </dl>
                <form ref={formRef} action={deleteAction}><input type="hidden" name="id" value={open.id} /></form>
                <Button variant="outline" size="sm" onClick={remove} className="text-destructive">Delete this response</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
