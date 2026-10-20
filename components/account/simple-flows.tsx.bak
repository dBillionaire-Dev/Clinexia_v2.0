"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/billing/client"

/** Where Paystack sends people back to. It asks the server to confirm the payment; the redirect itself proves nothing. */
export function PaymentReturn({ reference, app }: { reference: string; app?: boolean }) {
  const [state, setState] = useState<"checking" | "paid" | "pending" | "failed" | "error">("checking")
  const [message, setMessage] = useState("")
  useEffect(() => {
    if (app) return // the Clinexia app confirms the payment itself when you go back to it
    let tries = 0
    let stop = false
    async function check() {
      const r = await api<{ status: "paid" | "pending" | "failed" }>("/api/billing/verify", { reference })
      if (stop) return
      if (!r.ok) { setState("error"); setMessage(r.status === 401 ? "Please sign in to confirm your payment." : r.error); return }
      if (r.data.status === "pending" && ++tries < 6) { setTimeout(check, 2500); return }
      setState(r.data.status)
    }
    void check()
    return () => { stop = true }
  }, [reference, app])

  if (app)
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Payment received</h1>
        <p className="text-sm text-muted-foreground">You can close this page and go back to the Clinexia app. Your plan switches on automatically within a moment.</p>
      </div>
    )
  return (
    <div className="space-y-4 text-center">
      {state === "checking" && <><Loader2 className="mx-auto h-6 w-6 animate-spin" aria-label="Checking" /><p>Confirming your payment…</p></>}
      {state === "paid" && <><h1 className="text-2xl font-semibold">Payment confirmed</h1><p className="text-sm text-muted-foreground">Your plan is now active.</p></>}
      {state === "pending" && <><h1 className="text-2xl font-semibold">Still waiting for confirmation</h1><p className="text-sm text-muted-foreground">If you were charged, your plan activates automatically as soon as the payment provider confirms it. You can safely close this page.</p></>}
      {state === "failed" && <><h1 className="text-2xl font-semibold">We could not confirm this payment</h1><p className="text-sm text-muted-foreground">Nothing was activated. If money left your account, contact support with reference {reference}.</p></>}
      {state === "error" && <p role="alert" className="text-sm text-destructive">{message}</p>}
      {state !== "checking" && <Button asChild><Link href="/account">Go to your account</Link></Button>}
    </div>
  )
}

export function JoinInvite({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "signin">("idle")
  const [error, setError] = useState("")
  const [orgId, setOrgId] = useState("")
  async function join() {
    setState("busy"); setError("")
    const r = await api<{ orgId: string }>("/api/billing/org", { action: "accept", token })
    if (r.ok) { setOrgId(r.data.orgId); setState("done") }
    else if (r.status === 401) setState("signin")
    else { setError(r.error); setState("idle") }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Join your organisation on Clinexia</h1>
      <p className="text-sm text-muted-foreground">Sign in (or create an account) with the email address your invitation was sent to, then accept.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {state === "signin" && <p className="text-sm">Please <Link className="underline" href="/account">sign in or create an account</Link> first, then open this link again.</p>}
      {state === "done" ? <Button asChild><Link href={`/account/organisation?org=${orgId}`}>Open the organisation</Link></Button> : <Button onClick={join} disabled={state === "busy"}>{state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept invitation"}</Button>}
    </div>
  )
}
