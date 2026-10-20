import { NextResponse } from "next/server"
import { guard, readJson } from "@/lib/billing/route-kit"
import { isUuid } from "@/lib/billing/db"
import { currentUser } from "@/lib/billing/session"
import { setParked } from "@/lib/campaigns/server"

export const dynamic = "force-dynamic"

// Remembers "Remind me later" for a signed-in person, so the reminder waits in their profile icon on every device.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const user = await currentUser().catch(() => null)
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 })
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  if (!isUuid(body?.campaignId) || !Number.isInteger(body?.version) || typeof body?.parked !== "boolean") return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  try {
    await setParked(user.id, body.campaignId, body.version, body.parked)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Could not save." }, { status: 500 })
  }
}
