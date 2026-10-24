import { computeQuote, type ManagedStatus } from "@/lib/billing/pricing"
import { can } from "@/lib/billing/roles"
import { clientSource, detectMarket, guard, isResponse, json, problem, readJson, requireUser } from "@/lib/billing/route-kit"
import type { Market } from "@/lib/billing/config"
import { createPaystack, makeReference } from "@/lib/billing/paystack"
import { getLaunchStatus } from "@/lib/billing/launch-store"
import { createOrder, ensureSubscription, getPricing, getUserMarket, orgStore, recordAudit, seatCounts } from "@/lib/billing/store"

export const dynamic = "force-dynamic"

// Starts a Paystack payment. The amount is computed here from stored data; the order row is what the webhook later checks against.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  if (!(await getLaunchStatus()).switchedOn) return problem("Payments are not open yet.", 403)
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return problem("Payments are not set up yet.", 503)

  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  const enterprise = body?.kind === "enterprise"
  const pricing = await getPricing()
  let managedStatus: ManagedStatus = "none"
  let orgId: string | undefined
  let market: Market = (await getUserMarket(user.id).catch(() => null)) ?? detectMarket(request)

  if (enterprise) {
    const id: string = typeof body.orgId === "string" ? body.orgId : ""
    orgId = id
    const [org, me] = await Promise.all([orgStore.getOrg(id), orgStore.getMember(id, user.id)])
    if (!org || !me) return problem("Organisation not found.", 404)
    if (!can(me.role, "org.billing")) return problem("Only the organisation owner can manage billing.", 403)
    if (org.suspended) return problem("This organisation is suspended.", 403)
    managedStatus = org.managedStatus
    market = org.market ?? "ng"
  }

  const result = computeQuote({ kind: enterprise ? "enterprise" : "individual", plan: body?.plan, specialties: body?.specialties, seats: body?.seats, managedStatus }, pricing, market)
  if (!result.ok) return problem(result.error, 400)
  const q = result.quote
  if (q.totalMinor <= 0) return problem("Nothing to pay.", 400)

  if (orgId) {
    const used = await seatCounts(orgId)
    if (q.seats < used.members + used.pendingInvitations) return problem(`You have ${used.members + used.pendingInvitations} seats in use. Remove members or invitations before choosing fewer seats.`, 400)
  }

  const target = { plan: q.plan, specialties: q.specialties, seats: q.seats }
  const owner = orgId ? { orgId } : { userId: user.id }
  const subscriptionId = await ensureSubscription(owner, target)
  const reference = makeReference()
  await createOrder({ reference, currency: q.currency, subscriptionId, userId: orgId ? undefined : user.id, orgId, payerUserId: user.id, amountMinor: q.totalMinor, target, quote: q as unknown as Record<string, unknown> })

  try {
    const { authorizationUrl } = await createPaystack(secret).initialize({ email: user.email, amountMinor: q.totalMinor, currency: q.currency, reference, callbackUrl: `${new URL(request.url).origin}/account/payment${clientSource(request) === "web" ? "" : "?app=1"}` })
    await recordAudit({ orgId, actorUserId: user.id, action: "checkout.started", detail: { reference, totalMinor: q.totalMinor, plan: q.plan } })
    return json({ authorizationUrl, reference, quote: q })
  } catch {
    return problem("Could not reach the payment provider. Please try again.", 502)
  }
}
