"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { SMART_ALLOWED_ISS, SMART_CLIENT_ID } from "@/lib/smart/env"
import { isAllowedIss, normaliseIss, smartScopes } from "@/lib/smart/config"
import { saveOptions } from "@/lib/smart/session"
import { resolveSmartCalculator } from "@/lib/smart/targets"

type State = { kind: "working" } | { kind: "choose" } | { kind: "error"; message: string }

/**
 * SMART App Launch entry point.
 *   EHR launch:        the EHR opens  /smart/launch?iss=<fhir base>&launch=<token>   (add &calc=<calculator id> and &embed=1 in the registered launch URL)
 *   Standalone launch: open /smart/launch (optionally ?iss=...) and pick an allowed FHIR server.
 * Authorisation uses PKCE and no client secret. Everything runs in the browser; nothing about the patient reaches Clinexia.
 */
export default function SmartLaunchPage() {
  const [state, setState] = useState<State>({ kind: "working" })
  const started = useRef(false)

  async function start(iss: string, launch: string | null, calc: string | null, embed: boolean) {
    setState({ kind: "working" })
    try {
      saveOptions({ calculatorId: resolveSmartCalculator(calc).id, embed })
      const FHIR = (await import("fhirclient")).default
      const redirectUri = `${window.location.origin}/smart/callback`
      const common = { clientId: SMART_CLIENT_ID, redirectUri, pkceMode: "required" as const }
      // UNVERIFIED against the library: option names follow fhirclient v2 (iss + launch for an EHR launch, fhirServiceUrl for a standalone one).
      // (cast: the exact option typings of the installed fhirclient version were not checked, see FINDINGS.md)
      if (launch) await FHIR.oauth2.authorize({ ...common, scope: smartScopes(false), iss, launch } as never)
      else await FHIR.oauth2.authorize({ ...common, scope: smartScopes(true), fhirServiceUrl: iss } as never)
    } catch {
      setState({ kind: "error", message: "The launch could not be started. Check the FHIR server address and the app registration, then try again." })
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    const q = new URLSearchParams(window.location.search)
    const iss = q.get("iss")
    const launch = q.get("launch")
    const calc = q.get("calc")
    const embed = q.get("embed") === "1"
    if (!SMART_CLIENT_ID) return setState({ kind: "error", message: "SMART launch is not configured on this server (no client id)." })
    if (SMART_ALLOWED_ISS.length === 0) return setState({ kind: "error", message: "SMART launch is not configured on this server (no FHIR servers are allowed)." })
    if (iss) {
      if (!isAllowedIss(iss, SMART_ALLOWED_ISS)) return setState({ kind: "error", message: "This FHIR server is not on the list of servers this app may connect to." })
      void start(normaliseIss(iss) as string, launch, calc, embed)
      return
    }
    setState({ kind: "choose" })
  }, [])

  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Connect to a patient record</h1>
      {state.kind === "working" && <p className="text-muted-foreground" role="status">Starting the secure sign-in…</p>}
      {state.kind === "error" && <p className="text-destructive" role="alert">{state.message}</p>}
      {state.kind === "choose" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Choose the record system to read age, sex and recent results from. Clinexia reads them in your browser only.</p>
          <ul className="space-y-2">
            {SMART_ALLOWED_ISS.map((iss) => (
              <li key={iss}>
                <Button variant="outline" className="w-full justify-start break-all" onClick={() => void start(iss, null, params.get("calc"), params.get("embed") === "1")}>{iss}</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">A calculation and reference aid for qualified clinicians. Verify every result. Not a diagnostic device.</p>
    </div>
  )
}
