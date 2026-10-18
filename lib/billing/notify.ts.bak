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

export async function sendEmail(to: string, subject: string, text: string, fetchImpl: typeof fetch = fetch): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.BILLING_FROM_EMAIL
  if (!key || !from || !to) return "not_configured"
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    })
    return res.ok ? "sent" : "failed"
  } catch {
    return "failed"
  }
}
