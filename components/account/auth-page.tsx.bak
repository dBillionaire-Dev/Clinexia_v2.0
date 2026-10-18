"use client"

import { useState } from "react"
import { safeNextPath } from "@/lib/billing/guest"
import { AuthForm } from "./auth-form"
import { CheckEmail } from "./check-email"

/**
 * Standalone /login and /register screens.
 * - Sign-up that needs email confirmation -> "check your email", then on to sign in after a few seconds.
 * - After signing in, people go to where they were heading, otherwise the app home page (not the account page).
 */
export function AuthPage({ mode, next, notice }: { mode: "login" | "signup"; next?: string; notice?: "registered" | "confirmed" | null }) {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const target = safeNextPath(next)

  if (pendingEmail) return <CheckEmail email={pendingEmail} next={target} />
  return (
    <div className="space-y-4">
      {notice === "registered" && <p role="status" className="rounded-md border p-3 text-sm">Confirm your email using the link we sent, then sign in below.</p>}
      {notice === "confirmed" && <p role="status" className="rounded-md border border-green-600/40 p-3 text-sm">Your email is confirmed. Sign in to continue.</p>}
      <AuthForm initialMode={mode} onDone={() => { window.location.href = target ?? "/" }} onNeedsConfirmation={setPendingEmail} />
    </div>
  )
}
