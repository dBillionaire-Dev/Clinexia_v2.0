import { NextResponse } from "next/server"
import { guard, readJson } from "@/lib/billing/route-kit"
import { currentUser } from "@/lib/billing/session"
import { upsertDevice } from "@/lib/push/store"
import { validPushToken } from "@/lib/push/validate"

export const dynamic = "force-dynamic"

// The Android app hands over its notification address. Signed in: the phone is linked to the account (so "signed-in people" notices
// reach it). Registering again after signing out unlinks it.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  if (!validPushToken(body?.token)) return NextResponse.json({ error: "Invalid token." }, { status: 400 })
  const aid = typeof body.anonymousId === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(body.anonymousId) ? body.anonymousId : null
  const user = await currentUser().catch(() => null)
  try {
    await upsertDevice(body.token, aid, user?.id ?? null, "android")
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Could not save. Have you run supabase/push.sql?" }, { status: 500 })
  }
}
