"use client"

import { useState } from "react"
import { Loader2, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Answers, Campaign, Question } from "@/lib/campaigns/model"

/** What the app (and the admin preview) needs to draw a campaign. The admin-only name and status are not sent to the app. */
export type PublicCampaign = Omit<Campaign, "title" | "status">

function Field({ q, value, onChange }: { q: Question; value: unknown; onChange: (v: string | number | string[]) => void }) {
  const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-sm transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`
  if (q.type === "rating")
    return (
      <div className="flex gap-1" role="radiogroup" aria-label={q.label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => onChange(n)} className="rounded p-1">
            <Star className={`h-8 w-8 ${typeof value === "number" && n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
    )
  if (q.type === "text") return <textarea rows={3} maxLength={1000} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" aria-label={q.label} />
  if (q.type === "yesno")
    return <div className="flex gap-2">{(["yes", "no"] as const).map((v) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={chip(value === v)}>{v === "yes" ? "Yes" : "No"}</button>)}</div>
  if (q.type === "choice")
    return <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={q.label}>{q.options?.map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={chip(value === o)}>{o}</button>)}</div>
  const picked = Array.isArray(value) ? (value as string[]) : []
  return <div className="flex flex-wrap gap-2" role="group" aria-label={q.label}>{q.options?.map((o) => <button key={o} type="button" aria-pressed={picked.includes(o)} onClick={() => onChange(picked.includes(o) ? picked.filter((x) => x !== o) : [...picked, o])} className={chip(picked.includes(o))}>{o}</button>)}</div>
}

export function CampaignForm({ campaign, onSubmit, preview }: { campaign: PublicCampaign; onSubmit: (a: Answers) => Promise<string | null>; preview?: boolean }) {
  const [answers, setAnswers] = useState<Answers>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  async function send() {
    const missing = campaign.questions.find((q) => q.required && (answers[q.id] === undefined || answers[q.id] === "" || (Array.isArray(answers[q.id]) && (answers[q.id] as string[]).length === 0)))
    if (missing) return setError(`Please answer: ${missing.label}`)
    setBusy(true); setError("")
    const problem = await onSubmit(answers)
    setBusy(false)
    if (problem) setError(problem)
    else setSent(true)
  }

  if (sent) return <p role="status" className="py-4 text-center text-sm font-medium">Thank you. Your answer has been sent.</p>
  return (
    <div className="space-y-5">
      {campaign.questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <p className="text-sm font-medium">{q.label}{q.required ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}</p>
          <Field q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
        </div>
      ))}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button onClick={send} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : preview ? "Send (preview: nothing is saved)" : "Send"}</Button>
    </div>
  )
}

export interface ViewProps {
  campaign: PublicCampaign
  variant: "modal" | "banner" | "toast"
  /** Show the form inside this card (modal and preview) instead of behind a button (banner and alert). */
  inlineForm: boolean
  preview?: boolean
  onClose: () => void
  onLater: () => void
  onCta: () => void
  onOpenForm: () => void
  onSubmit: (a: Answers) => Promise<string | null>
}

/** The content of a campaign. The caller decides where it sits (pop-up window, bar under the header, or corner alert). */
export function CampaignView({ campaign: c, variant, inlineForm, preview, onClose, onLater, onCta, onOpenForm, onSubmit }: ViewProps) {
  const compact = variant !== "modal"
  return (
    <div className={compact ? "flex flex-wrap items-center gap-x-4 gap-y-2" : "space-y-4"}>
      <div className={compact ? "min-w-0 flex-1" : "space-y-1.5"}>
        <p className="text-sm font-semibold">{c.heading}</p>
        {c.body && <p className="whitespace-pre-line text-sm text-muted-foreground">{c.body}</p>}
      </div>
      {c.kind === "form" && inlineForm && <div className="w-full"><CampaignForm campaign={c} onSubmit={onSubmit} preview={preview} /></div>}
      <div className="flex flex-wrap items-center gap-2">
        {c.kind === "form" && !inlineForm && <Button size="sm" onClick={onOpenForm}>Give feedback</Button>}
        {c.ctaLabel && c.ctaUrl && <Button size="sm" variant={c.kind === "form" ? "outline" : "default"} onClick={onCta}>{c.ctaLabel}</Button>}
        {c.allowLater && <Button size="sm" variant="outline" onClick={onLater}>Remind me later</Button>}
        {c.dismissible && (compact ? <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="Dismiss"><X className="h-4 w-4" /></Button> : <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>)}
      </div>
    </div>
  )
}
