import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { billingEnabled } from "@/lib/billing/config"
import { cleanReason, confirmationMatches, suspendedMessage } from "@/lib/billing/admin-rules"
import { getAuthUser } from "@/lib/billing/admin-users"
import { backfillDeviceLinks, linkDevice, unlinkDevice } from "@/lib/billing/devices"
import { isDeviceId } from "@/lib/billing/history"
import { cleanSpecialties } from "@/lib/billing/pricing"
import { SPECIALTY_LABELS } from "@/lib/billing/config"
import { isUuid } from "@/lib/billing/db"
import { errorText, explainSetupError } from "@/lib/billing/setup-hints"
import { composeNotice, sendEmail, type NoticeKind } from "@/lib/billing/notify"
import {
  deleteOrganisationCompletely, deleteUserCompletely, getOrgOwner, loadAdminUserDetail, loadAdminUsers, recordAudit, setOrgMarket, setSuspended, setUserMarket, setUserPlan, setUserStatus,
} from "@/lib/billing/store"

export const dynamic = "force-dynamic"

const out = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } })

async function gate(request: Request, write: boolean): Promise<NextResponse | null> {
  if (!billingEnabled()) return new NextResponse(null, { status: 404 })
  if (!(await isAdminAuthenticated())) return new NextResponse("Unauthorized", { status: 401 })
  if (write) {
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) return out({ error: "Cross-origin admin request rejected." }, 403)
  }
  return null
}

/** Emails the person (when a provider is configured) and reports what happened so the admin always knows if the notice went out. */
async function notify(email: string, kind: NoticeKind, input: { reason?: string; name?: string }) {
  const { subject, text } = composeNotice(kind, input)
  return sendEmail(email, subject, text)
}

export async function GET(request: Request) {
  const blocked = await gate(request, false)
  if (blocked) return blocked
  const url = new URL(request.url)
  const userId = url.searchParams.get("userId")
  if (userId) {
    if (!isUuid(userId)) return out({ error: "Invalid user." }, 400)
    try {
      const detail = await loadAdminUserDetail(userId)
      return detail ? out(detail) : out({ error: "User not found." }, 404)
    } catch (error) {
      return out({ error: explainSetupError(errorText(error)) ?? `Could not load this person: ${errorText(error).slice(0, 200)}` }, 500)
    }
  }
  try {
    return out(await loadAdminUsers(url.searchParams.get("q") ?? ""))
  } catch (error) {
    const message = errorText(error)
    console.error("Clinexia admin users failed:", message)
    return out({ error: explainSetupError(message) ?? `Could not load users: ${message.slice(0, 200)}` }, 500)
  }
}

export async function POST(request: Request) {
  const blocked = await gate(request, true)
  if (blocked) return blocked
  let body: any
  try {
    body = await request.json()
  } catch {
    return out({ error: "Invalid request." }, 400)
  }
  const action = body?.action
  const userId = typeof body?.userId === "string" ? body.userId : ""
  const orgId = typeof body?.orgId === "string" ? body.orgId : ""

  switch (action) {
    case "suspendUser": {
      if (!isUuid(userId)) return out({ error: "Invalid user." }, 400)
      const reason = cleanReason(body.reason)
      if (!reason) return out({ error: "Give a reason (5 to 500 characters). The person is shown it." }, 400)
      const user = await getAuthUser(userId)
      if (!user) return out({ error: "User not found." }, 404)
      await setUserStatus(userId, "suspended", reason, `Reason: ${reason}`)
      const email = await notify(user.email, "user_suspended", { reason })
      await recordAudit({ actorKind: "platform_admin", actorUserId: userId, action: "user.suspended", detail: { reason, email } })
      return out({ ok: true, email, preview: suspendedMessage(`Reason: ${reason}`) })
    }
    case "restoreUser": {
      if (!isUuid(userId)) return out({ error: "Invalid user." }, 400)
      const user = await getAuthUser(userId)
      if (!user) return out({ error: "User not found." }, 404)
      await setUserStatus(userId, "active", null, null)
      const email = await notify(user.email, "user_restored", {})
      await recordAudit({ actorKind: "platform_admin", actorUserId: userId, action: "user.restored", detail: { email } })
      return out({ ok: true, email })
    }
    case "deleteUser": {
      if (!isUuid(userId)) return out({ error: "Invalid user." }, 400)
      const reason = cleanReason(body.reason)
      if (!reason) return out({ error: "Give a reason (5 to 500 characters)." }, 400)
      const user = await getAuthUser(userId)
      if (!user) return out({ error: "User not found." }, 404)
      if (!confirmationMatches(body.confirm, user.email)) return out({ error: "Type the person's email address to confirm deletion." }, 400)
      const email = await notify(user.email, "user_deleted", { reason }) // sent first: after deletion there is nowhere to read the address from
      const result = await deleteUserCompletely(userId)
      if (!result.ok) return out({ error: result.error }, 409)
      await recordAudit({ actorKind: "platform_admin", action: "user.deleted", detail: { email: user.email, reason, notice: email } })
      return out({ ok: true, email })
    }
    case "setUserPlan": {
      if (!isUuid(userId)) return out({ error: "Invalid user." }, 400)
      const plan = body.plan === "free" || body.plan === "specialty" || body.plan === "all_access" ? body.plan : null
      if (!plan) return out({ error: "Choose free, specialty premium or all-access." }, 400)
      const specialties = plan === "specialty" ? cleanSpecialties(body.specialties) : []
      if (!specialties || (plan === "specialty" && specialties.length === 0)) return out({ error: "Choose at least one specialty." }, 400)
      const months = plan === "free" ? 0 : Number(body.months)
      if (plan !== "free" && (!Number.isInteger(months) || months < 1 || months > 24)) return out({ error: "Choose 1 to 24 months." }, 400)
      const user = await getAuthUser(userId)
      if (!user) return out({ error: "User not found." }, 404)
      const { periodEnd } = await setUserPlan(userId, plan, specialties, months)
      const label = plan === "free" ? "Free" : `${plan === "all_access" ? "All-access premium" : `Premium (${specialties.map((x) => SPECIALTY_LABELS[x]).join(", ")})`} until ${new Date(periodEnd!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
      const email = await notify(user.email, "plan_changed", { name: label })
      await recordAudit({ actorKind: "platform_admin", actorUserId: userId, action: "user.plan_set", detail: { plan, specialties, months, periodEnd, email } })
      return out({ ok: true, email, label })
    }
    case "backfillLinks": {
      try {
        const r = await backfillDeviceLinks()
        await recordAudit({ actorKind: "platform_admin", action: "devices.backfilled", detail: r })
        return out({ ok: true, ...r })
      } catch (error) {
        return out({ error: explainSetupError(errorText(error)) ?? "Could not link devices. Has supabase/billing-link.sql been run?" }, 500)
      }
    }
    case "linkDevice":
    case "unlinkDevice": {
      if (!isUuid(userId) || !isDeviceId(body.anonymousId)) return out({ error: "Paste a valid device ID (it looks like 8-4-4-4-12 letters and digits)." }, 400)
      const user = await getAuthUser(userId)
      if (!user) return out({ error: "User not found." }, 404)
      const link = action === "linkDevice"
      const ok = link ? await linkDevice(userId, user.email, body.anonymousId) : await unlinkDevice(userId, body.anonymousId)
      if (!ok) return out({ error: link ? "Could not link that device. Has supabase/billing-link.sql been run?" : "That device was not linked to this account." }, link ? 500 : 404)
      await recordAudit({ actorKind: "platform_admin", actorUserId: userId, action: link ? "device.linked" : "device.unlinked", detail: { anonymousId: body.anonymousId } })
      return out({ ok: true })
    }
    case "setUserMarket": {
      if (!isUuid(userId) || (body.market !== "ng" && body.market !== "intl")) return out({ error: "Invalid request." }, 400)
      if (!(await setUserMarket(userId, body.market))) return out({ error: "This person has no profile yet." }, 404)
      await recordAudit({ actorKind: "platform_admin", actorUserId: userId, action: "user.market_changed", detail: { market: body.market } })
      return out({ ok: true })
    }
    case "setOrgMarket": {
      if (!isUuid(orgId) || (body.market !== "ng" && body.market !== "intl")) return out({ error: "Invalid request." }, 400)
      if (!(await setOrgMarket(orgId, body.market))) return out({ error: "Organisation not found." }, 404)
      await recordAudit({ orgId, actorKind: "platform_admin", action: "org.market_changed", detail: { market: body.market } })
      return out({ ok: true })
    }
    case "suspendOrg":
    case "restoreOrg": {
      if (!isUuid(orgId)) return out({ error: "Invalid organisation." }, 400)
      const suspend = action === "suspendOrg"
      const reason = suspend ? cleanReason(body.reason) : undefined
      if (suspend && !reason) return out({ error: "Give a reason (5 to 500 characters)." }, 400)
      const org = await getOrgOwner(orgId)
      if (!org) return out({ error: "Organisation not found." }, 404)
      await setSuspended(orgId, suspend)
      const owner = await getAuthUser(org.ownerId)
      const email = owner ? await notify(owner.email, suspend ? "org_suspended" : "org_restored", { reason: reason ?? undefined, name: org.name }) : "not_configured"
      await recordAudit({ orgId, actorKind: "platform_admin", action: suspend ? "org.suspended" : "org.restored", detail: { reason, email } })
      return out({ ok: true, email })
    }
    case "deleteOrg": {
      if (!isUuid(orgId)) return out({ error: "Invalid organisation." }, 400)
      const reason = cleanReason(body.reason)
      if (!reason) return out({ error: "Give a reason (5 to 500 characters)." }, 400)
      const org = await getOrgOwner(orgId)
      if (!org) return out({ error: "Organisation not found." }, 404)
      if (!confirmationMatches(body.confirm, org.name)) return out({ error: "Type the organisation's name to confirm deletion." }, 400)
      const owner = await getAuthUser(org.ownerId)
      const email = owner ? await notify(owner.email, "org_deleted", { reason, name: org.name }) : "not_configured"
      await deleteOrganisationCompletely(orgId)
      await recordAudit({ actorKind: "platform_admin", action: "org.deleted", detail: { name: org.name, reason, notice: email } })
      return out({ ok: true, email })
    }
    default:
      return out({ error: "Unknown action." }, 400)
  }
}
