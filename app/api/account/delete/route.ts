import { after } from "next/server"
import { allowSubmission } from "@/lib/feedback/rate-limit"
import { deletionBlocker, markDeleted } from "@/lib/billing/account-deletion"
import { composeAccountDeletedEmail } from "@/lib/billing/emails"
import { publicBaseUrl } from "@/lib/billing/email-flows"
import { sendEmailMessage } from "@/lib/billing/notify"
import { db, uuid } from "@/lib/billing/db"
import { clientKey, clientSource, guard, isResponse, json, problem, readJson, requireUser } from "@/lib/billing/route-kit"
import { clearSessionCookies, signInUser, signOutEverywhere } from "@/lib/billing/session"

export const dynamic = "force-dynamic"

// Delete my account. The person confirms with their password. It is a soft delete: they are signed out everywhere and the account
// looks gone, but nothing is erased and for 7 days signing in offers to restore it (see lib/billing/account-deletion.ts).
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  if (!allowSubmission(`del:${user.id}`) || !allowSubmission(`del-ip:${clientKey(request)}`)) return problem("Too many attempts. Please try again later.", 429)
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  if (body?.confirm !== true) return problem("Confirm that you want to delete your account.", 400)
  const password = typeof body?.password === "string" ? body.password : ""
  if (!password || password.length > 128) return problem("Enter your password to delete your account.", 400)
  try {
    const why = await deletionBlocker(user.id)
    if (why) return problem(why, 409)
    const s = await signInUser(user.email, password) // proves it is really them, and gives the session that ends all the others
    if ("error" in s) return problem("Your password is not correct.", 400)
    const { restoreUntil } = await markDeleted(user.id)
    await signOutEverywhere(s.session.access_token)
    if (clientSource(request) === "web") await clearSessionCookies()
    const base = publicBaseUrl(new URL(request.url).origin)
    after(async () => {
      let name = ""
      try { name = String((await db.select("billing_profiles", `select=full_name&user_id=eq.${uuid(user.id)}`))[0]?.full_name ?? "") } catch { /* optional */ }
      await sendEmailMessage({ to: user.email, ...composeAccountDeletedEmail({ name, restoreUntil, loginUrl: `${base}/login` }) }).catch(() => undefined)
    })
    return json({ ok: true, restoreUntil })
  } catch (error) {
    console.error("Clinexia account deletion failed:", error instanceof Error ? error.message : "unknown")
    return problem("Could not delete the account right now. Please try again.", 503)
  }
}
