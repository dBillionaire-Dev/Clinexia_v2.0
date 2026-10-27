// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// proxy.ts: /smart responses are framable by the allowlist, exactly like /embed; nothing else is.
const saved = { origins: process.env.EMBED_ALLOWED_ORIGINS, sbUrl: process.env.SUPABASE_URL, sbKey: process.env.SUPABASE_SERVICE_ROLE_KEY }
let proxy: (r: NextRequest) => Response | Promise<Response>
const req = (path: string) => new NextRequest(`https://app.example.test${path}`, { headers: { host: "app.example.test" } })

beforeAll(async () => {
  process.env.EMBED_ALLOWED_ORIGINS = "https://ehr.example.org"
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

describe("proxy on /smart", () => {
  it("allows the allowlisted origins to frame the launcher and the callback", async () => {
    for (const path of ["/smart/launch?iss=x&launch=y", "/smart/callback?code=a&state=b"]) {
      const res = await proxy(req(path))
      expect(res.headers.get("content-security-policy"), path).toBe("frame-ancestors 'self' https://ehr.example.org")
      expect(res.headers.get("x-frame-options"), path).toBeNull()
    }
  })
  it("leaves look-alike routes alone", async () => {
    for (const path of ["/smarter", "/smart-home", "/calculators/smart"]) expect((await proxy(req(path))).headers.get("content-security-policy"), path).toBeNull()
  })
})
