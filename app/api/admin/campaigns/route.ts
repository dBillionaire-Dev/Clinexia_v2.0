import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { isUuid } from "@/lib/billing/db"
import { errorText, explainSetupError } from "@/lib/billing/setup-hints"
import { cleanCampaignInput } from "@/lib/campaigns/model"
import { createCampaign, deleteCampaign, deleteCampaignResponse, getCampaign, listCampaignResponses, listCampaignsWithCounts, setCampaignStatus, showAgain, updateCampaign } from "@/lib/campaigns/server"

export const dynamic = "force-dynamic"

const out = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } })

// Administrator API for campaigns: create, edit, schedule, switch on/off, show again, delete, read responses.
export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) return new NextResponse("Unauthorized", { status: 401 })
  const id = new URL(request.url).searchParams.get("id")
  try {
    if (id) {
      if (!isUuid(id)) return out({ error: "Invalid campaign." }, 400)
      const campaign = await getCampaign(id)
      return campaign ? out({ campaign, responses: await listCampaignResponses(id) }) : out({ error: "Not found." }, 404)
    }
    return out({ campaigns: await listCampaignsWithCounts() })
  } catch (error) {
    const message = errorText(error)
    console.error("Clinexia admin campaigns failed:", message)
    return out({ error: explainSetupError(message) ?? `Could not load campaigns: ${message.slice(0, 200)}` }, 500)
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return new NextResponse("Unauthorized", { status: 401 })
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) return out({ error: "Cross-origin admin request rejected." }, 403)
  let body: any
  try {
    body = await request.json()
  } catch {
    return out({ error: "Invalid request." }, 400)
  }
  const id = typeof body?.id === "string" ? body.id : ""
  try {
    switch (body?.action) {
      case "save": {
        const cleaned = cleanCampaignInput(body.campaign)
        if (!cleaned.ok) return out({ error: cleaned.error }, 400)
        if (id) {
          if (!isUuid(id)) return out({ error: "Invalid campaign." }, 400)
          const saved = await updateCampaign(id, cleaned.value)
          return saved ? out({ campaign: saved }) : out({ error: "Not found." }, 404)
        }
        return out({ campaign: await createCampaign(cleaned.value) }, 201)
      }
      case "setStatus": {
        if (!isUuid(id) || !["draft", "active", "paused"].includes(body.status)) return out({ error: "Invalid request." }, 400)
        return (await setCampaignStatus(id, body.status)) ? out({ ok: true }) : out({ error: "Not found." }, 404)
      }
      case "showAgain": {
        if (!isUuid(id)) return out({ error: "Invalid campaign." }, 400)
        return (await showAgain(id)) ? out({ ok: true }) : out({ error: "Not found." }, 404)
      }
      case "delete": {
        if (!isUuid(id)) return out({ error: "Invalid campaign." }, 400)
        return (await deleteCampaign(id)) ? out({ ok: true }) : out({ error: "Not found." }, 404)
      }
      case "deleteResponse": {
        if (!isUuid(body.responseId)) return out({ error: "Invalid response." }, 400)
        return (await deleteCampaignResponse(body.responseId)) ? out({ ok: true }) : out({ error: "Not found." }, 404)
      }
      default:
        return out({ error: "Unknown action." }, 400)
    }
  } catch {
    return out({ error: "Could not save. Have you run supabase/campaigns.sql?" }, 500)
  }
}
