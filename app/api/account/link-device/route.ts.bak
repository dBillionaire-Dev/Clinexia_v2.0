import { guard, isResponse, json, problem, readJson, requireUser } from "@/lib/billing/route-kit"
import { linkDevice } from "@/lib/billing/devices"
import { isDeviceId } from "@/lib/billing/history"

export const dynamic = "force-dynamic"

// Called by the website and the app once someone is signed in, so a device that was used before registering (or by an account made
// before this existed) is attached to the account. Only the signed-in person's own device id is linked.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  if (!isDeviceId(body?.anonymousId)) return problem("Invalid device.", 400)
  return json({ linked: await linkDevice(user.id, user.email, body.anonymousId) })
}
