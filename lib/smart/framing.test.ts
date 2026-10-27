import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import nextConfig from "../../next.config.mjs"
import { isFramablePath } from "@/lib/integration/embed-headers"

/**
 * An EHR may show the SMART launcher inside an iframe, so /smart is framable by the same allowlist as /embed (EMBED_ALLOWED_ORIGINS
 * plus the embed_partners table). Everything else keeps its frame protection.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8")

describe("which paths may be framed", () => {
  it("/embed and /smart, nothing that merely looks like them", () => {
    for (const p of ["/embed", "/embed/renal/x", "/smart", "/smart/launch", "/smart/callback"]) expect(isFramablePath(p), p).toBe(true)
    for (const p of ["/", "/embedded", "/smarter", "/smart-home", "/calculators/smart", "/api/smart", "/account"]) expect(isFramablePath(p), p).toBe(false)
  })
})

describe("next.config.mjs headers for /smart", () => {
  type Rule = { source: string; headers: { key: string }[] }
  const matches = (source: string, path: string) => new RegExp(`^${source.replace(/:path\*/g, ".*")}$`).test(path)
  const frameKeys = ["x-frame-options", "content-security-policy"]

  it("has no frame header of its own on /smart (the proxy sets frame-ancestors from the allowlist), but all other security headers", async () => {
    const rules = (await nextConfig.headers!()) as unknown as Rule[]
    for (const path of ["/smart/launch", "/smart/callback"]) {
      const headers = rules.filter((r) => matches(r.source, path)).flatMap((r) => r.headers).map((h) => h.key)
      expect(headers.filter((k) => frameKeys.includes(k.toLowerCase())), path).toEqual([])
      expect(headers).toEqual(expect.arrayContaining(["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]))
    }
  })
  it("every other route, including look-alikes, keeps its frame protection", async () => {
    const rules = (await nextConfig.headers!()) as unknown as Rule[]
    for (const path of ["/", "/calculators/renal/egfr-ckd-epi", "/smarter", "/smart-home", "/embedded", "/account"]) {
      const headers = rules.filter((r) => matches(r.source, path)).flatMap((r) => r.headers).map((h) => h.key.toLowerCase())
      expect(headers.some((k) => frameKeys.includes(k)), path).toBe(true)
    }
  })
})

describe("the rest of the framing wiring", () => {
  it("the proxy and the site chrome use the shared rule", () => {
    expect(read("proxy.ts")).toContain("isFramablePath(request.nextUrl.pathname)")
    expect(read("components/site-chrome.tsx")).toContain("isFramablePath")
  })
  it("the service worker never caches /smart (the callback URL carries a one-time authorisation code)", () => {
    expect(read("public/service-worker.js")).toContain('pathname.startsWith("/smart/")')
  })
})
