// Turning a provider-confirmed payment into paid access. Browser "success" redirects are never trusted: both the webhook and
// the return-from-checkout route call applyVerifiedPayment, which asks the provider and then applies the order once.
import type { PaymentProvider } from "./paystack"
import { verifyWebhookSignature } from "./paystack"

export type ApplyResult =
  | { ok: true; already: boolean; ownerKind: "user" | "org"; ownerId: string }
  | { ok: false; reason: "unknown_reference" | "amount_mismatch" | "currency_mismatch" }

export interface PaymentStore {
  /** True the first time an event key is seen, false for a duplicate delivery. */
  claimEvent(key: string, type: string): Promise<boolean>
  releaseEvent(key: string): Promise<void>
  /** Atomic and idempotent: marks the order paid and activates the subscription in one transaction (billing_apply_paid_order). */
  applyPaidOrder(input: { reference: string; amountMinor: number; currency: string; providerId: string }): Promise<ApplyResult>
  audit(event: { action: string; detail: Record<string, unknown> }): Promise<void>
  /** Optional: called after an order is confirmed paid (also on a repeat delivery, so a receipt that failed can be retried). Must be idempotent. */
  onPaid?(reference: string): Promise<void>
}

export async function applyVerifiedPayment(reference: string, provider: PaymentProvider, store: PaymentStore): Promise<ApplyResult | { ok: false; reason: "not_successful" }> {
  const tx = await provider.verify(reference)
  if (tx.status !== "success") return { ok: false, reason: "not_successful" }
  const result = await store.applyPaidOrder({ reference: tx.reference, amountMinor: tx.amountMinor, currency: tx.currency, providerId: tx.providerId })
  if (!result.ok) await store.audit({ action: `payment.${result.reason}`, detail: { reference: tx.reference, amountMinor: tx.amountMinor, currency: tx.currency } })
  else if (store.onPaid) await store.onPaid(tx.reference).catch(() => undefined) // an email problem must never undo or fail a payment
  return result
}

export interface WebhookOutcome { status: number; body: { received?: boolean; error?: string } }

export async function processPaystackWebhook(input: { rawBody: string; signature: string | null; secret: string; provider: PaymentProvider; store: PaymentStore }): Promise<WebhookOutcome> {
  if (!verifyWebhookSignature(input.rawBody, input.signature, input.secret)) return { status: 401, body: { error: "Invalid signature." } }

  let event: any
  try {
    event = JSON.parse(input.rawBody)
  } catch {
    return { status: 400, body: { error: "Invalid body." } }
  }
  const type = typeof event?.event === "string" ? event.event : ""
  const data = event?.data ?? {}
  const reference = typeof data.reference === "string" ? data.reference : ""
  const key = `${type}:${data.id ?? reference}`
  if (!type || key.endsWith(":")) return { status: 400, body: { error: "Invalid event." } }

  if (!(await input.store.claimEvent(key, type))) return { status: 200, body: { received: true } } // duplicate delivery

  try {
    if (type === "charge.success" && reference) await applyVerifiedPayment(reference, input.provider, input.store)
    return { status: 200, body: { received: true } }
  } catch (error) {
    // Transient failure (provider or database down): forget the claim so Paystack's retry is processed, and answer 5xx.
    await input.store.releaseEvent(key).catch(() => undefined)
    console.error("Clinexia billing webhook error:", error instanceof Error ? error.message : "unknown")
    return { status: 500, body: { error: "Temporary failure." } }
  }
}
