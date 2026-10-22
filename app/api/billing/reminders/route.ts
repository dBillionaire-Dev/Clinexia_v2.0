import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { billingEnabled } from "@/lib/billing/config"
import { publicBaseUrl, retryPendingReceipts, runPlanReminders } from "@/lib/billing/email-flows"
import { errorText, explainSetupError } from "@/lib/billing/setup-hints"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Daily job (see vercel.json). Emails people whose plan is about to end and retries receipts that failed to send.
// Authentication: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Nobody else can trigger it.
async function run(request: Request) {
  if (!billingEnabled()) return new NextResponse(null, { status: 404 })
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 })
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""))
  const wanted = Buffer.from(secret)
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return new NextResponse("Unauthorized", { status: 401 })
  const base = publicBaseUrl(new URL(request.url).origin)
  try {
    const reminders = await runPlanReminders(base)
    const receiptsRetried = await retryPendingReceipts(base)
    return NextResponse.json({ ...reminders, receiptsRetried }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = errorText(error)
    console.error("Clinexia reminders failed:", message)
    return NextResponse.json({ error: explainSetupError(message) ?? message.slice(0, 200) }, { status: 500 })
  }
}

export const GET = run
export const POST = run
