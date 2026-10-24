import { allowSubmission } from "@/lib/feedback/rate-limit"
import { decodeAvatar } from "@/lib/billing/avatar"
import { putAvatar, removeAvatar } from "@/lib/billing/avatar-store"
import { setUserMetadata } from "@/lib/billing/admin-users"
import { clientKey, guard, isResponse, json, problem, readJson, requireUser } from "@/lib/billing/route-kit"
import { errorText, explainSetupError } from "@/lib/billing/setup-hints"

export const dynamic = "force-dynamic"

// Upload or remove the signed-in person's own profile photo ({ image: base64 JPEG } or { remove: true }). The browser shrinks the picture
// first; the checks here (2 MB, really a JPEG) do not depend on that.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  if (!allowSubmission(`avatar:${user.id}`) || !allowSubmission(`avatar-ip:${clientKey(request)}`)) return problem("Too many attempts. Please try again later.", 429)

  let body: any
  try {
    body = await readJson(request, 3_200_000)
  } catch {
    return problem("That photo is too large. Choose one of 2 MB or smaller.", 413)
  }
  try {
    if (body?.remove === true) {
      await removeAvatar(user.id)
      await setUserMetadata(user.id, { clinexia_avatar: null })
      return json({ ok: true, avatarUrl: null })
    }
    const d = decodeAvatar(body?.image)
    if (!d.ok) return problem(d.error, 400)
    const url = await putAvatar(user.id, d.bytes)
    await setUserMetadata(user.id, { clinexia_avatar: url })
    return json({ ok: true, avatarUrl: url })
  } catch (error) {
    const detail = errorText(error)
    console.error("Clinexia photo failed:", detail)
    const hint = explainSetupError(detail)
    return json({ error: "Could not save the photo right now. Please try again.", ...(process.env.NODE_ENV !== "production" && hint ? { hint } : {}) }, 503)
  }
}
