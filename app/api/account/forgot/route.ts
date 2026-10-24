import { allowSubmission } from "@/lib/feedback/rate-limit"
import { isEmail, normalizeEmail } from "@/lib/billing/invitations"
import { publicBaseUrl } from "@/lib/billing/email-flows"
import { requestPasswordReset } from "@/lib/billing/password-reset"
import { clientKey, guard, json, problem, readJson } from "@/lib/billing/route-kit"

export const dynamic = "force-dynamic"

// "Forgot password": emails a reset link and tells the person plainly whether that address is registered. Because this answer reveals
// who has an account, it is limited per connection and per address.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  if (!allowSubmission(`forgot:${clientKey(request)}`)) return problem("Too many attempts. Please try again later.", 429)
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : ""
  if (!isEmail(email)) return problem("Enter a valid email address.", 400)
  // Each request counts twice against the address: 4 emails per 15 minutes to one inbox.
  if (!allowSubmission(`forgot-to:${email}`) || !allowSubmission(`forgot-to:${email}`)) return problem("A reset link was just sent to this address. Check your email, or try again in a few minutes.", 429)
  const outcome = await requestPasswordReset(email, publicBaseUrl(new URL(request.url).origin))
  if (outcome === "sent") return json({ ok: true })
  if (outcome === "no_account") return problem("No account is registered with this email address. Check the spelling, or create an account.", 400)
  if (outcome === "suspended") return problem("This account has been suspended, so its password cannot be reset. Please contact Clinexia support.", 403)
  return problem("We could not send the email right now. Please try again in a few minutes.", 503)
}
