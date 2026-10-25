import type { Failure, OrgStore } from "@/lib/billing/org-actions"
import type { OrgRole } from "@/lib/billing/roles"
import { generateApiKey } from "./keys"
import type { ApiKeyRecord, ApiKeyStore } from "./key-store"
import { DEFAULT_SCOPES, cleanScopes, type ApiScope } from "./scopes"

/**
 * Organisation-side API key management. Same safety pattern as lib/billing/org-actions: the ACTOR'S OWN membership is loaded
 * first, and without one the answer is "not_found" so organisation ids cannot be probed.
 *
 *  - Only owners and admins may create, list or revoke keys (staff may not).
 *  - Keys get the default scopes (no dosing). Only the OWNER may add calculate:dosing, and only explicitly.
 *  - The full key is returned once, by createApiKey, and can never be read again.
 */
export const MAX_ACTIVE_KEYS_PER_ORG = 10

/** Owners and admins (the same people who can invite members). Staff cannot. */
export const canManageApiKeys = (role: OrgRole): boolean => role === "owner" || role === "admin"

const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message })

export interface PublicKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}
const toPublic = (k: ApiKeyRecord): PublicKey => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, scopes: k.scopes, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, revokedAt: k.revokedAt })

export interface KeyAdminDeps {
  orgs: Pick<OrgStore, "getMember" | "audit">
  keys: ApiKeyStore
}
export interface Actor {
  userId: string
}

async function authorise(deps: KeyAdminDeps, actor: Actor, orgId: string): Promise<{ role: OrgRole } | Failure> {
  const member = await deps.orgs.getMember(orgId, actor.userId)
  if (!member) return fail("not_found", "Organisation not found.")
  if (!canManageApiKeys(member.role)) return fail("forbidden", "Only organisation owners and admins can manage API keys.")
  return { role: member.role }
}

const cleanName = (v: unknown): string | null => {
  if (typeof v !== "string") return null
  const t = v.trim().replace(/\s+/g, " ")
  return t.length >= 1 && t.length <= 80 && !/[\u0000-\u001f\u007f]/.test(t) ? t : null
}

export async function listApiKeys(deps: KeyAdminDeps, actor: Actor, orgId: string): Promise<({ ok: true; keys: PublicKey[] }) | Failure> {
  const a = await authorise(deps, actor, orgId)
  if ("ok" in a) return a
  return { ok: true, keys: (await deps.keys.listByOrg(orgId)).map(toPublic) }
}

export async function createApiKey(
  deps: KeyAdminDeps,
  actor: Actor,
  orgId: string,
  input: { name: unknown; allowDosing?: unknown },
): Promise<({ ok: true; key: string; record: PublicKey }) | Failure> {
  const a = await authorise(deps, actor, orgId)
  if ("ok" in a) return a
  const name = cleanName(input.name)
  if (!name) return fail("invalid", "Give the key a name of 1 to 80 characters.")
  const wantsDosing = input.allowDosing === true
  if (wantsDosing && a.role !== "owner") return fail("forbidden", "Only the organisation owner can grant access to dosing and oncology calculators.")

  const existing = await deps.keys.listByOrg(orgId)
  if (existing.filter((k) => !k.revokedAt).length >= MAX_ACTIVE_KEYS_PER_ORG) {
    return fail("conflict", `An organisation can have at most ${MAX_ACTIVE_KEYS_PER_ORG} active API keys. Revoke one first.`)
  }

  const scopes: ApiScope[] = cleanScopes([...DEFAULT_SCOPES, ...(wantsDosing ? ["calculate:dosing"] : [])])
  const generated = generateApiKey()
  const record = await deps.keys.create({ orgId, name, keyPrefix: generated.prefix, keyHash: generated.hash, scopes, createdBy: actor.userId })
  await deps.orgs.audit({ orgId, actorUserId: actor.userId, action: "apikey.created", detail: { keyId: record.id, scopes } }).catch(() => undefined)
  return { ok: true, key: generated.key, record: toPublic(record) }
}

export async function revokeApiKey(deps: KeyAdminDeps, actor: Actor, orgId: string, keyId: string): Promise<({ ok: true }) | Failure> {
  const a = await authorise(deps, actor, orgId)
  if ("ok" in a) return a
  const done = await deps.keys.revoke(orgId, keyId)
  if (!done) return fail("not_found", "API key not found.")
  await deps.orgs.audit({ orgId, actorUserId: actor.userId, action: "apikey.revoked", detail: { keyId } }).catch(() => undefined)
  return { ok: true }
}
