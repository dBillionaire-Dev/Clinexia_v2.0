import { NextResponse } from "next/server"
import { currentUser } from "@/lib/billing/session"
import { listAnswered, listParked } from "@/lib/campaigns/server"

export const dynamic = "force-dynamic"

// What this person has already dealt with, so the website and the phone agree: forms they answered, and forms they parked with
// "Remind me later" (parked ones only for signed-in people). Works for guests too, by device.
export async function GET(request: Request) {
  const aid = new URL(request.url).searchParams.get("aid")
  const user = await currentUser().catch(() => null)
  try {
    const [answered, parked] = await Promise.all([listAnswered(user?.id ?? null, aid), user ? listParked(user.id) : Promise.resolve([])])
    return NextResponse.json({ answered, parked, signedIn: Boolean(user) }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ answered: [], parked: [], signedIn: Boolean(user) }, { headers: { "Cache-Control": "no-store" } })
  }
}
