import { NextResponse } from "next/server"
import { billingEnabled } from "@/lib/billing/config"
import { processPaystackWebhook } from "@/lib/billing/payments"
import { createPaystack } from "@/lib/billing/paystack"
import { paymentStore } from "@/lib/billing/store"
import { publicBaseUrl, sendReceiptForOrder } from "@/lib/billing/email-flows"

export const dynamic = "force-dynamic"

// Paystack calls this. Authentication is the HMAC signature over the raw body; nothing in the payload is trusted until the
// transaction is re-verified with Paystack and matched to a stored order.
export async function POST(request: Request) {
  if (!billingEnabled()) return new NextResponse(null, { status: 404 })
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return NextResponse.json({ error: "Not configured." }, { status: 503 })
  if (Number(request.headers.get("content-length") ?? 0) > 100_000) return NextResponse.json({ error: "Too large." }, { status: 413 })

  const rawBody = await request.text()
  const outcome = await processPaystackWebhook({ rawBody, signature: request.headers.get("x-paystack-signature"), secret, provider: createPaystack(secret), store: { ...paymentStore, onPaid: async (ref) => { await sendReceiptForOrder(ref, publicBaseUrl(new URL(request.url).origin)) } } })
  return NextResponse.json(outcome.body, { status: outcome.status })
}
