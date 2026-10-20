import { allowSubmission } from "@/lib/feedback/rate-limit"
import { db } from "@/lib/billing/db"
import { linkDevice } from "@/lib/billing/devices"
import { clientKey, clientSource, detectMarket, guard, json, problem, readJson } from "@/lib/billing/route-kit"
import { setSessionCookies, signUpUser } from "@/lib/billing/session"
import { validateSignup } from "@/lib/billing/validation"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  if (!allowSubmission(`signup:${clientKey(request)}`)) return problem("Too many attempts. Please try again later.", 429)

  let body: unknown
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  const v = validateSignup(body)
  if (!v.ok) return problem(v.error, 400)

  try {
    const { userId, session } = await signUpUser(v.value.email, v.value.password, v.value.fullName, `${new URL(request.url).origin}/login?confirmed=1`)
    if (userId) {
      // ignoreDuplicates: never overwrite an existing person's profile
      await db
        .insert("billing_profiles", { user_id: userId, full_name: v.value.fullName, account_type: v.value.accountType, background: v.value.background ?? null, role: v.value.role ?? null, market: detectMarket(request), source: clientSource(request) }, { ignoreDuplicates: true })
        .catch(() => undefined)
      // From this moment the device's earlier calculations belong to this person in the admin. (A made-up id for an address that already
      // exists simply fails the link: nothing is attached to someone else's account.)
      await linkDevice(userId, v.value.email, (body as { anonymousId?: unknown })?.anonymousId, v.value.fullName)
    }
    const mobile = clientSource(request) !== "web"
    if (session && !mobile) await setSessionCookies(session)
    // Same answer whether or not the address already existed.
    return json({ ok: true, signedIn: Boolean(session), ...(session && mobile ? { session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in ?? 3600 } } : {}) })
  } catch {
    return problem("Could not create the account. If you already have one, please sign in.", 400)
  }
}
