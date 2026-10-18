"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

type Verdict = { allowed: boolean; premium?: boolean; signedIn?: boolean; specialtyLabel?: string }

/**
 * Wraps a calculator. When premium locking is switched on (BILLING_ENFORCE_PREMIUM=true) and the person's plan does not
 * cover this specialty, it shows an upgrade screen instead. With locking off, or if the check cannot be reached (offline), the
 * calculator simply works. This is a front-end lock: the calculations themselves still run in the browser.
 */
export function PremiumGate({ id, category, children }: { id?: string; category?: string; children: ReactNode }) {
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const here = encodeURIComponent(usePathname() ?? "/")

  useEffect(() => {
    let cancelled = false
    const qs = new URLSearchParams()
    if (id) qs.set("id", id)
    else if (category) qs.set("category", category)
    fetch(`/api/billing/access?${qs.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: Verdict | null) => { if (!cancelled && v) setVerdict(v) })
      .catch(() => undefined) // offline or unreachable: leave the calculator usable
    return () => { cancelled = true }
  }, [id, category])

  if (!verdict || verdict.allowed) return <>{children}</>

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-lg border p-6 text-center" role="region" aria-label="Premium feature">
      <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="text-xl font-semibold">Premium: {verdict.specialtyLabel ?? "specialty tools"}</h2>
      <p className="text-sm text-muted-foreground">
        {verdict.signedIn
          ? "Your current plan does not include this specialty. Upgrade to unlock it."
          : "Sign in to use this tool, or create an account and choose a plan that includes it."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {verdict.signedIn ? (
          <Button asChild><Link href="/account">See plans</Link></Button>
        ) : (
          <>
            <Button asChild><Link href={`/login?next=${here}`}>Sign in</Link></Button>
            <Button asChild variant="outline"><Link href={`/register?next=${here}`}>Create account</Link></Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground"><Link className="underline" href="/calculators">Browse free calculators</Link></p>
    </div>
  )
}
