import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PaymentReturn } from "@/components/account/simple-flows"
import { billingEnabled } from "@/lib/billing/config"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } }

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string; app?: string }> }) {
  if (!billingEnabled()) notFound()
  const q = await searchParams
  const reference = q.reference ?? q.trxref
  if (!reference) notFound()
  return <div className="mx-auto w-full max-w-md px-4 py-16"><PaymentReturn reference={reference} app={q.app === "1"} /></div>
}
