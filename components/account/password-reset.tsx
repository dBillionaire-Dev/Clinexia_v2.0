"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "./password-input"
import { api } from "@/lib/billing/client"

/** "Forgot password?": asks for the email and says a link is on its way (the answer is the same whether or not an account exists). */
export function ForgotPassword({ initialEmail = "", onBack }: { initialEmail?: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError("")
    const r = await api("/api/account/forgot", { email })
    setBusy(false)
    if (r.ok) setSent(true); else setError(r.error)
  }
  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p role="status" className="text-sm">We have sent a link to choose a new password to <strong>{email.trim().toLowerCase()}</strong>. It can take a few minutes; check your spam folder too.</p>
        <button type="button" className="text-sm underline" onClick={onBack}>Back to sign in</button>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-semibold">Forgot your password?</h1>
      <p className="text-sm text-muted-foreground">Enter your email and we will send you a link to choose a new one.</p>
      <label className="block text-sm"><span className="mb-1 block font-medium">Email</span><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}</Button>
        <button type="button" className="text-sm underline" onClick={onBack}>Back to sign in</button>
      </div>
    </form>
  )
}

/** The page the emailed link opens: choose a new password, then go and sign in. */
export function ResetPassword({ token }: { token: string }) {
  const [password, setPassword] = useState("")
  const [again, setAgain] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== again) return setError("The two passwords do not match.")
    setBusy(true); setError("")
    const r = await api("/api/account/reset", { token, password })
    setBusy(false)
    if (r.ok) setDone(true); else setError(r.error)
  }
  if (done) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Password changed</h1>
        <p role="status" className="text-sm">Your password has been changed and you have been signed out everywhere. Sign in with the new password.</p>
        <Link className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href="/login">Sign in</Link>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <label className="block text-sm"><span className="mb-1 block font-medium">New password</span><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} required /><span className="mt-1 block text-xs text-muted-foreground">At least 10 characters.</span></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">Repeat the new password</span><PasswordInput value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" minLength={10} required /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}</Button>
        <Link className="text-sm underline" href="/login">Back to sign in</Link>
      </div>
    </form>
  )
}
