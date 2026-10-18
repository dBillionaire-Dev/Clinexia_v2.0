import { NextResponse } from "next/server"
import { rest } from "@/lib/traction/admin-data"

export const dynamic = "force-dynamic"

// Has this device already answered this round? Lets the popup stay quiet even if its saved state was lost or is out of date.
// Takes only the anonymous device id and the round number; returns a yes/no.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const aid = url.searchParams.get("aid") ?? ""
  const version = Number(url.searchParams.get("v"))
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(aid) || !Number.isInteger(version) || version < 1) return NextResponse.json({ answered: false }, { status: 400 })
  try {
    const rows = await rest().selectAll("feedback_responses", `select=id&anonymous_id=eq.${encodeURIComponent(aid)}&survey_version=eq.${version}&limit=1`)
    return NextResponse.json({ answered: rows.length > 0 }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ answered: false }, { headers: { "Cache-Control": "no-store" } })
  }
}
