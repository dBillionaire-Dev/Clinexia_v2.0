import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AuthPage } from "@/components/account/auth-page"
import { billingEnabled } from "@/lib/billing/config"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } }

// Not linked from the home page and not in the sitemap. Reachable by address (and from the navbar account icon) while accounts are on.
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; registered?: string; confirmed?: string }> }) {
  if (!billingEnabled()) notFound()
  const q = await searchParams
  const notice = q.confirmed ? "confirmed" : q.registered ? "registered" : null
  return <div className="mx-auto w-full max-w-md px-4 py-12"><AuthPage mode="login" next={q.next} notice={notice} /></div>
}
