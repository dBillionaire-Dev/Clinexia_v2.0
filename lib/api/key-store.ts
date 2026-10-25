import { db, eq, uuid, type Row } from "@/lib/billing/db"

/** One API key as stored. The key itself is never stored: only its hash. */
export interface ApiKeyRecord {
  id: string
  orgId: string
  name: string
  keyPrefix: string
  keyHash: string
  scopes: string[]
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export interface NewApiKey {
  orgId: string
  name: string
  keyPrefix: string
  keyHash: string
  scopes: string[]
  createdBy: string
}

export interface ApiKeyStore {
  findByHash(hash: string): Promise<ApiKeyRecord | null>
  create(input: NewApiKey): Promise<ApiKeyRecord>
  /** Active and revoked keys of one organisation, newest first. Never returns hashes' keys: there is no key to return. */
  listByOrg(orgId: string): Promise<ApiKeyRecord[]>
  /** Revokes a key of THIS organisation. False when it does not exist, belongs to another organisation, or is already revoked. */
  revoke(orgId: string, keyId: string): Promise<boolean>
  /** Counts only: one call, and whether it ended in an error. Never inputs, results or anything about the patient. */
  recordUsage(keyId: string, isError: boolean): Promise<void>
}

const toRecord = (r: Row): ApiKeyRecord => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  keyPrefix: r.key_prefix,
  keyHash: r.key_hash,
  scopes: Array.isArray(r.scopes) ? r.scopes : [],
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at ?? null,
  revokedAt: r.revoked_at ?? null,
})

const HEX64 = /^[0-9a-f]{64}$/

/** Supabase-backed store (service role). Tables: supabase/api-keys.sql. */
export const supabaseKeyStore: ApiKeyStore = {
  async findByHash(hash) {
    if (!HEX64.test(hash)) return null
    const rows = await db.select("api_keys", `key_hash=${eq(hash)}&select=*&limit=1`)
    return rows[0] ? toRecord(rows[0]) : null
  },
  async create(input) {
    const row = await db.insert("api_keys", {
      org_id: uuid(input.orgId),
      name: input.name,
      key_prefix: input.keyPrefix,
      key_hash: input.keyHash,
      scopes: input.scopes,
      created_by: uuid(input.createdBy),
    })
    if (!row) throw new Error("API key was not created.")
    return toRecord(row)
  },
  async listByOrg(orgId) {
    const rows = await db.select("api_keys", `org_id=${eq(uuid(orgId))}&select=*&order=created_at.desc`)
    return rows.map(toRecord)
  },
  async revoke(orgId, keyId) {
    const rows = await db.update("api_keys", `id=${eq(uuid(keyId))}&org_id=${eq(uuid(orgId))}&revoked_at=is.null`, { revoked_at: new Date().toISOString() })
    return rows.length > 0
  },
  async recordUsage(keyId, isError) {
    await db.rpc("api_record_usage", { p_key_id: uuid(keyId), p_error: isError })
  },
}

/** In-memory store for tests and local experiments. */
export function createMemoryKeyStore() {
  const keys: ApiKeyRecord[] = []
  const usage = new Map<string, { calls: number; errors: number }>()
  let seq = 0
  const store: ApiKeyStore & { keys: ApiKeyRecord[]; usage: typeof usage } = {
    keys,
    usage,
    async findByHash(hash) {
      return keys.find((k) => k.keyHash === hash) ?? null
    },
    async create(input) {
      const rec: ApiKeyRecord = {
        id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
        orgId: input.orgId, name: input.name, keyPrefix: input.keyPrefix, keyHash: input.keyHash, scopes: [...input.scopes],
        createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null,
      }
      keys.unshift(rec)
      return rec
    },
    async listByOrg(orgId) {
      return keys.filter((k) => k.orgId === orgId)
    },
    async revoke(orgId, keyId) {
      const k = keys.find((x) => x.id === keyId && x.orgId === orgId && !x.revokedAt)
      if (!k) return false
      k.revokedAt = new Date().toISOString()
      return true
    },
    async recordUsage(keyId, isError) {
      const u = usage.get(keyId) ?? { calls: 0, errors: 0 }
      u.calls++
      if (isError) u.errors++
      usage.set(keyId, u)
      const k = keys.find((x) => x.id === keyId)
      if (k) k.lastUsedAt = new Date().toISOString()
    },
  }
  return store
}
