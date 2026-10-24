import { after } from "next/server"
import { allowSubmission } from "@/lib/feedback/rate-limit"
import { publicBaseUrl } from "@/lib/billing/email-flows"
import { sendPasswordChangedNotice, validNewPassword, validResetToken } from "@/lib/billing/password-reset"
import { clientKey, guard, json, problem, readJson } from "@/lib/billing/route-kit"
import { completePasswordReset } from "@/lib/billing/session"

export const dynamic = "force-dynamic"

// Finishes a password reset: the one-time token from the email plus the new password. The token is used up even when the password is
// refused later, so the password is checked first.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  if (!allowSubmission(`reset:${clientKey(request)}`)) return problem("Too many attempts. Please try again later.", 429)
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  if (!validResetToken(body?.token)) return problem("This reset link is not valid. Request a new one.", 400)
  if (!validNewPassword(body?.password)) return problem("Use a password of 10 to 128 characters.", 400)
  let result
  try {
    result = await completePasswordReset(body.token, body.password)
  } catch {
    return problem("Could not reset the password right now. Please try again.", 503)
  }
  if (!result.ok) {
    if (result.reason === "invalid") return problem("This reset link has expired or was already used. Request a new one from the sign-in page.", 400)
    if (result.reason === "same") return problem("Your new password must be different from your current one. Request a new reset link and try again.", 400)
    if (result.reason === "weak") return problem("That password is too easy to guess. Request a new reset link and choose a stronger one.", 400)
    return problem("Could not reset the password right now. Please try again.", 503)
  }
  const base = publicBaseUrl(new URL(request.url).origin)
  after(async () => { await sendPasswordChangedNotice(result.email, base) })
  return json({ ok: true })
}
