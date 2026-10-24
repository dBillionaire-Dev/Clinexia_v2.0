import { describe, expect, it } from "vitest"
import { buildFrameAncestors, createOriginResolver, isAllowedOrigin, normaliseOrigin, parseOriginList } from "./embed-origins"

describe("normaliseOrigin", () => {
  it("returns bare https origins", () => {
    expect(normaliseOrigin("https://emr.example.org")).toBe("https://emr.example.org")
    expect(normaliseOrigin("https://emr.example.org/")).toBe("https://emr.example.org")
    expect(normaliseOrigin(" https://EMR.example.org:8443 ")).toBe("https://emr.example.org:8443")
  })
  it("rejects wildcards, null, paths, credentials, injection attempts and non-http schemes", () => {
    for (const bad of ["*", "null", "", "https://a.org/path", "https://a.org?x=1", "https://u:p@a.org", "https://a.org; script-src *", "https://a.org https://b.org", "javascript:alert(1)", "ftp://a.org", "capacitor://localhost", "not a url"]) {
      expect(normaliseOrigin(bad)).toBeNull()
    }
  })
  it("allows plain http only for localhost", () => {
    expect(normaliseOrigin("http://localhost:3000")).toBe("http://localhost:3000")
    expect(normaliseOrigin("http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173")
    expect(normaliseOrigin("http://emr.example.org")).toBeNull()
  })
})

describe("parseOriginList / isAllowedOrigin / buildFrameAncestors", () => {
  it("parses, dedupes and drops invalid entries", () => {
    expect(parseOriginList("https://a.org, https://b.org/,https://a.org,*,bad")).toEqual(["https://a.org", "https://b.org"])
    expect(parseOriginList(undefined)).toEqual([])
  })
  it("is framable by 'self' only when nothing is configured", () => {
    expect(buildFrameAncestors([])).toBe("frame-ancestors 'self'")
  })
  it("lists allowlisted origins after 'self' and never emits unsafe tokens", () => {
    expect(buildFrameAncestors(["https://a.org", "https://b.org"])).toBe("frame-ancestors 'self' https://a.org https://b.org")
    expect(buildFrameAncestors(["*", "https://a.org; default-src *", "https://ok.org"])).toBe("frame-ancestors 'self' https://ok.org")
  })
  it("matches origins exactly", () => {
    const allowed = ["https://a.org"]
    expect(isAllowedOrigin("https://a.org", allowed)).toBe(true)
    expect(isAllowedOrigin("https://a.org/", allowed)).toBe(true)
    expect(isAllowedOrigin("https://evil.a.org", allowed)).toBe(false)
    expect(isAllowedOrigin("https://a.org.evil.com", allowed)).toBe(false)
    expect(isAllowedOrigin(null, allowed)).toBe(false)
  })
})

describe("createOriginResolver", () => {
  it("merges env and database origins", async () => {
    const r = createOriginResolver({ env: { EMBED_ALLOWED_ORIGINS: "https://env.org" }, fetchPartners: async () => ["https://db.org", "https://env.org"] })
    expect(await r.get()).toEqual(["https://env.org", "https://db.org"])
  })
  it("caches for the ttl, then refreshes", async () => {
    let t = 0
    let calls = 0
    const r = createOriginResolver({ env: {}, ttlMs: 1000, now: () => t, fetchPartners: async () => { calls++; return [`https://p${calls}.org`] } })
    expect(await r.get()).toEqual(["https://p1.org"])
    t = 500
    expect(await r.get()).toEqual(["https://p1.org"])
    expect(calls).toBe(1)
    t = 1500
    expect(await r.get()).toEqual(["https://p2.org"])
  })
  it("falls back to the env list (never to allow-all) when the database read fails", async () => {
    const r = createOriginResolver({ env: { EMBED_ALLOWED_ORIGINS: "https://env.org" }, fetchPartners: async () => { throw new Error("db down") } })
    expect(await r.get()).toEqual(["https://env.org"])
  })
  it("is empty when nothing is configured", async () => {
    const r = createOriginResolver({ env: {}, fetchPartners: async () => [] })
    expect(await r.get()).toEqual([])
  })
  it("does not call Supabase when its env vars are missing", async () => {
    const r = createOriginResolver({ env: {} })
    expect(await r.get()).toEqual([])
  })
})
