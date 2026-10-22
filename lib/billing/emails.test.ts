import { afterEach, describe, expect, it, vi } from "vitest"
import { composeInvitationEmail, composeReceiptEmail, composeReminderEmail, escapeHtml, formatDate } from "./emails"
import { sendEmailBatch, sendEmailMessage } from "./notify"
import { planReminderDue, processReminders, reminderDaysFromEnv, type ReminderSub } from "./reminders"
import { applyVerifiedPayment, type PaymentStore } from "./payments"

const DAY = 86_400_000
const NOW = Date.parse("2026-11-01T07:00:00Z")

afterEach(() => { vi.unstubAllEnvs() })
const configure = () => { vi.stubEnv("RESEND_API_KEY", "re_test"); vi.stubEnv("BILLING_FROM_EMAIL", "Clinexia <billing@example.com>") }

describe("email templates", () => {
  it("invitation: link, org, inviter, expiry; user text is escaped in HTML", () => {
    const e = composeInvitationEmail({ orgName: "<b>City</b> Lab", inviterName: "Ada", role: "staff", link: "https://x.test/account/join?token=abc", expiresAt: "2026-11-08T00:00:00Z", inviteeEmail: "a@b.com" })
    expect(e.subject).toBe("Ada invited you to join <b>City</b> Lab on Clinexia")
    expect(e.text).toContain("https://x.test/account/join?token=abc")
    expect(e.text).toContain("8 November 2026")
    expect(e.html).toContain("&lt;b&gt;City&lt;/b&gt; Lab")
    expect(e.html).not.toContain("<b>City</b>")
  })
  it("receipt: amount, reference, active-until, organisation", () => {
    const e = composeReceiptEmail({ name: "Ada", reference: "REF1", amountMinor: 250_000, currency: "NGN", paidAt: "2026-11-01T10:00:00Z", plan: "specialty", specialties: ["pharmacy"], seats: 1, periodEnd: "2026-12-01T10:00:00Z", url: "https://x.test/account" })
    expect(e.subject).toContain("₦2,500")
    expect(e.text).toContain("Reference: REF1")
    expect(e.text).toContain("Active until: 1 December 2026")
    expect(e.text).toContain("Pharmacy")
    const o = composeReceiptEmail({ name: "", reference: "R2", amountMinor: 650, currency: "USD", paidAt: "2026-11-01T10:00:00Z", plan: "all_access", specialties: [], seats: 5, orgName: "City Lab", periodEnd: null, url: "https://x.test" })
    expect(o.text).toContain("Organisation: City Lab")
    expect(o.subject).toContain("$6.50")
  })
  it("reminder: renew wording vs already-cancelled wording", () => {
    const base = { name: "Ada", plan: "all_access", specialties: [], seats: 1, periodEnd: new Date(NOW + 3 * DAY).toISOString(), graceDays: 7, now: NOW, url: "https://x.test/account" }
    const a = composeReminderEmail({ ...base, cancelled: false })
    expect(a.subject).toBe("Your Clinexia plan ends in 3 days")
    expect(a.text).toContain("grace period of 7 days")
    const c = composeReminderEmail({ ...base, cancelled: true })
    expect(c.text).toContain("will not continue")
    expect(c.text).not.toContain("grace")
  })
  it("escapes and formats", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;")
    expect(formatDate("2026-01-31T23:59:00Z")).toBe("31 January 2026")
  })
})

describe("sending through Resend", () => {
  it("does nothing without settings", async () => {
    const f = vi.fn()
    expect(await sendEmailMessage({ to: "a@b.com", subject: "s", text: "t" }, f as any)).toBe("not_configured")
    expect(await sendEmailBatch([{ to: "a@b.com", subject: "s", text: "t" }], f as any)).toEqual(["not_configured"])
    expect(f).not.toHaveBeenCalled()
  })
  it("sends html, reply-to and the idempotency key", async () => {
    configure(); vi.stubEnv("BILLING_REPLY_TO_EMAIL", "help@example.com")
    const f = vi.fn(async () => new Response("{}", { status: 200 }))
    expect(await sendEmailMessage({ to: "a@b.com", subject: "s", text: "t", html: "<p>t</p>", idempotencyKey: "receipt:R" }, f as any)).toBe("sent")
    const [url, init] = f.mock.calls[0] as any
    expect(url).toBe("https://api.resend.com/emails")
    expect(init.headers["Idempotency-Key"]).toBe("receipt:R")
    expect(JSON.parse(init.body)).toMatchObject({ from: "Clinexia <billing@example.com>", to: ["a@b.com"], html: "<p>t</p>", reply_to: "help@example.com" })
  })
  it("a refusal or network error is 'failed', never thrown", async () => {
    configure(); vi.spyOn(console, "error").mockImplementation(() => undefined)
    expect(await sendEmailMessage({ to: "a@b.com", subject: "s", text: "t" }, (async () => new Response("{}", { status: 422 })) as any)).toBe("failed")
    expect(await sendEmailMessage({ to: "a@b.com", subject: "s", text: "t" }, (async () => { throw new Error("down") }) as any)).toBe("failed")
  })
  it("batch: 250 messages go out as 3 requests, in order", async () => {
    configure()
    const f = vi.fn(async () => new Response("{}", { status: 200 }))
    const r = await sendEmailBatch(Array.from({ length: 250 }, (_, i) => ({ to: `u${i}@b.com`, subject: "s", text: "t" })), f as any)
    expect(f).toHaveBeenCalledTimes(3)
    expect(r).toHaveLength(250)
    expect(r.every((x) => x === "sent")).toBe(true)
    expect((f.mock.calls[0] as any)[0]).toBe("https://api.resend.com/emails/batch")
  })
})

const sub = (over: Partial<ReminderSub> = {}): ReminderSub => ({ id: "s1", userId: "u1", orgId: null, plan: "all_access", specialties: [], seats: 1, status: "active", currentPeriodEnd: new Date(NOW + 2 * DAY).toISOString(), reminderSentFor: null, ...over })

describe("plan-ending reminders", () => {
  it("is due only inside the window, once per period end, for live plans", () => {
    expect(planReminderDue(sub(), NOW, 3)).toBe(true)
    expect(planReminderDue(sub({ currentPeriodEnd: new Date(NOW + 5 * DAY).toISOString() }), NOW, 3)).toBe(false)
    expect(planReminderDue(sub({ currentPeriodEnd: new Date(NOW - DAY).toISOString() }), NOW, 3)).toBe(false)
    expect(planReminderDue(sub({ reminderSentFor: new Date(NOW + 2 * DAY).toISOString() }), NOW, 3)).toBe(false)
    expect(planReminderDue(sub({ reminderSentFor: new Date(NOW - 20 * DAY).toISOString() }), NOW, 3)).toBe(true) // renewed since: a new period
    expect(planReminderDue(sub({ status: "pending" }), NOW, 3)).toBe(false)
    expect(planReminderDue(sub({ status: "expired" }), NOW, 3)).toBe(false)
    expect(planReminderDue(sub({ status: "cancelled" }), NOW, 3)).toBe(true)
  })
  it("PLAN_REMINDER_DAYS: whole days 1 to 30, else 3", () => {
    expect([reminderDaysFromEnv(undefined), reminderDaysFromEnv("7"), reminderDaysFromEnv("0"), reminderDaysFromEnv("99"), reminderDaysFromEnv("x")]).toEqual([3, 7, 3, 3, 3])
  })
  it("sends, marks only what was sent, skips people with no address, and leaves everything unmarked when email is off", async () => {
    const marked: string[] = []
    const run = (results: any) => processReminders<string>({
      subs: [sub({ id: "a" }), sub({ id: "b" }), sub({ id: "c" }), sub({ id: "far", currentPeriodEnd: new Date(NOW + 20 * DAY).toISOString() })], now: NOW, days: 3,
      prepare: async (s) => (s.id === "b" ? null : s.id), send: async () => results, mark: async (s) => { marked.push(s.id) },
    })
    expect(await run(["sent", "failed"])).toMatchObject({ checked: 4, due: 3, sent: 1, failed: 1, skipped: 1, configured: true })
    expect(marked).toEqual(["a"])
    marked.length = 0
    expect((await run(["not_configured", "not_configured"])).configured).toBe(false)
    expect(marked).toEqual([])
  })
})

describe("receipt hook on payment", () => {
  const provider = { initialize: async () => ({ authorizationUrl: "" }), verify: async () => ({ status: "success", amountMinor: 1, currency: "NGN", providerId: "p", reference: "R" }) }
  const store = (onPaid: any): PaymentStore => ({ claimEvent: async () => true, releaseEvent: async () => undefined, applyPaidOrder: async () => ({ ok: true, already: false, ownerKind: "user", ownerId: "u" }), audit: async () => undefined, onPaid })
  it("is called after a confirmed payment, and its failure never fails the payment", async () => {
    const onPaid = vi.fn(async () => { throw new Error("email down") })
    const r = await applyVerifiedPayment("R", provider as any, store(onPaid))
    expect(r).toMatchObject({ ok: true })
    expect(onPaid).toHaveBeenCalledWith("R")
  })
  it("is not called for an unsuccessful payment", async () => {
    const onPaid = vi.fn()
    await applyVerifiedPayment("R", { ...provider, verify: async () => ({ status: "failed", amountMinor: 1, currency: "NGN", providerId: "p", reference: "R" }) } as any, store(onPaid))
    expect(onPaid).not.toHaveBeenCalled()
  })
})
