import { allowSubmission } from "@/lib/feedback/rate-limit"
import { db } from "@/lib/billing/db"
import { clientKey, detectMarket, guard, json, problem, readJson } from "@/lib/billing/route-kit"
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
        .insert("billing_profiles", { user_id: userId, full_name: v.value.fullName, account_type: v.value.accountType, background: v.value.background ?? null, role: v.value.role ?? null, market: detectMarket(request) }, { ignoreDuplicates: true })
        .catch(() => undefined)
    }
    if (session) await setSessionCookies(session)
    return json({ ok: true, signedIn: Boolean(session) }) // same answer whether or not the address already existed
  } catch {
    return problem("Could not create the account. If you already have one, please sign in.", 400)
  }
}
