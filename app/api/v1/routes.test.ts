import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { corsPath } from "@/lib/billing/cors"

/**
 * The real route modules, called the way the platform calls them. Without a key every authenticated route answers 401 before
 * touching the database; health and the OpenAPI document are open.
 */
const R = (p: string) => resolve(process.cwd(), "app/api/v1", p)
const req = (path: string, method = "GET") => new Request(`https://x.test/api/v1${path}`, { method })

describe("/api/v1 routes", () => {
  it("every route file exists", () => {
    for (const p of ["calculators/route.ts", "calculators/[id]/route.ts", "calculators/[id]/calculate/route.ts", "calculators/batch/route.ts", "conversions/route.ts", "conversions/convert/route.ts", "health/route.ts", "openapi.json/route.ts"]) {
      expect(existsSync(R(p)), p).toBe(true)
    }
  })

  it("authenticated routes answer 401 without a key", async () => {
    const list = await import("./calculators/route")
    const one = await import("./calculators/[id]/route")
    const calc = await import("./calculators/[id]/calculate/route")
    const batch = await import("./calculators/batch/route")
    const conv = await import("./conversions/route")
    const convert = await import("./conversions/convert/route")
    const ctx = { params: Promise.resolve({ id: "bmi" }) }
    expect((await list.GET(req("/calculators"))).status).toBe(401)
    expect((await one.GET(req("/calculators/bmi"), ctx)).status).toBe(401)
    expect((await calc.POST(req("/calculators/bmi/calculate", "POST"), ctx)).status).toBe(401)
    expect((await batch.POST(req("/calculators/batch", "POST"))).status).toBe(401)
    expect((await conv.GET(req("/conversions"))).status).toBe(401)
    expect((await convert.POST(req("/conversions/convert", "POST"))).status).toBe(401)
  })

  it("health and the OpenAPI document are open", async () => {
    const health = await import("./health/route")
    const openapi = await import("./openapi.json/route")
    const h = await health.GET()
    expect(h.status).toBe(200)
    expect((await h.json()).status).toBe("ok")
    const o = await openapi.GET()
    expect(o.status).toBe(200)
    expect((await o.json()).openapi).toBe("3.1.0")
  })

  it("exports no OPTIONS handler and no CORS: browser access stays closed (server-to-server only)", async () => {
    for (const mod of [await import("./calculators/route"), await import("./calculators/batch/route"), await import("./conversions/convert/route"), await import("./health/route")]) {
      expect("OPTIONS" in mod).toBe(false)
    }
    expect(corsPath("/api/v1/calculators")).toBeFalsy()
    expect(corsPath("/api/v1/calculators/bmi/calculate")).toBeFalsy()
    expect(corsPath("/api/v1/health")).toBeFalsy()
  })
})
