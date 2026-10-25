import { describe, expect, it } from "vitest"
import { KEY_PREFIX, generateApiKey, hashApiKey, looksLikeApiKey, parseBearerKey, verifyApiKey } from "./keys"

describe("generateApiKey", () => {
  it("makes cx_live_ keys with a url-safe body, a display prefix and a sha-256 hash", () => {
    const g = generateApiKey()
    expect(g.key.startsWith("cx_live_")).toBe(true)
    expect(/^cx_live_[A-Za-z0-9_-]{43}$/.test(g.key)).toBe(true)
    expect(g.prefix).toBe(g.key.slice(0, KEY_PREFIX.length + 4))
    expect(g.hash).toBe(hashApiKey(g.key))
    expect(/^[0-9a-f]{64}$/.test(g.hash)).toBe(true)
  })
  it("never repeats and the hash does not contain the key", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateApiKey().key))
    expect(keys.size).toBe(200)
    const g = generateApiKey()
    expect(g.hash.includes(g.key.slice(KEY_PREFIX.length, KEY_PREFIX.length + 12))).toBe(false)
  })
})

describe("verifyApiKey (constant-time hash compare)", () => {
  it("accepts the right key and rejects every other", () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(verifyApiKey(a.key, a.hash)).toBe(true)
    expect(verifyApiKey(b.key, a.hash)).toBe(false)
    expect(verifyApiKey(a.key + "x", a.hash)).toBe(false)
  })
  it("rejects malformed keys and malformed stored hashes instead of throwing", () => {
    const a = generateApiKey()
    expect(verifyApiKey("nope", a.hash)).toBe(false)
    expect(verifyApiKey(a.key, "zz")).toBe(false)
    expect(verifyApiKey(a.key, a.hash.toUpperCase())).toBe(false)
    expect(verifyApiKey(a.key, "")).toBe(false)
  })
})

describe("parseBearerKey", () => {
  const { key } = generateApiKey()
  it("reads Authorization: Bearer cx_live_...", () => {
    expect(parseBearerKey(`Bearer ${key}`)).toBe(key)
    expect(parseBearerKey(`bearer   ${key}  `)).toBe(key)
  })
  it("accepts nothing else", () => {
    for (const bad of [null, undefined, "", key, `Basic ${key}`, `Token ${key}`, "Bearer ", "Bearer abc", `Bearer ${key} extra`, `Bearer cx_test_${key.slice(8)}`, `Bearer ${key.slice(0, 20)}`]) {
      expect(parseBearerKey(bad as string | null | undefined), String(bad)).toBeNull()
    }
  })
  it("looksLikeApiKey checks the shape only", () => {
    expect(looksLikeApiKey(key)).toBe(true)
    expect(looksLikeApiKey("cx_live_short")).toBe(false)
    expect(looksLikeApiKey(42)).toBe(false)
  })
})
