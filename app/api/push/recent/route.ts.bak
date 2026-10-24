import { NextResponse } from "next/server"
import { currentUser } from "@/lib/billing/session"
import { listRecentMessages } from "@/lib/push/store"

export const dynamic = "force-dynamic"

// The notifications sent in the last week that apply to this person (everyone, plus signed-in people or guests as appropriate).
// The app shows any it has not shown yet when it opens, and keeps each on screen until the person closes it.
export async function GET() {
  const user = await currentUser().catch(() => null)
  try {
    return NextResponse.json({ messages: await listRecentMessages(Boolean(user)) }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ messages: [] }, { headers: { "Cache-Control": "no-store" } })
  }
}
