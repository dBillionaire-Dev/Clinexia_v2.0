import {
  acceptInvitation, createOrganisation, getDashboard, inviteMembers, leaveOrganisation, removeMember, revokeInvitation, setMemberSpecialties, type Settings,
} from "@/lib/billing/org-actions"
import { can } from "@/lib/billing/roles"
import { clientKey, failure, guard, isResponse, json, problem, readJson, requireUser } from "@/lib/billing/route-kit"
import { getPricing, orgStore, recordAudit, setManagedStatus } from "@/lib/billing/store"
import { validateOrganisation } from "@/lib/billing/validation"
import { emailInvitations, publicBaseUrl } from "@/lib/billing/email-flows"
import { emailConfigured } from "@/lib/billing/notify"
import { accountServiceFor, directoryStore } from "@/lib/billing/directory-store"
import { emailNewPeople } from "@/lib/billing/directory-flows"
import { addPeople, authoriseMemberPasswordReset, createGroup, deleteGroup, parsePeopleCsv, renameGroup, setMemberDisabled, setMemberGroup, type PersonRow } from "@/lib/billing/org-directory"
import { requestPasswordReset } from "@/lib/billing/password-reset"
import { allowSubmission } from "@/lib/feedback/rate-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function settings(): Promise<Settings> {
  const p = await getPricing()
  return { graceDays: p.graceDays, invitationTtlHours: p.invitationTtlHours, now: Date.now() }
}

export async function GET(request: Request) {
  const blocked = guard(request)
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  const orgId = new URL(request.url).searchParams.get("orgId") ?? ""
  const r = await getDashboard(orgStore, { userId: user.id }, orgId, await settings())
  if (!r.ok) return failure(r)
  // Groups of the directory (empty until supabase/org-directory.sql has been run).
  const groups = can(r.role, "org.view") ? await directoryStore.listGroups(orgId).catch(() => []) : []
  return json({ ...r, groups })
}

// One endpoint, several actions. Each action re-checks the caller's own membership inside lib/billing/org-actions.
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  const actor = { userId: user.id }
  const s = await settings()
  const str = (v: unknown) => (typeof v === "string" ? v : "")

  switch (body?.action) {
    case "create": {
      const v = validateOrganisation(body)
      if (!v.ok) return problem(v.error, 400)
      const r = await createOrganisation(orgStore, actor, v.value)
      return r.ok ? json({ orgId: r.orgId }, 201) : failure(r)
    }
    case "invite": {
      const r = await inviteMembers(orgStore, actor, str(body.orgId), { emails: str(body.emails), role: body.role === "admin" ? "admin" : "staff", specialties: body.specialties, allSpecialties: body.allSpecialties === true }, s)
      if (!r.ok) return failure(r)
      // Each invitee is emailed automatically (Resend). The private link is still returned once to the inviter (only hashes are
      // stored) as a backup, and `emailed` says whether the email went out, so the screen can ask them to share it themselves.
      const origin = new URL(request.url).origin
      const base = publicBaseUrl(origin)
      const org = await orgStore.getOrg(str(body.orgId))
      const emailed = await emailInvitations({
        orgId: str(body.orgId), orgName: org?.name ?? "", inviterId: user.id, inviterEmail: user.email, role: body.role === "admin" ? "admin" : "staff",
        expiresAt: new Date(s.now + s.invitationTtlHours * 3_600_000).toISOString(), baseUrl: base, created: r.created,
      })
      const sentCount = Object.values(emailed).filter(Boolean).length
      if (sentCount > 0) await recordAudit({ orgId: str(body.orgId), actorUserId: user.id, action: "invite.emailed", detail: { count: sentCount } })
      return json({
        emailConfigured: emailConfigured(),
        created: r.created.map((c) => ({ email: c.email, emailed: emailed[c.email] === true, link: `${origin}/account/join?token=${encodeURIComponent(c.token)}` })),
        skipped: r.skipped,
      })
    }
    case "groupCreate": {
      const r = await createGroup(orgStore, directoryStore, actor, str(body.orgId), body.name)
      return r.ok ? json({ ok: true, id: r.id }) : failure(r)
    }
    case "groupRename": {
      const r = await renameGroup(orgStore, directoryStore, actor, str(body.orgId), str(body.groupId), body.name)
      return r.ok ? json({ ok: true }) : failure(r)
    }
    case "groupDelete": {
      const r = await deleteGroup(orgStore, directoryStore, actor, str(body.orgId), str(body.groupId))
      return r.ok ? json({ ok: true }) : failure(r)
    }
    case "setGroup": {
      const r = await setMemberGroup(orgStore, directoryStore, actor, str(body.orgId), str(body.userId), str(body.groupId) || null)
      return r.ok ? json({ ok: true }) : failure(r)
    }
    case "setDisabled": {
      const r = await setMemberDisabled(orgStore, directoryStore, actor, str(body.orgId), str(body.userId), body.disabled === true)
      return r.ok ? json({ ok: true }) : failure(r)
    }
    case "addPeople": {
      // Creates accounts for people who do not have one yet (one person, or a pasted spreadsheet) and emails each a link to choose a password.
      if (!allowSubmission(`dir-add:${user.id}`) || !allowSubmission(`dir-add-ip:${clientKey(request)}`)) return problem("Too many attempts. Please try again later.", 429)
      let rows: PersonRow[] = Array.isArray(body.rows) ? (body.rows as PersonRow[]).slice(0, 200) : []
      if (typeof body.csv === "string") {
        const parsed = parsePeopleCsv(body.csv.slice(0, 200_000))
        if (parsed.error) return problem(parsed.error, 400)
        rows = parsed.rows
      }
      const org = await orgStore.getOrg(str(body.orgId))
      const r = await addPeople(orgStore, directoryStore, accountServiceFor(org?.market === "intl" ? "intl" : "ng"), actor, str(body.orgId), { rows, allSpecialties: body.allSpecialties !== false, specialties: body.specialties, defaultGroupId: str(body.groupId) || null }, s)
      if (!r.ok) return failure(r)
      const base = publicBaseUrl(new URL(request.url).origin)
      const emailed = await emailNewPeople({ orgName: org?.name ?? "", adminName: user.email, baseUrl: base, people: r.created })
      return json({ emailConfigured: emailConfigured(), results: r.results.map((x) => ({ ...x, emailed: x.status === "created" ? emailed[x.email] === true : undefined })) })
    }
    case "resetMemberPassword": {
      if (!allowSubmission(`dir-reset:${user.id}`)) return problem("Too many attempts. Please try again later.", 429)
      const a = await authoriseMemberPasswordReset(orgStore, actor, str(body.orgId), str(body.userId))
      if (!a.ok) return failure(a)
      const outcome = await requestPasswordReset(a.email, publicBaseUrl(new URL(request.url).origin), undefined, { adminAction: true })
      return outcome === "sent" ? json({ ok: true, emailedTo: a.email }) : problem("The email could not be sent right now. Please try again in a few minutes.", 503)
    }
    case "revoke": {
      const r = await revokeInvitation(orgStore, actor, str(body.orgId), str(body.inviteId))
      return r.ok ? json({ ok: true }) : failure(r)
    }
    case "remove": {
      const r = await removeMember(orgStore, actor, str(body.orgId), str(body.userId))
      return r.ok ? json({ ok: true }) : failure(r)
    }
    case "setSpecialties": {
      const r = await setMemberSpecialties(orgStore, actor, str(body.orgId), str(body.userId), { specialties: body.specialties, allSpecialties: body.allSpecialties === true })
      return r.ok ? json({ ok: true }) : failure(r)
    }
    case "leave": {
      const r = await leaveOrganisation(orgStore, actor, str(body.orgId))
      return r.ok ? json({ ok: true }) : failure(r)
    }
    case "accept": {
      const r = await acceptInvitation(orgStore, { userId: user.id, email: user.email }, str(body.token))
      return r.ok ? json({ orgId: r.orgId }) : failure(r)
    }
    case "requestManaged": {
      // Asks Clinexia to verify central identity management. Nothing is discounted until a platform admin verifies it.
      const orgId = str(body.orgId)
      const [org, me] = await Promise.all([orgStore.getOrg(orgId), orgStore.getMember(orgId, user.id)])
      if (!org || !me) return problem("Organisation not found.", 404)
      if (!can(me.role, "org.billing")) return problem("Only the organisation owner can request this.", 403)
      if (org.managedStatus === "verified" || org.managedStatus === "requested") return problem("This has already been requested.", 409)
      await setManagedStatus(orgId, "requested")
      await recordAudit({ orgId, actorUserId: user.id, action: "managed.requested" })
      return json({ ok: true })
    }
    default:
      return problem("Unknown action.", 400)
  }
}
