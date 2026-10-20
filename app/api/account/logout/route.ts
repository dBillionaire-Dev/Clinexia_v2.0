import { guard, json } from "@/lib/billing/route-kit"
import { clearSessionCookies, revokeToken } from "@/lib/billing/session"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const m = /^Bearer\s+(\S+)$/i.exec((request.headers.get("authorization") ?? "").trim())
  if (m) await revokeToken(m[1]) // mobile: end the session behind the token (the app also deletes its copy)
  else await clearSessionCookies()
  return json({ ok: true })
}
