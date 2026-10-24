"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "./password-input"
import { ForgotPassword } from "./password-reset"
import { getAnonymousId } from "@/lib/analytics/client-id"
import { api } from "@/lib/billing/client"
import { BACKGROUND, rolesFor } from "@/lib/feedback/questions"

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm"

export function AuthForm({ onDone, initialMode = "signup", onNeedsConfirmation }: { onDone: () => void; initialMode?: "signup" | "login"; onNeedsConfirmation?: (email: string) => void }) {
  const [type, setType] = useState<"individual" | "enterprise" | null>(null)
  const [mode, setMode] = useState<"signup" | "login">(initialMode)
  const [f, setF] = useState({ email: "", password: "", fullName: "", background: "", role: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [forgot, setForgot] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF((cur) => ({ ...cur, [k]: v, ...(k === "background" ? { role: "" } : {}) }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(""); setNotice("")
    const r = mode === "login" ? await api("/api/account/login", { email: f.email, password: f.password, anonymousId: getAnonymousId() }) : await api<{ signedIn: boolean }>("/api/account/signup", { ...f, accountType: type, anonymousId: getAnonymousId() })
    setBusy(false)
    if (!r.ok) return setError(r.error)
    if (mode === "signup" && !(r.data as { signedIn: boolean }).signedIn) {
      if (onNeedsConfirmation) return onNeedsConfirmation(f.email.trim().toLowerCase())
      return setNotice("Check your email to confirm your address, then sign in.")
    }
    onDone()
  }

  if (forgot) return <ForgotPassword initialEmail={f.email} onBack={() => setForgot(false)} />

  if (!type && mode === "signup") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Create your Clinexia account</h1>
        <p className="text-sm text-muted-foreground">Free features stay free. You only pay if you choose a premium plan.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["individual", "Individual", "For you: your own email, role and plan."], ["enterprise", "Organisation", "For a lab, pharmacy, hospital, clinic or school with staff seats."]] as const).map(([v, t, d]) => (
            <button key={v} type="button" onClick={() => setType(v)} className="rounded-lg border p-4 text-left hover:bg-muted">
              <span className="block font-medium">{t}</span><span className="block text-sm text-muted-foreground">{d}</span>
            </button>
          ))}
        </div>
        <button type="button" className="text-sm underline" onClick={() => setMode("login")}>I already have an account</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Sign in" : type === "enterprise" ? "Create the organisation administrator account" : "Create your account"}</h1>
      {mode === "signup" && <label className="block text-sm"><span className="mb-1 block font-medium">Full name</span><Input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" required /></label>}
      <label className="block text-sm"><span className="mb-1 block font-medium">Email</span><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" required /></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">Password</span><PasswordInput value={f.password} onChange={(e) => set("password", e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 10} required />
        {mode === "signup" && <span className="mt-1 block text-xs text-muted-foreground">At least 10 characters.</span>}</label>
      {mode === "signup" && type === "individual" && (
        <>
          <label className="block text-sm"><span className="mb-1 block font-medium">Do you work in healthcare?</span>
            <select className={field} value={f.background} onChange={(e) => set("background", e.target.value)} required><option value="">Choose…</option>{BACKGROUND.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></label>
          {f.background && <label className="block text-sm"><span className="mb-1 block font-medium">What describes you best?</span>
            <select className={field} value={f.role} onChange={(e) => set("role", e.target.value)} required><option value="">Choose…</option>{rolesFor(f.background).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
            <span className="mt-1 block text-xs text-muted-foreground">This is for your profile only. It never changes what you can access.</span></label>}
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Sign in" : "Create account"}</Button>
        <button type="button" className="text-sm underline" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError("") }}>{mode === "login" ? "Create an account" : "I already have an account"}</button>
        {mode === "login" && <button type="button" className="text-sm underline" onClick={() => { setForgot(true); setError("") }}>Forgot password?</button>}
        {mode === "signup" && <button type="button" className="text-sm underline" onClick={() => setType(null)}>Back</button>}
      </div>
    </form>
  )
}
