import { applyVerifiedPayment } from "@/lib/billing/payments"
import { guard, isResponse, json, problem, readJson, requireUser } from "@/lib/billing/route-kit"
import { createPaystack } from "@/lib/billing/paystack"
import { getOrder, paymentStore } from "@/lib/billing/store"
import { publicBaseUrl, sendReceiptForOrder } from "@/lib/billing/email-flows"

export const dynamic = "force-dynamic"

// Called when the browser returns from checkout. The page's "success" is never trusted: this asks Paystack and applies the order
// (the same idempotent step the webhook uses, so whichever arrives first wins and the other is a no-op).
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return problem("Payments are not set up yet.", 503)

  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  const reference = typeof body?.reference === "string" ? body.reference.slice(0, 100) : ""
  const order = reference ? await getOrder(reference) : null
  if (!order || order.payer_user_id !== user.id) return problem("Payment not found.", 404)
  if (order.status === "paid") return json({ status: "paid" })

  try {
    const r = await applyVerifiedPayment(reference, createPaystack(secret), { ...paymentStore, onPaid: async (ref) => { await sendReceiptForOrder(ref, publicBaseUrl(new URL(request.url).origin)) } })
    if (r.ok) return json({ status: "paid" })
    return json({ status: r.reason === "not_successful" ? "pending" : "failed" })
  } catch {
    return problem("Could not confirm the payment yet. Please try again in a moment.", 502)
  }
}
