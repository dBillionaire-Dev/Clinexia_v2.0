"use client"
// clinexia-upgrade:phase2 — one question at a time for point scores, with Yes / No / Unknown, progress,
// back navigation and a review step. Unknown answers produce a range, never a single guessed number.

import { useEffect, useMemo, useRef, useState } from "react"
import type { CalculatorDefinition } from "@/lib/calculators/types"
import { UNKNOWN, buildGuidedSteps, evaluateGuided, formatScoreRange } from "@/lib/clinical/guided"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function GuidedFlow({ definition, onFinish, onCancel }: {
  definition: CalculatorDefinition
  /** `calculate` is true only when every answer is definite. */
  onFinish: (values: Record<string, string>, calculate: boolean) => void
  onCancel: () => void
}) {
  const steps = useMemo(() => buildGuidedSteps(definition), [definition])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState("")
  const heading = useRef<HTMLHeadingElement>(null)
  const reviewing = index >= steps.length
  const step = steps[index]

  useEffect(() => { heading.current?.focus() }, [index])
  useEffect(() => { if (step) setDraft(answers[step.input.id] ?? "") }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (id: string, value: string) => { setAnswers((a) => ({ ...a, [id]: value })); setIndex((i) => i + 1) }
  const evaluation = reviewing ? evaluateGuided(definition, answers) : null
  const label = (id: string) => {
    const s = steps.find((x) => x.input.id === id)!
    const v = answers[id]
    if (v === UNKNOWN) return "Unknown"
    return s.input.options?.find((o) => o.value === v)?.label ?? (s.input.unit ? `${v} ${s.input.unit}` : v)
  }
  const toFormValues = () => Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v === UNKNOWN ? "" : v]))

  return (
    <div className="space-y-4" role="group" aria-label={`${definition.name}, guided questions`}>
      <div>
        <p className="text-xs text-muted-foreground">{reviewing ? "Review your answers" : `Question ${index + 1} of ${steps.length}`}</p>
        <div className="mt-1 h-2 w-full rounded bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={Math.min(index, steps.length)}>
          <div className="h-2 rounded bg-primary transition-all" style={{ width: `${(Math.min(index, steps.length) / steps.length) * 100}%` }} />
        </div>
      </div>

      {step ? (
        <div className="space-y-3">
          <h3 ref={heading} tabIndex={-1} className="text-base font-semibold focus:outline-none">{step.input.label}</h3>
          {step.input.helpText ? <p className="text-sm text-muted-foreground">{step.input.helpText}</p> : null}
          {step.input.kind === "number" ? (
            <div className="flex items-center gap-2">
              <Input type="number" inputMode="decimal" aria-label={step.input.label} value={draft} min={step.input.min} max={step.input.max} step={step.input.step ?? "any"} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && draft !== "") { e.preventDefault(); answer(step.input.id, draft) } }} className="max-w-[10rem]" />
              {step.input.unit ? <span className="text-sm text-muted-foreground">{step.input.unit}</span> : null}
              <Button type="button" disabled={draft === ""} onClick={() => answer(step.input.id, draft)}>Next</Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {step.input.options?.map((o) => (
                <Button key={o.value} type="button" size="lg" variant={answers[step.input.id] === o.value ? "default" : "outline"} aria-pressed={answers[step.input.id] === o.value} onClick={() => answer(step.input.id, o.value)}>{o.label}</Button>
              ))}
              {step.allowUnknown ? <Button type="button" size="lg" variant={answers[step.input.id] === UNKNOWN ? "default" : "outline"} aria-pressed={answers[step.input.id] === UNKNOWN} onClick={() => answer(step.input.id, UNKNOWN)}>Unknown</Button> : null}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h3 ref={heading} tabIndex={-1} className="text-base font-semibold focus:outline-none">Your answers</h3>
          <dl className="space-y-1 text-sm">
            {steps.map((s, i) => (
              <div key={s.input.id} className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{s.input.label}</dt>
                <dd className="flex items-center gap-2 font-medium">{label(s.input.id)}<Button type="button" size="sm" variant="ghost" aria-label={`Change answer: ${s.input.label}`} onClick={() => setIndex(i)}>Change</Button></dd>
              </div>
            ))}
          </dl>
          {evaluation && !evaluation.complete ? <p role="alert" className="text-sm text-destructive">{evaluation.issues.join(" ") || "Some answers are missing. Use Change to complete them."}</p> : null}
          {evaluation?.complete && evaluation.low && evaluation.high ? (
            <div className="rounded-md border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200" role="status">
              <p className="font-medium">Score range: {formatScoreRange(evaluation.low, evaluation.high) ?? "see form"}</p>
              <p>{evaluation.unknownIds.length} answer(s) are unknown, so a single score cannot be given. This range is not saved to history. Find the missing information, or continue in the standard form.</p>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>Back</Button>
        {reviewing && evaluation?.complete && evaluation.definitive ? <Button type="button" onClick={() => onFinish(answers, true)}>Calculate</Button> : null}
        {reviewing && evaluation?.complete && evaluation.low ? <Button type="button" onClick={() => onFinish(toFormValues(), false)}>Continue in standard form</Button> : null}
        <Button type="button" variant="ghost" onClick={onCancel}>Use standard form</Button>
      </div>
    </div>
  )
}
