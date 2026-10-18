import { NextResponse } from "next/server"
import { billingEnabled, premiumEnforced } from "@/lib/billing/config"
import { resolveEntitlements } from "@/lib/billing/entitlements"
import { currentUser } from "@/lib/billing/session"
import { getPricing, loadEntitlementInputs } from "@/lib/billing/store"

export const dynamic = "force-dynamic"

const reply = (data: Record<string, unknown>) => NextResponse.json(data, { headers: { "Cache-Control": "no-store" } })

// Light status for the app shell (navbar icon, free/premium badges, guest allowance). Always 200 so signed-out visitors cause no errors.
export async function GET() {
  if (!billingEnabled()) return reply({ enabled: false, enforced: false, signedIn: false })
  const enforced = premiumEnforced()
  const user = await currentUser().catch(() => null)
  if (!user) return reply({ enabled: true, enforced, signedIn: false })
  try {
    const [pricing, inputs] = await Promise.all([getPricing(), loadEntitlementInputs(user.id)])
    const e = resolveEntitlements({ ...inputs, now: Date.now(), graceDays: pricing.graceDays })
    return reply({ enabled: true, enforced, signedIn: true, email: user.email, entitlements: { all: e.all, specialties: e.specialties } })
  } catch {
    return reply({ enabled: true, enforced, signedIn: true, email: user.email })
  }
}
