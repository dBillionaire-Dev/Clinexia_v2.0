"use client"
// clinexia-upgrade:phase8 — "Explain in plain language", shown with a result once a clinician has approved the wording.
import { useState } from "react"
import type { ResultLike } from "@/lib/clinical/patient-explanations"
import { getPatientExplanation } from "@/lib/clinical/patient-explanations"
import { Button } from "@/components/ui/button"

export function PlainLanguagePanel({ calculatorId, result }: { calculatorId: string; result: ResultLike }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null)
  const e = getPatientExplanation(calculatorId, result)
  if (!e) return null
  return (
    <details className="rounded-md border bg-muted/20 p-3 text-sm">
      <summary className="cursor-pointer font-medium">Explain in plain language (for patients)</summary>
      <div className="mt-3 space-y-3">
        <h4 className="text-base font-semibold">{e.title}</h4>
        {e.sections.map((s) => (
          <div key={s.heading}>
            <p className="font-medium">{s.heading}</p>
            <p className="text-muted-foreground">{s.text}</p>
          </div>
        ))}
        <div>
          <p className="font-medium">Questions you could ask</p>
          <ul className="list-disc pl-5 text-muted-foreground">{e.questions.map((q) => <li key={q}>{q}</li>)}</ul>
        </div>
        <p className="rounded-md border border-amber-300/50 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200" role="note">{e.disclaimer}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(e.copyText).then(() => setCopied("yes"), () => setCopied("no")) }}>Copy this text</Button>
        {copied ? <span role="status" className="ml-2 text-xs text-muted-foreground">{copied === "yes" ? "Copied." : "Could not copy. Select the text and copy it by hand."}</span> : null}
      </div>
    </details>
  )
}
