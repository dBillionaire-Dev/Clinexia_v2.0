import { after } from "next/server"
import { allowSubmission } from "@/lib/feedback/rate-limit"
import { isEmail, normalizeEmail } from "@/lib/billing/invitations"
import { publicBaseUrl } from "@/lib/billing/email-flows"
import { requestPasswordReset } from "@/lib/billing/password-reset"
import { clientKey, guard, json, problem, readJson } from "@/lib/billing/route-kit"

export const dynamic = "force-dynamic"

// "Forgot password": emails a reset link when the address has an account. Always answers the same way, and does the work after the
// answer has gone out, so neither the words nor the timing reveal who has an account.
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
  // A second limit per address (each request counts twice: 4 emails per 15 minutes), so nobody can fill one person's inbox from many places.
  if (allowSubmission(`forgot-to:${email}`) && allowSubmission(`forgot-to:${email}`)) {
    const base = publicBaseUrl(new URL(request.url).origin)
    after(async () => { await requestPasswordReset(email, base) })
  }
  return json({ ok: true })
}
