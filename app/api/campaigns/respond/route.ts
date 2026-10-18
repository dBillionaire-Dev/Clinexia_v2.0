import { NextResponse } from "next/server"
import { allowSubmission } from "@/lib/feedback/rate-limit"
import { isLive, validateResponse } from "@/lib/campaigns/model"
import { getCampaign, saveCampaignResponse } from "@/lib/campaigns/server"
import { isUuid } from "@/lib/billing/db"

export const dynamic = "force-dynamic"

// Stores one answer to a review form. The answers are checked against the form the admin built, and only while that form is live.
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 20_000) return NextResponse.json({ error: "Too large." }, { status: 413 })
    const key = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()
    if (!allowSubmission(`campaign:${key}`)) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 })
    }
    if (body?.website) return new NextResponse(null, { status: 204 }) // honeypot: real people leave it empty
    const aid = typeof body?.anonymousId === "string" ? body.anonymousId : ""
    if (!isUuid(body?.campaignId) || !/^[A-Za-z0-9_-]{8,80}$/.test(aid)) return NextResponse.json({ error: "Invalid request." }, { status: 400 })

    const campaign = await getCampaign(body.campaignId)
    if (!campaign || campaign.kind !== "form" || !isLive(campaign, Date.now())) return NextResponse.json({ error: "This form is no longer open." }, { status: 410 })
    if (body.version !== campaign.version) return NextResponse.json({ error: "This form was updated. Please reload and try again." }, { status: 409 })

    const checked = validateResponse(campaign.questions, body.answers)
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })
    const platform = typeof body.platform === "string" ? body.platform.slice(0, 30) : null
    await saveCampaignResponse(campaign, aid, platform, checked.value)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Clinexia campaign response error:", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "Could not save your answer. Please try again." }, { status: 500 })
  }
}
