// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// proxy.ts: /embed responses get CSP frame-ancestors from the allowlist and lose X-Frame-Options; nothing else is touched.
const saved = { origins: process.env.EMBED_ALLOWED_ORIGINS, sbUrl: process.env.SUPABASE_URL, sbKey: process.env.SUPABASE_SERVICE_ROLE_KEY }
let proxy: (r: NextRequest) => Response | Promise<Response>

const req = (path: string) => new NextRequest(`https://app.example.test${path}`, { headers: { host: "app.example.test" } })

beforeAll(async () => {
  process.env.EMBED_ALLOWED_ORIGINS = "https://emr.example.org, https://lis.example.org/, *"
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  vi.resetModules()
  proxy = (await import("../../proxy")).proxy as unknown as typeof proxy
})
afterAll(() => {
  const restore = (k: string, v: string | undefined) => (v === undefined ? delete process.env[k] : (process.env[k] = v))
  restore("EMBED_ALLOWED_ORIGINS", saved.origins)
  restore("SUPABASE_URL", saved.sbUrl)
  restore("SUPABASE_SERVICE_ROLE_KEY", saved.sbKey)
})

describe("proxy on /embed", () => {
  it("sets frame-ancestors from the allowlist (invalid entries dropped) and no X-Frame-Options", async () => {
    const res = await proxy(req("/embed/renal/creatinine-clearance?age=54"))
    expect(res.headers.get("content-security-policy")).toBe("frame-ancestors 'self' https://emr.example.org https://lis.example.org")
    expect(res.headers.get("x-frame-options")).toBeNull()
  })

  it("leaves every other route without an embed policy", async () => {
    for (const path of ["/calculators/renal/creatinine-clearance", "/embedded", "/api/health", "/"]) {
      const res = await proxy(req(path))
      expect(res.headers.get("content-security-policy"), path).toBeNull()
    }
  })

  it("keeps non-embed responses synchronous (existing proxy tests rely on it)", () => {
    const res = proxy(req("/calculators"))
    expect(res instanceof Promise).toBe(false)
  })
})
