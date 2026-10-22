// Notices to people when an administrator acts on their account. composeNotice is pure (tested). Email goes out only if a
// provider is configured (RESEND_API_KEY + BILLING_FROM_EMAIL); otherwise the notice is kept in-app and the admin is told.
export type NoticeKind = "user_suspended" | "user_restored" | "user_deleted" | "org_suspended" | "org_restored" | "org_deleted" | "plan_changed"

const SUBJECT: Record<NoticeKind, string> = {
  user_suspended: "Your Clinexia account has been suspended",
  user_restored: "Your Clinexia account has been restored",
  user_deleted: "Your Clinexia account has been deleted",
  org_suspended: "Your organisation's Clinexia access has been suspended",
  org_restored: "Your organisation's Clinexia access has been restored",
  org_deleted: "Your organisation has been removed from Clinexia",
  plan_changed: "Your Clinexia plan has been updated",
}

const LEAD: Record<NoticeKind, string> = {
  user_suspended: "We have suspended your Clinexia account. You cannot sign in until it is restored.",
  user_restored: "Your Clinexia account is active again. You can sign in as usual.",
  user_deleted: "We have deleted your Clinexia account and its data.",
  org_suspended: "We have suspended Clinexia access for {name}. Members cannot use premium features until it is restored.",
  org_restored: "Clinexia access for {name} is active again.",
  org_deleted: "We have removed {name} from Clinexia, including its members and subscription.",
  plan_changed: "Your Clinexia plan is now: {name}.",
}

export function composeNotice(kind: NoticeKind, input: { reason?: string; name?: string } = {}): { subject: string; text: string } {
  const lines = [LEAD[kind].replace("{name}", input.name?.trim() || "your organisation")]
  const reason = input.reason?.trim()
  if (reason && kind !== "user_restored" && kind !== "org_restored" && kind !== "plan_changed") lines.push("", `Reason: ${reason}`)
  if (kind === "user_suspended" || kind === "org_suspended" || kind === "user_deleted" || kind === "org_deleted") {
    lines.push("", "If you think this is a mistake, reply to this email or contact Clinexia support and we will review it.")
  }
  lines.push("", "The Clinexia team")
  return { subject: SUBJECT[kind], text: lines.join("\n") }
}

export type EmailResult = "sent" | "not_configured" | "failed"

export interface EmailMessage {
  to: string
  subject: string
  text: string
  /** Optional HTML version. Always send `text` as well: it is what spam filters and plain-text readers use. */
  html?: string
  replyTo?: string
  /** Resend ignores a repeat of the same key for 24 hours, so a retried request cannot send the same email twice. */
  idempotencyKey?: string
}

const RESEND_URL = "https://api.resend.com"
const TIMEOUT_MS = 10_000

/** True when both Resend settings are present. Never returns a value, only whether it is set. */
export const emailConfigured = (env: Record<string, string | undefined> = process.env) => Boolean(env.RESEND_API_KEY?.trim() && env.BILLING_FROM_EMAIL?.trim())

function body(m: EmailMessage, from: string) {
  const replyTo = m.replyTo ?? process.env.BILLING_REPLY_TO_EMAIL?.trim()
  return { from, to: [m.to], subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}), ...(replyTo ? { reply_to: replyTo } : {}) }
}

async function explain(res: Response, what: string) {
  // Resend's error text says things like "The domain is not verified"; it never contains the API key.
  console.error(`Clinexia email (${what}) failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`)
}

export async function sendEmailMessage(m: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.BILLING_FROM_EMAIL
  if (!key || !from || !m.to) return "not_configured"
  try {
    const res = await fetchImpl(`${RESEND_URL}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(m.idempotencyKey ? { "Idempotency-Key": m.idempotencyKey.slice(0, 256) } : {}) },
      body: JSON.stringify(body(m, from)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) await explain(res, "send")
    return res.ok ? "sent" : "failed"
  } catch {
    return "failed"
  }
}

export async function sendEmail(to: string, subject: string, text: string, fetchImpl: typeof fetch = fetch): Promise<EmailResult> {
  return sendEmailMessage({ to, subject, text }, fetchImpl)
}

/**
 * Many emails in few requests (Resend's batch endpoint takes up to 100). One request per person would hit Resend's
 * requests-per-second limit on a bulk invitation or the daily reminder run. Results are in the same order as `messages`.
 * A batch is accepted or refused as a whole, so every message in a refused batch is reported "failed".
 */
export async function sendEmailBatch(messages: EmailMessage[], fetchImpl: typeof fetch = fetch): Promise<EmailResult[]> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.BILLING_FROM_EMAIL
  if (!key || !from) return messages.map(() => "not_configured" as const)
  const out: EmailResult[] = []
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100)
    try {
      const res = await fetchImpl(`${RESEND_URL}/emails/batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((m) => body(m, from))),
        signal: AbortSignal.timeout(TIMEOUT_MS * 2),
      })
      if (!res.ok) await explain(res, "batch")
      out.push(...chunk.map(() => (res.ok ? ("sent" as const) : ("failed" as const))))
    } catch {
      out.push(...chunk.map(() => "failed" as const))
    }
  }
  return out
}
