import { describe, expect, it } from "vitest"
import { MAX_ACTIVE_KEYS_PER_ORG, canManageApiKeys, createApiKey, listApiKeys, revokeApiKey, type KeyAdminDeps } from "./keys-admin"
import { createMemoryKeyStore } from "./key-store"
import { hashApiKey, verifyApiKey } from "./keys"
import { can } from "@/lib/billing/roles"

const ORG = "11111111-1111-4111-8111-111111111111"
const OTHER_ORG = "22222222-2222-4222-8222-222222222222"
type Role = "owner" | "admin" | "staff"

function setup(members: Record<string, Role | undefined>) {
  const keys = createMemoryKeyStore()
  const audits: Array<Record<string, unknown>> = []
  const deps: KeyAdminDeps = {
    keys,
    orgs: {
      getMember: async (orgId, userId) => {
        const role = orgId === ORG ? members[userId] : undefined
        return role ? ({ userId, email: "", fullName: "", role, allSpecialties: true, specialties: [], joinedAt: "" } as never) : null
      },
      audit: async (e) => { audits.push(e as never) },
    },
  }
  return { keys, deps, audits }
}

describe("who may manage API keys", () => {
  it("owners and admins only, matching the roles that can invite members", () => {
    expect(canManageApiKeys("owner")).toBe(true)
    expect(canManageApiKeys("admin")).toBe(true)
    expect(canManageApiKeys("staff")).toBe(false)
    for (const role of ["owner", "admin", "staff"] as const) expect(canManageApiKeys(role)).toBe(can(role, "member.invite"))
  })

  it("staff are forbidden; non-members get not_found (organisation ids cannot be probed)", async () => {
    const { deps } = setup({ staff1: "staff", boss: "owner" })
    const staff = await createApiKey(deps, { userId: "staff1" }, ORG, { name: "x" })
    expect(staff).toEqual({ ok: false, code: "forbidden", message: "Only organisation owners and admins can manage API keys." })
    expect((await listApiKeys(deps, { userId: "staff1" }, ORG)).ok).toBe(false)
    expect(await createApiKey(deps, { userId: "stranger" }, ORG, { name: "x" })).toMatchObject({ ok: false, code: "not_found" })
    expect(await createApiKey(deps, { userId: "boss" }, OTHER_ORG, { name: "x" })).toMatchObject({ ok: false, code: "not_found" })
  })
})

describe("createApiKey", () => {
  it("an admin gets a key with the default scopes only; the key verifies against the stored hash", async () => {
    const { deps, keys } = setup({ adm: "admin" })
    const r = await createApiKey(deps, { userId: "adm" }, ORG, { name: "  Hospital   EMR " })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.key.startsWith("cx_live_")).toBe(true)
    expect(r.record.name).toBe("Hospital EMR")
    expect(r.record.scopes).toEqual(["read:catalog", "calculate:general", "convert"])
    expect(keys.keys[0].keyHash).toBe(hashApiKey(r.key))
    expect(verifyApiKey(r.key, keys.keys[0].keyHash)).toBe(true)
    expect(JSON.stringify(keys.keys)).not.toContain(r.key) // only the hash is stored
  })

  it("only the owner can grant dosing, and only explicitly", async () => {
    const { deps } = setup({ adm: "admin", boss: "owner" })
    expect(await createApiKey(deps, { userId: "adm" }, ORG, { name: "k", allowDosing: true })).toMatchObject({ ok: false, code: "forbidden" })
    const none = await createApiKey(deps, { userId: "boss" }, ORG, { name: "k" })
    expect(none.ok && none.record.scopes.includes("calculate:dosing")).toBe(false)
    const withDosing = await createApiKey(deps, { userId: "boss" }, ORG, { name: "k2", allowDosing: true })
    expect(withDosing.ok && withDosing.record.scopes.includes("calculate:dosing")).toBe(true)
    const truthy = await createApiKey(deps, { userId: "boss" }, ORG, { name: "k3", allowDosing: "yes" })
    expect(truthy.ok && truthy.record.scopes.includes("calculate:dosing")).toBe(false)
  })

  it("validates the name", async () => {
    const { deps } = setup({ boss: "owner" })
    for (const bad of ["", "   ", "x".repeat(81), "bad\u0007name", 42, null, undefined]) {
      expect(await createApiKey(deps, { userId: "boss" }, ORG, { name: bad }), String(bad)).toMatchObject({ ok: false, code: "invalid" })
    }
  })

  it("caps active keys per organisation; revoking frees a slot", async () => {
    const { deps } = setup({ boss: "owner" })
    let first = ""
    for (let i = 0; i < MAX_ACTIVE_KEYS_PER_ORG; i++) {
      const r = await createApiKey(deps, { userId: "boss" }, ORG, { name: `k${i}` })
      expect(r.ok).toBe(true)
      if (r.ok && i === 0) first = r.record.id
    }
    expect(await createApiKey(deps, { userId: "boss" }, ORG, { name: "one too many" })).toMatchObject({ ok: false, code: "conflict" })
    expect((await revokeApiKey(deps, { userId: "boss" }, ORG, first)).ok).toBe(true)
    expect((await createApiKey(deps, { userId: "boss" }, ORG, { name: "fits now" })).ok).toBe(true)
  })

  it("audits without any key material", async () => {
    const { deps, audits } = setup({ boss: "owner" })
    const r = await createApiKey(deps, { userId: "boss" }, ORG, { name: "k" })
    expect(audits.length).toBe(1)
    expect(audits[0].action).toBe("apikey.created")
    if (r.ok) expect(JSON.stringify(audits)).not.toContain(r.key)
  })
})

describe("listApiKeys and revokeApiKey", () => {
  it("lists keys without hashes or secrets", async () => {
    const { deps } = setup({ boss: "owner" })
    await createApiKey(deps, { userId: "boss" }, ORG, { name: "k" })
    const r = await listApiKeys(deps, { userId: "boss" }, ORG)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(Object.keys(r.keys[0]).sort()).toEqual(["createdAt", "id", "keyPrefix", "lastUsedAt", "name", "revokedAt", "scopes"])
  })

  it("revokes a key of the organisation, but never another organisation's key", async () => {
    const { deps, keys } = setup({ boss: "owner" })
    const mine = await createApiKey(deps, { userId: "boss" }, ORG, { name: "k" })
    const foreign = await keys.create({ orgId: OTHER_ORG, name: "other", keyPrefix: "cx_live_abcd", keyHash: "a".repeat(64), scopes: [], createdBy: "u" })
    expect(await revokeApiKey(deps, { userId: "boss" }, ORG, foreign.id)).toMatchObject({ ok: false, code: "not_found" })
    expect(foreign.revokedAt).toBeNull()
    if (mine.ok) {
      expect((await revokeApiKey(deps, { userId: "boss" }, ORG, mine.record.id)).ok).toBe(true)
      expect(await revokeApiKey(deps, { userId: "boss" }, ORG, mine.record.id)).toMatchObject({ ok: false, code: "not_found" }) // already revoked
    }
  })

  it("staff cannot revoke", async () => {
    const { deps, keys } = setup({ boss: "owner", st: "staff" })
    const k = await createApiKey(deps, { userId: "boss" }, ORG, { name: "k" })
    if (k.ok) expect(await revokeApiKey(deps, { userId: "st" }, ORG, k.record.id)).toMatchObject({ ok: false, code: "forbidden" })
    expect(keys.keys[0].revokedAt).toBeNull()
  })
})
