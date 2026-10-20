import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { parseServiceAccount, sendToDevices } from "@/lib/push/fcm"
import { deviceCounts, listMessages, listTokens, removeTokens, saveMessage } from "@/lib/push/store"
import { validatePush } from "@/lib/push/validate"

export const dynamic = "force-dynamic"

const out = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } })

// Administrator API for phone notifications: how many phones are registered, what was sent, and send a new one.
export async function GET() {
  if (!(await isAdminAuthenticated())) return new NextResponse("Unauthorized", { status: 401 })
  try {
    const [devices, messages] = await Promise.all([deviceCounts(), listMessages()])
    return out({ configured: parseServiceAccount(process.env.FCM_SERVICE_ACCOUNT_JSON) !== null, devices, messages })
  } catch {
    return out({ error: "Could not load. Have you run supabase/push.sql?" }, 500)
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
  const checked = validatePush(body)
  if (!checked.ok) return out({ error: checked.error }, 400)
  const sa = parseServiceAccount(process.env.FCM_SERVICE_ACCOUNT_JSON)
  if (!sa) return out({ error: "Notifications are not set up. Add FCM_SERVICE_ACCOUNT_JSON on the server (see docs/billing.md)." }, 503)
  try {
    const tokens = await listTokens(checked.value.audience)
    if (tokens.length === 0) return out({ error: "No phones are registered for that audience yet." }, 409)
    const result = await sendToDevices(sa, tokens, { title: checked.value.title, body: checked.value.body, url: checked.value.url || undefined })
    if (result.unregistered.length) await removeTokens(result.unregistered)
    await saveMessage({ ...checked.value, sent: result.sent, failed: result.failed, removed: result.unregistered.length })
    return out({ ok: true, sent: result.sent, failed: result.failed, removed: result.unregistered.length })
  } catch (error) {
    console.error("Clinexia push send error:", error instanceof Error ? error.message : "unknown")
    return out({ error: "Could not send. Check the notification settings on the server." }, 502)
  }
}
