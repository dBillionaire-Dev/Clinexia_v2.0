import { setUserMetadata } from "@/lib/billing/admin-users"
import { db, uuid } from "@/lib/billing/db"
import { guard, isResponse, json, problem, readJson, requireUser } from "@/lib/billing/route-kit"
import { validateProfileUpdate } from "@/lib/billing/validation"

export const dynamic = "force-dynamic"

// "Your details": the signed-in person changes their own name and (for individuals) healthcare background and role.
// The email address is not changed here (it is what the person signs in with and where receipts and reset links go).
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  let body: unknown
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  try {
    const [profile] = await db.select("billing_profiles", `select=account_type&user_id=eq.${uuid(user.id)}`)
    if (!profile) return problem("Your profile was not found.", 404)
    const v = validateProfileUpdate(body, profile.account_type === "enterprise" ? "enterprise" : "individual")
    if (!v.ok) return problem(v.error, 400)
    const row = { full_name: v.value.fullName, ...(profile.account_type === "enterprise" ? {} : { background: v.value.background ?? null, role: v.value.role ?? null }) }
    await db.update("billing_profiles", `user_id=eq.${uuid(user.id)}`, row)
    await setUserMetadata(user.id, { full_name: v.value.fullName }).catch(() => undefined) // keeps Supabase's copy of the name in step
    return json({ ok: true, profile: { fullName: v.value.fullName, background: v.value.background ?? null, role: v.value.role ?? null } })
  } catch {
    return problem("Could not save your details right now. Please try again.", 503)
  }
}
