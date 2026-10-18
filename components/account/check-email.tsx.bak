"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/billing/client"

const SECONDS = 10

/** Shown right after sign-up when the email must be confirmed. After a few seconds it sends people to sign in. */
export function CheckEmail({ email, next }: { email: string; next?: string | null }) {
  const [left, setLeft] = useState(SECONDS)
  const [msg, setMsg] = useState("")
  const loginHref = `/login?registered=1${next ? `&next=${encodeURIComponent(next)}` : ""}`

  useEffect(() => {
    if (left <= 0) { window.location.href = loginHref; return }
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left, loginHref])

  async function resend() {
    setMsg("")
    const r = await api("/api/account/resend", { email })
    setMsg(r.ok ? "Sent again. It can take a minute to arrive." : r.error)
  }

  return (
    <div className="space-y-4 text-center" role="status">
      <MailCheck className="mx-auto h-10 w-10 text-primary" aria-hidden />
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="text-sm text-muted-foreground">We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Open it to confirm your account, then come back and sign in.</p>
      <p className="text-sm">Taking you to sign in in {left}s…</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild><Link href={loginHref}>Go to sign in now</Link></Button>
        <Button variant="outline" onClick={resend}>Resend email</Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      <p className="text-xs text-muted-foreground">Nothing there? Check your spam folder.</p>
    </div>
  )
}
