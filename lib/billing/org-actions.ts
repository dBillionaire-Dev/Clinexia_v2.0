// Organisation operations (create, invite, revoke, remove, assign, leave, accept). Everything goes through an OrgStore so
// the rules here are testable without a database. Cross-organisation safety: every call first loads the ACTOR'S OWN
// membership for the target organisation; without one the answer is "not_found", never "forbidden", so ids cannot be probed.
import { type Market, type Specialty } from "./config"
import { cleanSpecialties } from "./pricing"
import { assignableSpecialties, can, canManageMember, invitableRoles, type OrgRole } from "./roles"
import { effectiveStatus, grantsAccess } from "./lifecycle"
import type { PlanRecord } from "./entitlements"
import { hashInviteToken, newInviteToken, normalizeEmail, parseEmailList } from "./invitations"
import { seatUsage } from "./seats"

export interface OrgRecord { id: string; name: string; orgType: string; market?: Market; seats: number; suspended: boolean; managedStatus: "none" | "requested" | "verified" | "rejected"; plan: PlanRecord | null }
export interface MemberRecord { userId: string; email: string; fullName: string; role: OrgRole; allSpecialties: boolean; specialties: Specialty[]; joinedAt: string; groupId?: string | null; disabled?: boolean; managed?: boolean }
export interface InviteRecord { id: string; email: string; role: OrgRole; allSpecialties: boolean; specialties: Specialty[]; expiresAt: string }

export type CreateInviteResult = { ok: true; invite: InviteRecord } | { ok: false; reason: "no_capacity" | "duplicate_invite" | "already_member" }
export type AcceptResult = { ok: true; orgId: string } | { ok: false; reason: "invalid" | "expired" | "revoked" | "used" | "wrong_email" | "already_member" }

export interface OrgStore {
  getOrg(orgId: string): Promise<OrgRecord | null>
  getMember(orgId: string, userId: string): Promise<MemberRecord | null>
  listMembers(orgId: string): Promise<MemberRecord[]>
  /** Pending, unexpired invitations only. */
  listPendingInvites(orgId: string): Promise<InviteRecord[]>
  createOrg(input: { name: string; orgType: string; ownerUserId: string }): Promise<{ id: string }>
  /** MUST be atomic: checks free seats (members + pending), duplicates and membership, then inserts, under a lock. */
  createInvite(input: { orgId: string; email: string; role: OrgRole; allSpecialties: boolean; specialties: Specialty[]; tokenHash: string; expiresAt: string; invitedBy: string }): Promise<CreateInviteResult>
  revokeInvite(orgId: string, inviteId: string): Promise<boolean>
  removeMember(orgId: string, userId: string): Promise<boolean>
  updateMember(orgId: string, userId: string, patch: { allSpecialties: boolean; specialties: Specialty[] }): Promise<boolean>
  acceptInvite(input: { tokenHash: string; userId: string; email: string }): Promise<AcceptResult>
  audit(event: { orgId: string; actorUserId: string; action: string; detail?: Record<string, unknown> }): Promise<void>
}

export interface Actor { userId: string }
export interface Settings { graceDays: number; invitationTtlHours: number; now: number }

export type Failure = { ok: false; code: "not_found" | "forbidden" | "invalid" | "subscription_inactive" | "conflict"; message: string }
export type Outcome<T> = ({ ok: true } & T) | Failure
const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message })

async function load(store: OrgStore, orgId: string, actor: Actor) {
  const [org, me] = await Promise.all([store.getOrg(orgId), store.getMember(orgId, actor.userId)])
  if (!org || !me || me.disabled) return null // a disabled member has no say in the organisation
  return { org, me }
}

export async function createOrganisation(store: OrgStore, actor: Actor, input: { name: string; orgType: string }): Promise<Outcome<{ orgId: string }>> {
  const { id } = await store.createOrg({ ...input, ownerUserId: actor.userId })
  await store.audit({ orgId: id, actorUserId: actor.userId, action: "org.created", detail: { orgType: input.orgType } })
  return { ok: true, orgId: id }
}

export async function getDashboard(store: OrgStore, actor: Actor, orgId: string, s: Settings) {
  const ctx = await load(store, orgId, actor)
  if (!ctx) return fail("not_found", "Organisation not found.")
  const { org, me } = ctx
  const status = org.plan ? effectiveStatus(org.plan, s.now, s.graceDays) : "pending"
  const base = { ok: true as const, org: { id: org.id, name: org.name, orgType: org.orgType, managedStatus: org.managedStatus, suspended: org.suspended }, role: me.role, subscriptionStatus: status, plan: org.plan }
  if (!can(me.role, "org.view")) return { ...base, members: [me], invitations: [], seats: seatUsage({ seats: org.seats, members: 1, pendingInvitations: 0 }) } // staff see only themselves
  const [members, invites] = await Promise.all([store.listMembers(orgId), store.listPendingInvites(orgId)])
  return { ...base, members, invitations: invites, seats: seatUsage({ seats: org.seats, members: members.length, pendingInvitations: invites.length }) }
}

export async function inviteMembers(
  store: OrgStore,
  actor: Actor,
  orgId: string,
  input: { emails: string; role: OrgRole; specialties?: unknown; allSpecialties?: boolean },
  s: Settings,
): Promise<Outcome<{ created: Array<{ email: string; token: string }>; skipped: Array<{ email: string; reason: string }> }>> {
  const ctx = await load(store, orgId, actor)
  if (!ctx) return fail("not_found", "Organisation not found.")
  const { org, me } = ctx
  if (!can(me.role, "member.invite")) return fail("forbidden", "You cannot invite members.")
  if (org.suspended) return fail("forbidden", "This organisation is suspended.")
  if (!org.plan || !grantsAccess(effectiveStatus(org.plan, s.now, s.graceDays))) return fail("subscription_inactive", "The organisation needs an active subscription before inviting staff.")
  if (!invitableRoles(me.role).includes(input.role)) return fail("forbidden", "You cannot invite someone with that role.")

  const allowed = assignableSpecialties(org.plan)
  const allSpecialties = input.allSpecialties === true
  let specialties: Specialty[] = []
  if (!allSpecialties) {
    const cleaned = cleanSpecialties(input.specialties ?? [])
    if (!cleaned || cleaned.length === 0) return fail("invalid", "Choose at least one specialty for the new member.")
    if (cleaned.some((x) => !allowed.includes(x))) return fail("forbidden", "That specialty is not part of the organisation's plan.")
    specialties = cleaned
  }

  const list = parseEmailList(input.emails)
  if (list.emails.length === 0) return fail("invalid", "Enter at least one valid email address.")
  if (list.tooMany) return fail("invalid", "Invite at most 100 people at a time.")

  const created: Array<{ email: string; token: string }> = []
  const skipped: Array<{ email: string; reason: string }> = list.invalid.map((email) => ({ email, reason: "Not a valid email address." }))
  const expiresAt = new Date(s.now + s.invitationTtlHours * 3_600_000).toISOString()

  for (const email of list.emails) {
    const { token, hash } = newInviteToken()
    const r = await store.createInvite({ orgId, email, role: input.role, allSpecialties, specialties, tokenHash: hash, expiresAt, invitedBy: actor.userId })
    if (r.ok) created.push({ email, token })
    else skipped.push({ email, reason: r.reason === "no_capacity" ? "No free seats." : r.reason === "duplicate_invite" ? "Already invited." : "Already a member." })
  }
  await store.audit({ orgId, actorUserId: actor.userId, action: "member.invited", detail: { count: created.length, role: input.role } })
  return { ok: true, created, skipped }
}

export async function revokeInvitation(store: OrgStore, actor: Actor, orgId: string, inviteId: string): Promise<Outcome<object>> {
  const ctx = await load(store, orgId, actor)
  if (!ctx) return fail("not_found", "Organisation not found.")
  if (!can(ctx.me.role, "invite.revoke")) return fail("forbidden", "You cannot revoke invitations.")
  if (!(await store.revokeInvite(orgId, inviteId))) return fail("not_found", "Invitation not found.")
  await store.audit({ orgId, actorUserId: actor.userId, action: "invite.revoked" })
  return { ok: true }
}

export async function removeMember(store: OrgStore, actor: Actor, orgId: string, targetUserId: string): Promise<Outcome<object>> {
  const ctx = await load(store, orgId, actor)
  if (!ctx) return fail("not_found", "Organisation not found.")
  const target = await store.getMember(orgId, targetUserId)
  if (!target) return fail("not_found", "Member not found.")
  if (target.userId === actor.userId) return fail("forbidden", "Use 'leave organisation' to remove yourself.")
  if (!can(ctx.me.role, "member.remove") || !canManageMember(ctx.me.role, target.role)) return fail("forbidden", "You cannot remove this member.")
  await store.removeMember(orgId, targetUserId)
  await store.audit({ orgId, actorUserId: actor.userId, action: "member.removed", detail: { targetUserId } })
  return { ok: true }
}

export async function leaveOrganisation(store: OrgStore, actor: Actor, orgId: string): Promise<Outcome<object>> {
  const ctx = await load(store, orgId, actor)
  if (!ctx) return fail("not_found", "Organisation not found.")
  if (ctx.me.role === "owner") return fail("forbidden", "The owner cannot leave. Contact Clinexia support to transfer ownership.")
  await store.removeMember(orgId, actor.userId)
  await store.audit({ orgId, actorUserId: actor.userId, action: "member.left" })
  return { ok: true }
}

export async function setMemberSpecialties(
  store: OrgStore,
  actor: Actor,
  orgId: string,
  targetUserId: string,
  input: { specialties?: unknown; allSpecialties?: boolean },
): Promise<Outcome<object>> {
  const ctx = await load(store, orgId, actor)
  if (!ctx) return fail("not_found", "Organisation not found.")
  const target = await store.getMember(orgId, targetUserId)
  if (!target) return fail("not_found", "Member not found.")
  if (!can(ctx.me.role, "member.setSpecialties") || !canManageMember(ctx.me.role, target.role)) return fail("forbidden", "You cannot change this member's access.")
  const allowed = assignableSpecialties(ctx.org.plan)
  const all = input.allSpecialties === true
  let specialties: Specialty[] = []
  if (!all) {
    const cleaned = cleanSpecialties(input.specialties ?? [])
    if (!cleaned) return fail("invalid", "Unknown specialty.")
    if (cleaned.some((x) => !allowed.includes(x))) return fail("forbidden", "That specialty is not part of the organisation's plan.")
    specialties = cleaned
  }
  await store.updateMember(orgId, targetUserId, { allSpecialties: all, specialties })
  await store.audit({ orgId, actorUserId: actor.userId, action: "member.access_changed", detail: { targetUserId, all, specialties } })
  return { ok: true }
}

export async function acceptInvitation(store: OrgStore, actor: Actor & { email: string }, token: string): Promise<Outcome<{ orgId: string }>> {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return fail("invalid", "This invitation link is not valid.")
  const r = await store.acceptInvite({ tokenHash: hashInviteToken(token), userId: actor.userId, email: normalizeEmail(actor.email) })
  if (r.ok) {
    await store.audit({ orgId: r.orgId, actorUserId: actor.userId, action: "invite.accepted" })
    return { ok: true, orgId: r.orgId }
  }
  const message: Record<string, string> = {
    invalid: "This invitation link is not valid.",
    expired: "This invitation has expired. Ask your administrator to send a new one.",
    revoked: "This invitation was withdrawn.",
    used: "This invitation has already been used.",
    wrong_email: "This invitation was sent to a different email address. Sign in with the invited address.",
    already_member: "You are already a member of this organisation.",
  }
  return fail(r.reason === "already_member" ? "conflict" : "invalid", message[r.reason])
}
