"use client"
// clinexia-upgrade:phase2 — shows what kind of result this is, who it is for, the sources and the limits.

import type { CalculationResult } from "@/lib/calculators/types"
import { RESULT_KIND_TEXT, getEvidence, lookupBand } from "@/lib/clinical/evidence"
import { reviewSummary } from "@/lib/clinical/review"
import { getSuggestions } from "@/lib/clinical/suggestions"
import { PlainLanguagePanel } from "@/components/clinical/plain-language-panel" // clinexia-upgrade:phase8 plain
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

export function EvidencePanel({ calculatorId, result, inputs }: { calculatorId: string; result: CalculationResult; inputs: Record<string, string | number> | null }) {
  const record = getEvidence(calculatorId)
  const suggestions = getSuggestions(calculatorId, inputs)
  const suggestionBlock = suggestions.length ? (
    <div className="space-y-2 text-sm">
      {suggestions.map((s) => (
        <div key={s.id} className="rounded-md border bg-muted/30 p-3" role="note">
          <p>{s.text}</p>
          {s.href ? <Link href={s.href} className="mt-1 inline-block text-primary underline underline-offset-2">{s.linkLabel ?? "Open"}</Link> : null}
        </div>
      ))}
    </div>
  ) : null
  const plain = <PlainLanguagePanel calculatorId={calculatorId} result={result} />
  if (!record) return <>{suggestionBlock}{plain}</>
  const numeric = typeof result.value === "number" ? result.value : null
  const lookup = numeric === null ? { band: null, withheld: false } : lookupBand(calculatorId, numeric, inputs ?? {})
  const reviewKey = record.bands?.length ? `${calculatorId}:bands` : calculatorId

  return (
    <div className="space-y-3 text-sm">
      {suggestionBlock}
      {plain}
      <Separator />
      <h4 className="text-sm font-medium text-muted-foreground">About this result</h4>
      <p>{RESULT_KIND_TEXT[record.resultKind]}</p>

      {lookup.band ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-1">
          <p className="font-medium">{lookup.band.label}</p>
          <p className="text-muted-foreground">{lookup.band.meaning}</p>
          <p className="text-xs text-muted-foreground">Source: {lookup.band.sourceIds.map((i) => record.sources[i]?.title).filter(Boolean).join("; ")}</p>
        </div>
      ) : null}
      {lookup.withheld ? (
        <p className="text-xs text-muted-foreground">Guideline-based risk categories for this score are not shown yet: they are waiting for clinical review.</p>
      ) : null}

      <p><span className="font-medium">Intended population:</span> {record.intendedPopulation}</p>
      {record.notIntendedFor?.length ? (
        <div>
          <p className="font-medium">Not intended for</p>
          <ul className="list-disc pl-5 text-muted-foreground">{record.notIntendedFor.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      ) : null}
      <div>
        <p className="font-medium">Limitations</p>
        <ul className="list-disc pl-5 text-muted-foreground space-y-1">{record.limitations.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
      <div>
        <p className="font-medium">Sources</p>
        <ul className="list-disc pl-5 space-y-1">
          {record.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2">{s.title}</a>
              <span className="block text-xs text-muted-foreground">{s.citation}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">Content version {record.contentVersion}. {reviewSummary(reviewKey)}</p>
    </div>
  )
}
