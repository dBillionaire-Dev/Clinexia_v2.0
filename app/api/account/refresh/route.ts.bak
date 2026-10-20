import { suspendedMessage } from "@/lib/billing/admin-rules"
import { guard, json, problem, readJson } from "@/lib/billing/route-kit"
import { refreshSession, userFromAccessToken } from "@/lib/billing/session"
import { getUserStatus } from "@/lib/billing/store"

export const dynamic = "force-dynamic"

// Mobile apps trade their refresh token for a fresh access token here. Suspended accounts are refused, so a suspension reaches
// the app within the lifetime of one access token.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  const token = typeof body?.refresh_token === "string" ? body.refresh_token : ""
  if (!token || token.length > 2000) return problem("Please sign in again.", 401)
  try {
    const session = await refreshSession(token)
    if (!session) return problem("Please sign in again.", 401)
    const user = await userFromAccessToken(session.access_token)
    if (!user) return problem("Please sign in again.", 401)
    const status = await getUserStatus(user.id)
    if (status.status === "suspended") return problem(suspendedMessage(status.notice), 403)
    return json({ session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in ?? 3600 } })
  } catch {
    return problem("Could not refresh the sign-in right now.", 503)
  }
}
