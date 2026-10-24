import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ResetPassword } from "@/components/account/password-reset"
import { billingEnabled } from "@/lib/billing/config"

export const dynamic = "force-dynamic"
// The address holds a one-time token, so the page is hidden from search engines and never passes its address on as a referrer.
export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false }, referrer: "no-referrer" }

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (!billingEnabled()) notFound()
  const { token } = await searchParams
  if (!token) notFound()
  return <div className="mx-auto w-full max-w-md px-4 py-16"><ResetPassword token={token} /></div>
}
