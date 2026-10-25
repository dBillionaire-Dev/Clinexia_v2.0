// @vitest-environment node
import { describe, expect, it } from "vitest"
import nextConfig from "../../next.config.mjs"
import { applyEmbedFrameHeaders, isEmbedPath } from "./embed-headers"

describe("isEmbedPath", () => {
  it("matches /embed and below, nothing else", () => {
    expect(isEmbedPath("/embed")).toBe(true)
    expect(isEmbedPath("/embed/renal/creatinine-clearance")).toBe(true)
    expect(isEmbedPath("/embedded")).toBe(false)
    expect(isEmbedPath("/calculators/embed")).toBe(false)
    expect(isEmbedPath("/api/embed")).toBe(false)
  })
})

describe("applyEmbedFrameHeaders", () => {
  it("drops X-Frame-Options and sets frame-ancestors from the allowlist", () => {
    const h = new Headers({ "X-Frame-Options": "SAMEORIGIN" })
    applyEmbedFrameHeaders(h, ["https://emr.example.org"])
    expect(h.get("X-Frame-Options")).toBeNull()
    expect(h.get("Content-Security-Policy")).toBe("frame-ancestors 'self' https://emr.example.org")
  })
  it("is 'self' only with an empty allowlist", () => {
    const h = new Headers()
    applyEmbedFrameHeaders(h, [])
    expect(h.get("Content-Security-Policy")).toBe("frame-ancestors 'self'")
  })
})

describe("next.config.mjs headers: /embed vs everything else", () => {
  type Rule = { source: string; headers: { key: string; value: string }[] }
  const frameKeys = ["x-frame-options", "content-security-policy"]
  const loadRules = async () => (await nextConfig.headers!()) as unknown as Rule[]
  const sourceMatches = (source: string, path: string) => new RegExp(`^${source.replace(/:path\*/g, ".*")}$`).test(path)

  it("keeps the frame headers on ordinary routes and removes them from /embed", async () => {
    const rules = await loadRules()
    const forPath = (path: string) => rules.filter((r) => sourceMatches(r.source, path))
    const frameHeadersFor = (path: string) =>
      forPath(path).flatMap((r) => r.headers).filter((h) => frameKeys.includes(h.key.toLowerCase()))

    for (const path of ["/", "/calculators/renal/egfr-ckd-epi", "/api/health", "/embedded", "/account"]) {
      expect(frameHeadersFor(path).length, path).toBeGreaterThan(0)
    }
    for (const path of ["/embed", "/embed/renal/creatinine-clearance"]) {
      expect(frameHeadersFor(path), path).toEqual([])
    }
  })

  it("still applies the non-framing security headers to /embed", async () => {
    const rules = await loadRules()
    const keys = rules
      .filter((r) => sourceMatches(r.source, "/embed/renal/creatinine-clearance"))
      .flatMap((r) => r.headers)
      .map((h) => h.key)
    expect(keys).toEqual(expect.arrayContaining(["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]))
  })
})
