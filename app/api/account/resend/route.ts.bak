import { allowSubmission } from "@/lib/feedback/rate-limit"
import { isEmail, normalizeEmail } from "@/lib/billing/invitations"
import { clientKey, guard, json, problem, readJson } from "@/lib/billing/route-kit"
import { resendConfirmation } from "@/lib/billing/session"

export const dynamic = "force-dynamic"

// "Send the confirmation email again". Always answers the same way so it cannot be used to find out who has an account.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  if (!allowSubmission(`resend:${clientKey(request)}`)) return problem("Too many attempts. Please try again later.", 429)
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : ""
  if (!isEmail(email)) return problem("Enter a valid email address.", 400)
  await resendConfirmation(email, `${new URL(request.url).origin}/login?confirmed=1`).catch(() => undefined)
  return json({ ok: true })
}
