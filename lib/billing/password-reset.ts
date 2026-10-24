// Forgot password. Clinexia sends the reset email itself (through Resend) instead of Supabase, so it looks like the rest of its mail and
// works the same on the website and in the Android app (the link opens the website page where the new password is chosen).
//   request: Supabase makes a one-time token (no email) -> the reset email carries /account/reset?token=...
//   finish : the page sends the token and the new password -> Supabase checks the token once and sets the password.
// Opening the link does nothing by itself, so email-scanning software that "clicks" links cannot use up the token.
import { generateRecoveryToken } from "./admin-users"
import { db, uuid } from "./db"
import { composePasswordChangedEmail, composePasswordResetEmail } from "./emails"
import { sendEmailMessage } from "./notify"
import { getUserStatus } from "./store"

export const validResetToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{20,200}$/.test(t)
export const validNewPassword = (p: unknown): p is string => typeof p === "string" && p.length >= 10 && p.length <= 128

export interface ResetDeps {
  generate: (email: string) => Promise<{ userId: string; tokenHash: string } | null>
  isSuspended: (userId: string) => Promise<boolean>
  nameOf: (userId: string) => Promise<string>
  send: typeof sendEmailMessage
}
const defaults: ResetDeps = {
  generate: generateRecoveryToken,
  isSuspended: async (id) => (await getUserStatus(id)).status === "suspended",
  nameOf: async (id) => { try { return String((await db.select("billing_profiles", `select=full_name&user_id=eq.${uuid(id)}`))[0]?.full_name ?? "") } catch { return "" } },
  send: sendEmailMessage,
}

export type ResetOutcome = "sent" | "no_account" | "suspended" | "email_failed"

/**
 * Sends the reset email when the address has an account, and says what happened (the sign-in screen tells the person whether the
 * address is registered). Never throws. `adminAction` lets an administrator reset a suspended account too.
 */
export async function requestPasswordReset(email: string, baseUrl: string, deps: ResetDeps = defaults, opts: { adminAction?: boolean } = {}): Promise<ResetOutcome> {
  try {
    const found = await deps.generate(email)
    if (!found) return "no_account"
    if (!opts.adminAction && (await deps.isSuspended(found.userId))) return "suspended"
    const link = `${baseUrl}/account/reset?token=${encodeURIComponent(found.tokenHash)}`
    const e = composePasswordResetEmail({ name: await deps.nameOf(found.userId), link })
    const r = await deps.send({ to: email, ...e })
    if (r === "not_configured") console.error("Clinexia password reset: RESEND_API_KEY / BILLING_FROM_EMAIL are not set, so no reset email was sent.")
    return r === "sent" ? "sent" : "email_failed"
  } catch (error) {
    console.error("Clinexia password reset failed:", error instanceof Error ? error.message : "unknown")
    return "email_failed"
  }
}

/** For an administrator who wants to hand the person a reset link directly (one use, expires soon). Null when the account has no such email. */
export async function createResetLink(email: string, baseUrl: string, deps: Pick<ResetDeps, "generate"> = defaults): Promise<string | null> {
  const found = await deps.generate(email)
  return found ? `${baseUrl}/account/reset?token=${encodeURIComponent(found.tokenHash)}` : null
}

export async function sendPasswordChangedNotice(email: string, baseUrl: string, deps: Pick<ResetDeps, "send"> = defaults): Promise<void> {
  if (!email) return
  await deps.send({ to: email, ...composePasswordChangedEmail({ name: "", url: `${baseUrl}/login` }) }).catch(() => undefined)
}
