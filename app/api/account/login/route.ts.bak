import { NextResponse } from "next/server"
import { allowSubmission } from "@/lib/feedback/rate-limit"
import { clientKey, guard, json, problem, readJson } from "@/lib/billing/route-kit"
import { setSessionCookies, signInUser, userFromAccessToken } from "@/lib/billing/session"
import { getUserStatus } from "@/lib/billing/store"
import { suspendedMessage } from "@/lib/billing/admin-rules"
import { errorText, explainSetupError } from "@/lib/billing/setup-hints"
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
  await setSessionCookies(session)
  return json({ ok: true })
}
