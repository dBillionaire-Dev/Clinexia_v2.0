import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

/**
 * API key helpers (server only). A key looks like cx_live_<43 random url-safe characters>. It is shown to the organisation
 * administrator exactly once, at creation. Only its SHA-256 hash (and a short display prefix) is stored.
 */
export const KEY_PREFIX = "cx_live_"
const KEY_BODY = /^[A-Za-z0-9_-]{32,64}$/

export interface GeneratedKey {
  /** The full key. Show it once; it cannot be recovered afterwards. */
  key: string
  /** First characters of the key, safe to display so people can tell keys apart. */
  prefix: string
  hash: string
}

export const hashApiKey = (key: string): string => createHash("sha256").update(key, "utf8").digest("hex")

export function generateApiKey(): GeneratedKey {
  const key = KEY_PREFIX + randomBytes(32).toString("base64url")
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 4), hash: hashApiKey(key) }
}

export const looksLikeApiKey = (v: unknown): v is string => typeof v === "string" && v.startsWith(KEY_PREFIX) && KEY_BODY.test(v.slice(KEY_PREFIX.length))

/** Constant-time check that `key` hashes to `storedHash`. */
export function verifyApiKey(key: string, storedHash: string): boolean {
  if (!looksLikeApiKey(key) || !/^[0-9a-f]{64}$/.test(storedHash)) return false
  const a = Buffer.from(hashApiKey(key), "hex")
  const b = Buffer.from(storedHash, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Extracts the key from "Authorization: Bearer cx_live_...". Anything else (cookies, query strings, other schemes) is not accepted. */
export function parseBearerKey(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec((header ?? "").trim())
  return m && looksLikeApiKey(m[1]) ? m[1] : null
}
