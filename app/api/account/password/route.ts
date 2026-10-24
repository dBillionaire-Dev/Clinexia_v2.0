import { after } from "next/server"
import { allowSubmission } from "@/lib/feedback/rate-limit"
import { publicBaseUrl } from "@/lib/billing/email-flows"
import { sendPasswordChangedNotice, validNewPassword } from "@/lib/billing/password-reset"
import { clientKey, clientSource, guard, isResponse, json, problem, readJson, requireUser } from "@/lib/billing/route-kit"
import { changePassword, clearSessionCookies } from "@/lib/billing/session"

export const dynamic = "force-dynamic"

// Change password while signed in: needs the current password. On success every session of the account ends (this one too), so the
// person signs in again with the new password.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  // The current password is being guessed at here, so attempts are limited per account and per connection.
  if (!allowSubmission(`pw:${user.id}`) || !allowSubmission(`pw-ip:${clientKey(request)}`)) return problem("Too many attempts. Please try again later.", 429)
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  const current = typeof body?.current === "string" ? body.current : ""
  if (!current || current.length > 128) return problem("Enter your current password.", 400)
  if (!validNewPassword(body?.next)) return problem("Use a new password of 10 to 128 characters.", 400)
  if (body.next === current) return problem("Your new password must be different from the current one.", 400)
  let r
  try {
    r = await changePassword(user.email, current, body.next)
  } catch {
    return problem("Could not change the password right now. Please try again.", 503)
  }
  if (!r.ok) {
    if (r.reason === "wrong") return problem("Your current password is not correct.", 400)
    if (r.reason === "same") return problem("Your new password must be different from the current one.", 400)
    if (r.reason === "weak") return problem("That password is too easy to guess. Choose a stronger one.", 400)
    return problem("Could not change the password right now. Please try again.", 503)
  }
  if (clientSource(request) === "web") await clearSessionCookies()
  const base = publicBaseUrl(new URL(request.url).origin)
  after(async () => { await sendPasswordChangedNotice(user.email, base) })
  return json({ ok: true })
}
