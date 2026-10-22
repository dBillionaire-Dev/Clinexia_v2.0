// "Your plan is ending" reminders. The decision (who is due) and the run (compose, send, remember) are separated from the
// database so both are tested with fakes. A reminder is remembered by storing the period end it was sent for
// (billing_subscriptions.reminder_sent_for): renewing moves the end date, so the next period gets its own reminder.
import type { EmailResult } from "./notify"

const DAY = 86_400_000
export const DEFAULT_REMINDER_DAYS = 3

/** PLAN_REMINDER_DAYS: how many days before the end the email goes out. Whole days, 1 to 30, default 3. */
export function reminderDaysFromEnv(v: string | undefined): number {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : DEFAULT_REMINDER_DAYS
}

export interface ReminderSub {
  id: string
  userId: string | null
  orgId: string | null
  plan: string
  specialties: string[]
  seats: number
  status: string
  currentPeriodEnd: string
  reminderSentFor: string | null
}

export function planReminderDue(sub: Pick<ReminderSub, "status" | "currentPeriodEnd" | "reminderSentFor">, now: number, days: number): boolean {
  if (sub.status !== "active" && sub.status !== "past_due" && sub.status !== "cancelled") return false
  const end = Date.parse(sub.currentPeriodEnd)
  if (!Number.isFinite(end) || end <= now || end > now + days * DAY) return false
  return !(sub.reminderSentFor && Date.parse(sub.reminderSentFor) === end)
}

export interface ReminderSummary { checked: number; due: number; sent: number; failed: number; skipped: number; configured: boolean }

export async function processReminders<M>(input: {
  subs: ReminderSub[]
  now: number
  days: number
  /** The recipient's ready-to-send email, or null when there is nobody to send to (deleted owner, suspended, no address). */
  prepare: (sub: ReminderSub) => Promise<M | null>
  send: (messages: M[]) => Promise<EmailResult[]>
  mark: (sub: ReminderSub) => Promise<void>
}): Promise<ReminderSummary> {
  const due = input.subs.filter((s) => planReminderDue(s, input.now, input.days))
  const summary: ReminderSummary = { checked: input.subs.length, due: due.length, sent: 0, failed: 0, skipped: 0, configured: true }
  const ready: Array<{ sub: ReminderSub; message: M }> = []
  for (const sub of due) {
    let message: M | null = null
    try { message = await input.prepare(sub) } catch { message = null }
    if (message) ready.push({ sub, message })
    else summary.skipped++
  }
  if (ready.length === 0) return summary
  const results = await input.send(ready.map((r) => r.message))
  for (let i = 0; i < ready.length; i++) {
    const r = results[i]
    if (r === "not_configured") { summary.configured = false; continue } // nothing marked: sent once email is set up
    if (r === "sent") {
      summary.sent++
      try { await input.mark(ready[i].sub) } catch { /* it may be sent again tomorrow; better than never */ }
    } else summary.failed++
  }
  return summary
}
