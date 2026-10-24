import { computeQuote, type ManagedStatus } from "@/lib/billing/pricing"
import { detectMarket, guard, json, problem, readJson } from "@/lib/billing/route-kit"
import { orgStore, getPricing, getUserMarket } from "@/lib/billing/store"
import type { Market } from "@/lib/billing/config"
import { currentUser } from "@/lib/billing/session"
import { getLaunchStatus } from "@/lib/billing/launch-store"

export const dynamic = "force-dynamic"

// Public: shows the exact price before anyone signs up. The discount is decided from the organisation's STORED status,
// never from anything the browser sends.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  if (!body || typeof body !== "object") return problem("Invalid request.", 400)
  if (!(await getLaunchStatus()).switchedOn) return problem("Payments are not open yet.", 403)

  let managedStatus: ManagedStatus = "none"
  const user = await currentUser().catch(() => null)
  let market: Market = (user && (await getUserMarket(user.id).catch(() => null))) || detectMarket(request)
  if (body.kind === "enterprise" && typeof body.orgId === "string") {
    const [org, me] = user ? await Promise.all([orgStore.getOrg(body.orgId), orgStore.getMember(body.orgId, user.id)]) : [null, null]
    if (org && me) { managedStatus = org.managedStatus; market = org.market ?? "ng" }
  }
  const pricing = await getPricing()
  const result = computeQuote({ kind: body.kind === "enterprise" ? "enterprise" : "individual", plan: body.plan, specialties: body.specialties, seats: body.seats, managedStatus }, pricing, market)
  if (!result.ok) return problem(result.error, 400)
  return json({ quote: result.quote })
}
