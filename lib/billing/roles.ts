// Who may do what inside an organisation. Used by the API; the dashboard only mirrors it for display.
import type { Specialty } from "./config"
import { SPECIALTIES } from "./config"
import type { PlanRecord } from "./entitlements"

export type OrgRole = "owner" | "admin" | "staff"
export type OrgAction = "org.view" | "org.update" | "org.billing" | "member.invite" | "member.remove" | "member.setSpecialties" | "member.setRole" | "invite.revoke" | "directory.manage"

const MATRIX: Record<OrgRole, ReadonlySet<OrgAction>> = {
  owner: new Set<OrgAction>(["org.view", "org.update", "org.billing", "member.invite", "member.remove", "member.setSpecialties", "member.setRole", "invite.revoke", "directory.manage"]),
  admin: new Set<OrgAction>(["org.view", "member.invite", "member.remove", "member.setSpecialties", "invite.revoke", "directory.manage"]),
  staff: new Set<OrgAction>([]),
}

export const can = (role: OrgRole, action: OrgAction) => MATRIX[role].has(action)

/** Admins manage staff only; the owner manages admins and staff; nobody manages the owner through the API. */
export function canManageMember(actor: OrgRole, target: OrgRole): boolean {
  if (target === "owner") return false
  if (actor === "owner") return true
  if (actor === "admin") return target === "staff"
  return false
}

export function invitableRoles(actor: OrgRole): OrgRole[] {
  return actor === "owner" ? ["admin", "staff"] : actor === "admin" ? ["staff"] : []
}

/** Specialties an organisation can hand out: everything its plan covers, and nothing else. */
export function assignableSpecialties(plan: PlanRecord | null): Specialty[] {
  if (!plan) return []
  return plan.plan === "all_access" ? [...SPECIALTIES] : plan.specialties
}
