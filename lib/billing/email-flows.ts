// Server side of the three automatic emails: looks up what the email needs, sends it through Resend, and remembers that it
// went out. Nothing here may ever break the action that triggered it (an invitation, a payment): every entry point catches
// its own errors. Without RESEND_API_KEY + BILLING_FROM_EMAIL nothing is sent and the app behaves exactly as before.
import { db, eq, uuid } from "./db"
import { getAuthUser } from "./admin-users"
import { composeInvitationEmail, composeReceiptEmail, composeReminderEmail } from "./emails"
import { sendEmailBatch, sendEmailMessage, type EmailResult } from "./notify"
import { hashInviteToken } from "./invitations"
import { processReminders, reminderDaysFromEnv, type ReminderSub, type ReminderSummary } from "./reminders"
import { getOrgOwner, getPricing, getUserStatus } from "./store"

/** Links in emails use the public site address when one is configured, otherwise the address the request came in on. */
export function publicBaseUrl(fallbackOrigin: string): string {
  const pick = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || fallbackOrigin
  return pick.trim().replace(/\/+$/, "")
}

async function nameOf(userId: string): Promise<string> {
  try {
    const [p] = await db.select("billing_profiles", `select=full_name&user_id=eq.${uuid(userId)}`)
    return String(p?.full_name ?? "")
  } catch { return "" }
}

// ---- 1. invitations ---------------------------------------------------------------------------------------------------
export async function emailInvitations(input: {
  orgId: string; orgName: string; inviterId: string; inviterEmail: string; role: "admin" | "staff"; expiresAt: string; baseUrl: string
  created: Array<{ email: string; token: string }>
}): Promise<Record<string, boolean>> {
  const emailed: Record<string, boolean> = {}
  try {
    const inviterName = (await nameOf(input.inviterId)) || input.inviterEmail
    const messages = input.created.map((c) => {
      const link = `${input.baseUrl}/account/join?token=${encodeURIComponent(c.token)}`
      const e = composeInvitationEmail({ orgName: input.orgName, inviterName, role: input.role, link, expiresAt: input.expiresAt, inviteeEmail: c.email })
      return { to: c.email, ...e }
    })
    const results = await sendEmailBatch(messages)
    const stamp = new Date().toISOString()
    for (let i = 0; i < input.created.length; i++) {
      const c = input.created[i]
      emailed[c.email] = results[i] === "sent"
      if (results[i] === "sent") await db.update("billing_invitations", `token_hash=${eq(hashInviteToken(c.token))}`, { emailed_at: stamp }).catch(() => undefined)
    }
  } catch (error) {
    console.error("Clinexia invitation email failed:", error instanceof Error ? error.message : "unknown")
  }
  for (const c of input.created) emailed[c.email] ??= false
  return emailed
}

// ---- 2. receipts ------------------------------------------------------------------------------------------------------
/**
 * Emails the receipt for a paid order, once. The webhook and the return-from-checkout call can both arrive; whichever
 * claims receipt_sent_at first sends it. A send that failed is un-claimed so a later retry (or the daily job) sends it.
 */
export async function sendReceiptForOrder(reference: string, baseUrl: string): Promise<EmailResult | "skipped"> {
  try {
    const claimed = await db.update("billing_orders", `reference=${eq(reference)}&status=eq.paid&receipt_sent_at=is.null`, { receipt_sent_at: new Date().toISOString() })
    const order = claimed[0]
    if (!order) return "skipped"
    const [auth, sub, org, name] = await Promise.all([
      getAuthUser(order.payer_user_id),
      db.select("billing_subscriptions", `select=current_period_end&id=eq.${uuid(order.subscription_id)}`).then((r) => r[0]),
      order.org_id ? db.select("billing_organisations", `select=name&id=eq.${uuid(order.org_id)}`).then((r) => r[0]) : Promise.resolve(undefined),
      nameOf(order.payer_user_id),
    ])
    if (!auth?.email) return "skipped"
    const target = (order.target ?? {}) as { plan?: string; specialties?: string[]; seats?: number }
    const e = composeReceiptEmail({
      name, reference: order.reference, amountMinor: Number(order.amount_kobo), currency: order.currency === "USD" ? "USD" : "NGN", paidAt: order.paid_at ?? new Date().toISOString(),
      plan: target.plan ?? "specialty", specialties: target.specialties ?? [], seats: target.seats ?? 1, orgName: org?.name, periodEnd: sub?.current_period_end ?? null,
      url: order.org_id ? `${baseUrl}/account/organisation?org=${order.org_id}` : `${baseUrl}/account`,
    })
    const result = await sendEmailMessage({ to: auth.email, ...e, idempotencyKey: `receipt:${order.reference}` })
    if (result === "failed") await db.update("billing_orders", `reference=${eq(reference)}`, { receipt_sent_at: null }).catch(() => undefined)
    return result
  } catch (error) {
    console.error("Clinexia receipt email failed:", error instanceof Error ? error.message : "unknown")
    return "failed"
  }
}

/** Receipts that failed in the last two days (receipt_sent_at was cleared). Run by the daily job. */
export async function retryPendingReceipts(baseUrl: string): Promise<number> {
  try {
    const since = encodeURIComponent(new Date(Date.now() - 2 * 86_400_000).toISOString())
    const rows = await db.select("billing_orders", `select=reference&status=eq.paid&receipt_sent_at=is.null&paid_at=gt.${since}&limit=50`)
    let sent = 0
    for (const r of rows) if ((await sendReceiptForOrder(String(r.reference), baseUrl)) === "sent") sent++
    return sent
  } catch { return 0 }
}

// ---- 3. plan ending soon ----------------------------------------------------------------------------------------------
export async function runPlanReminders(baseUrl: string, now = Date.now()): Promise<ReminderSummary & { days: number }> {
  const days = reminderDaysFromEnv(process.env.PLAN_REMINDER_DAYS)
  const upper = encodeURIComponent(new Date(now + days * 86_400_000).toISOString())
  const lower = encodeURIComponent(new Date(now).toISOString())
  const rows = await db.select(
    "billing_subscriptions",
    `select=id,user_id,org_id,plan,specialties,seats,status,current_period_end,reminder_sent_for&status=in.(active,past_due,cancelled)&current_period_end=gt.${lower}&current_period_end=lte.${upper}&order=current_period_end.asc&limit=500`,
  )
  const subs: ReminderSub[] = rows.map((r) => ({
    id: r.id, userId: r.user_id ?? null, orgId: r.org_id ?? null, plan: r.plan, specialties: r.specialties ?? [], seats: r.seats ?? 1, status: r.status,
    currentPeriodEnd: r.current_period_end, reminderSentFor: r.reminder_sent_for ?? null,
  }))
  const graceDays = (await getPricing()).graceDays
  const summary = await processReminders({
    subs, now, days,
    prepare: async (sub) => {
      let userId = sub.userId
      let orgName: string | undefined
      if (sub.orgId) {
        const org = await getOrgOwner(sub.orgId)
        if (!org) return null
        const [o] = await db.select("billing_organisations", `select=suspended&id=eq.${uuid(sub.orgId)}`)
        if (o?.suspended === true) return null
        userId = org.ownerId
        orgName = org.name
      }
      if (!userId) return null
      if ((await getUserStatus(userId)).status === "suspended") return null
      const auth = await getAuthUser(userId)
      if (!auth?.email) return null
      const e = composeReminderEmail({
        name: await nameOf(userId), plan: sub.plan, specialties: sub.specialties, seats: sub.seats, orgName, periodEnd: sub.currentPeriodEnd,
        cancelled: sub.status === "cancelled", graceDays, now, url: sub.orgId ? `${baseUrl}/account/organisation?org=${sub.orgId}` : `${baseUrl}/account`,
      })
      return { to: auth.email, ...e }
    },
    send: (messages) => sendEmailBatch(messages),
    mark: async (sub) => { await db.update("billing_subscriptions", `id=eq.${uuid(sub.id)}`, { reminder_sent_for: sub.currentPeriodEnd }) },
  })
  return { ...summary, days }
}
