"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { CalculatorDefinition } from "@clinexia/core"
import { loadRecord } from "@/lib/smart/fhir"
import { mapFhirToInputs, SKIP_MESSAGES, type MappingResult } from "@/lib/smart/mapping"
import { buildPrefillFragment } from "@/lib/smart/provenance"
import { SMART_STALE_THRESHOLDS } from "@/lib/smart/env"
import { clearFhirSession, loadOptions } from "@/lib/smart/session"
import { calculatorPath, resolveSmartCalculator } from "@/lib/smart/targets"

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "review"; def: CalculatorDefinition; embed: boolean; result: MappingResult; failedCodes: string[] }

/**
 * SMART App Launch redirect target. Finishes the sign-in, reads the patient and the observations this calculator needs, shows
 * them WITH their dates for review, and only then opens the calculator with the values in the URL fragment (never sent to a server).
 */
export default function SmartCallbackPage() {
  const [state, setState] = useState<State>({ kind: "loading" })
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // the authorisation code can only be used once
    started.current = true
    ;(async () => {
      try {
        const options = loadOptions()
        const def = resolveSmartCalculator(options?.calculatorId)
        const FHIR = (await import("fhirclient")).default
        const client = await FHIR.oauth2.ready()
        const codes = def.inputs.map((i) => i.fhir?.loinc).filter((c): c is string => Boolean(c))
        const record = await loadRecord(client as never, codes)
        const result = mapFhirToInputs(def, { patient: record.patient, observations: record.observations }, { thresholds: SMART_STALE_THRESHOLDS })
        clearFhirSession() // tokens and patient id leave the browser session as soon as the review is built
        setState({ kind: "review", def, embed: options?.embed === true, result, failedCodes: record.failedCodes })
      } catch {
        clearFhirSession()
        setState({ kind: "error", message: "The sign-in could not be completed. Close this window and launch the app again from the record." })
      }
    })()
  }, [])

  if (state.kind === "loading") return <p className="text-muted-foreground" role="status">Reading the record…</p>
  if (state.kind === "error") return <p className="text-destructive" role="alert">{state.message}</p>

  const { def, embed, result, failedCodes } = state
  const label = (id: string) => def.inputs.find((i) => i.id === id)?.label ?? id
  const unit = (id: string) => def.inputs.find((i) => i.id === id)?.unit ?? ""
  const open = () => window.location.assign(`${calculatorPath(def, embed)}#${buildPrefillFragment(result.values)}`)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{def.name}: review before using</h1>
      <p className="text-sm text-muted-foreground">These values were read from the patient's record in your browser. Nothing was sent to Clinexia. Check each one before relying on it.</p>

      {result.values.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm" aria-label="Values from the record">
          {result.values.map((v) => (
            <li key={v.inputId} className="p-3 space-y-0.5">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{label(v.inputId)}</span>
                <span>{v.value}{unit(v.inputId) ? ` ${unit(v.inputId)}` : ""}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {v.source === "patient" ? "From the patient record" : `Result dated ${v.observedAt} (${v.ageDays === 0 ? "today" : `${v.ageDays} day${v.ageDays === 1 ? "" : "s"} ago`})`}
                {v.converted && v.original ? `. Recorded as ${v.original.value} ${v.original.unit}, converted.` : ""}
              </div>
              {v.stale && <div className="text-xs font-medium text-amber-700 dark:text-amber-400">⚠ Older than {v.staleAfterDays} days. Check it is still current.</div>}
            </li>
          ))}
        </ul>
      )}

      {result.skipped.length > 0 && (
        <div className="rounded-lg border p-3 text-sm space-y-1">
          <p className="font-medium">Not filled in (enter these yourself)</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {result.skipped.map((s) => (<li key={s.inputId}>{label(s.inputId)}: {SKIP_MESSAGES[s.reason]}</li>))}
          </ul>
        </div>
      )}
      {failedCodes.length > 0 && <p className="text-xs text-muted-foreground">Some results could not be searched in this record, so those inputs are left for you.</p>}

      <div className="flex gap-2">
        <Button onClick={open}>Open the calculator</Button>
      </div>
      <p className="text-xs text-muted-foreground">A calculation and reference aid for qualified clinicians. Verify every result. Not a diagnostic device.</p>
    </div>
  )
}
