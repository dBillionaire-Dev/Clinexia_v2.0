import { NextResponse } from "next/server"
import { listLiveCampaigns } from "@/lib/campaigns/server"

export const dynamic = "force-dynamic"

// What the app should show right now. Public fields only (no admin label). Short cache: a campaign that is switched off or ends
// disappears within about half a minute.
export async function GET() {
  try {
    const live = await listLiveCampaigns()
    const campaigns = live.map(({ title: _title, status: _status, ...c }) => c)
    return NextResponse.json({ campaigns }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } })
  } catch {
    return NextResponse.json({ campaigns: [] }, { headers: { "Cache-Control": "no-store" } }) // not set up yet: stay quiet
  }
}
