// Database side of the organisation directory (see org-directory.ts for the rules).
import { createConfirmedUser, deleteAuthUser } from "./admin-users"
import type { Market } from "./config"
import { db, isUuid, uuid } from "./db"
import type { AccountService, DirectoryStore } from "./org-directory"

const isDuplicate = (error: unknown) => /duplicate key|23505|already exists/i.test(error instanceof Error ? error.message : String(error))

export const directoryStore: DirectoryStore = {
  async listGroups(orgId) {
    const [groups, members] = await Promise.all([
      db.select("billing_org_groups", `select=id,name&org_id=eq.${uuid(orgId)}&order=name.asc`),
      db.select("billing_memberships", `select=group_id&org_id=eq.${uuid(orgId)}&group_id=not.is.null`),
    ])
    return groups.map((g) => ({ id: g.id as string, name: g.name as string, members: members.filter((m) => m.group_id === g.id).length }))
  },
  async createGroup(orgId, name) {
    try {
      const row = await db.insert("billing_org_groups", { org_id: uuid(orgId), name })
      return { ok: true as const, id: String(row!.id) }
    } catch (error) {
      if (isDuplicate(error)) return { ok: false as const, reason: "duplicate" as const }
      throw error
    }
  },
  async renameGroup(orgId, groupId, name) {
    if (!isUuid(groupId)) return "missing"
    try {
      return (await db.update("billing_org_groups", `id=eq.${groupId}&org_id=eq.${uuid(orgId)}`, { name })).length > 0 ? "ok" : "missing"
    } catch (error) {
      if (isDuplicate(error)) return "duplicate"
      throw error
    }
  },
  async deleteGroup(orgId, groupId) {
    if (!isUuid(groupId)) return false
    return (await db.remove("billing_org_groups", `id=eq.${groupId}&org_id=eq.${uuid(orgId)}`)).length > 0
  },
  async setMemberGroup(orgId, userId, groupId) {
    return (await db.update("billing_memberships", `org_id=eq.${uuid(orgId)}&user_id=eq.${uuid(userId)}`, { group_id: groupId })).length > 0
  },
  async setMemberDisabled(orgId, userId, disabled) {
    return (await db.update("billing_memberships", `org_id=eq.${uuid(orgId)}&user_id=eq.${uuid(userId)}`, { disabled })).length > 0
  },
  async provisionMember(i) {
    const r = await db.rpc<{ ok: boolean; reason?: string }>("billing_provision_member", {
      p_org: uuid(i.orgId), p_user: uuid(i.userId), p_role: i.role, p_all: i.allSpecialties, p_specs: i.specialties, p_group: i.groupId,
    })
    return r.ok ? { ok: true as const } : { ok: false as const, reason: r.reason === "already_member" ? ("already_member" as const) : ("no_capacity" as const) }
  },
}

/** Creates a confirmed account plus the profile the rest of Clinexia expects, the same shape as a person who signed up themselves. */
export const accountServiceFor = (market: Market): AccountService => ({
  async create(email, fullName) {
    const r = await createConfirmedUser(email, fullName)
    if (!r.ok) return r
    await db.insert("billing_profiles", { user_id: r.userId, full_name: fullName, account_type: "individual", market, source: "web" }, { ignoreDuplicates: true }).catch(() => undefined)
    return r
  },
  remove: (userId) => deleteAuthUser(userId),
})
