import { NextResponse } from "next/server"
import { allowSubmission } from "@/lib/feedback/rate-limit"
import { clientKey, clientSource, guard, json, problem, readJson } from "@/lib/billing/route-kit"
import { setSessionCookies, signInUser, userFromAccessToken } from "@/lib/billing/session"
import { getUserStatus } from "@/lib/billing/store"
import { deletionPhase, restoreAccount } from "@/lib/billing/account-deletion"
import { formatDate } from "@/lib/billing/emails"
import { suspendedMessage } from "@/lib/billing/admin-rules"
import { errorText, explainSetupError } from "@/lib/billing/setup-hints"
import { linkDevice } from "@/lib/billing/devices"
import { isEmail, normalizeEmail } from "@/lib/billing/invitations"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  if (!allowSubmission(`login:${clientKey(request)}`)) return problem("Too many attempts. Please try again later.", 429)

  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : ""
  const password = typeof body?.password === "string" ? body.password : ""
  if (!isEmail(email) || !password || password.length > 128) return problem("Email or password is incorrect.", 401)

  // Anything that goes wrong below is a server set-up problem, not the person's fault: log the cause, and in development say what to fix.
  const unavailable = (cause: unknown) => {
    const detail = errorText(cause)
    console.error("Clinexia sign-in unavailable:", detail)
    const hint = explainSetupError(detail)
    return NextResponse.json({ error: "Could not sign you in right now. Please try again.", ...(process.env.NODE_ENV !== "production" ? { hint: hint ?? detail } : {}) }, { status: 503 })
  }

  let result
  try {
    result = await signInUser(email, password)
  } catch (error) {
    return unavailable(error)
  }
  if ("error" in result) return result.error === "unconfirmed" ? problem("Please confirm your email first. Check your inbox for the link we sent.", 403) : problem("Email or password is incorrect.", 401)
  const session = result.session
  let user
  let status
  try {
    user = await userFromAccessToken(session.access_token)
    status = user ? await getUserStatus(user.id) : null
  } catch (error) {
    return unavailable(error)
  }
  if (!user || !status) return unavailable(new Error("Supabase did not return the signed-in user"))
  if (status.status === "suspended") return problem(suspendedMessage(status.notice), 403) // no session is created
  // A deleted account: for 7 days the person may choose to restore it (the screen asks, then repeats the sign-in with restore: true).
  const deletion = deletionPhase(status, Date.now())
  if (deletion.phase === "final") return problem("Email or password is incorrect.", 401)
  if (deletion.phase === "pending") {
    if (body?.restore !== true) return problem(`This account was deleted. You can restore it until ${formatDate(deletion.restoreUntil!)}.`, 410)
    try { await restoreAccount(user.id) } catch (error) { return unavailable(error) }
  }
  await linkDevice(user.id, user.email, body?.anonymousId) // this device now belongs to this account in the admin
  // The website keeps the session in secure cookies. The mobile apps cannot use cookies across sites, so they receive the tokens
  // once and send them as "Authorization: Bearer" afterwards.
  if (clientSource(request) !== "web") return json({ ok: true, session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in ?? 3600 } })
  await setSessionCookies(session)
  return json({ ok: true })
}
