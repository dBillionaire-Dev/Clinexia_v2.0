import { afterEach, describe, expect, it } from "vitest"
import { cdsAuthorised, cdsEnabled } from "@/lib/cds/gate"
import { CDS_SERVICE_ID } from "@/lib/cds/service"

const saved = { enabled: process.env.CDS_HOOKS_ENABLED, secret: process.env.CDS_HOOKS_SHARED_SECRET }
afterEach(() => {
  for (const [k, v] of [["CDS_HOOKS_ENABLED", saved.enabled], ["CDS_HOOKS_SHARED_SECRET", saved.secret]] as const) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

const prefetch = {
  patient: { resourceType: "Patient", birthDate: "1972-10-26", gender: "male" },
  creatinine: { resourceType: "Bundle", entry: [{ resource: { resourceType: "Observation", status: "final", code: { coding: [{ system: "http://loinc.org", code: "2160-0" }] }, effectiveDateTime: new Date().toISOString().slice(0, 10), valueQuantity: { value: 1.1, unit: "mg/dL", system: "http://unitsofmeasure.org", code: "mg/dL" } } }] },
}
const post = (body: unknown, headers: Record<string, string> = {}, raw?: string) =>
  new Request(`https://x.test/api/cds-services/${CDS_SERVICE_ID}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: raw ?? JSON.stringify(body) })
const ctx = (id = CDS_SERVICE_ID) => ({ params: Promise.resolve({ id }) })
const good = { hook: "patient-view", hookInstance: "x", context: { patientId: "p" }, prefetch }

describe("CDS Hooks is off by default", () => {
  it("both routes answer 404 unless CDS_HOOKS_ENABLED is exactly 'true'", async () => {
    const discovery = await import("./route")
    const service = await import("./[id]/route")
    for (const v of [undefined, "", "1", "TRUE", "yes", "false"]) {
      if (v === undefined) delete process.env.CDS_HOOKS_ENABLED
      else process.env.CDS_HOOKS_ENABLED = v
      expect(cdsEnabled(), String(v)).toBe(false)
      expect(discovery.GET().status, String(v)).toBe(404)
      expect((await service.POST(post(good), ctx())).status, String(v)).toBe(404)
    }
  })
})

describe("CDS Hooks when enabled", () => {
  it("serves discovery and answers a patient-view call with cards", async () => {
    process.env.CDS_HOOKS_ENABLED = "true"
    const discovery = await import("./route")
    const service = await import("./[id]/route")
    const d = discovery.GET()
    expect(d.status).toBe(200)
    expect(d.headers.get("cache-control")).toBe("no-store")
    expect((await d.json()).services[0].id).toBe(CDS_SERVICE_ID)
    const r = await service.POST(post(good), ctx())
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.cards.length).toBe(1) // eGFR only: no weight prefetched
  })

  it("unknown service id 404, other hook 400, bad JSON 400, oversized 413", async () => {
    process.env.CDS_HOOKS_ENABLED = "true"
    const service = await import("./[id]/route")
    expect((await service.POST(post(good), ctx("nope"))).status).toBe(404)
    expect((await service.POST(post({ ...good, hook: "order-select" }), ctx())).status).toBe(400)
    expect((await service.POST(post(null, {}, "{bad"), ctx())).status).toBe(400)
    expect((await service.POST(post(null, {}, JSON.stringify({ pad: "x".repeat(250_000) })), ctx())).status).toBe(413)
  })

  it("with a shared secret configured, calls without it are refused", async () => {
    process.env.CDS_HOOKS_ENABLED = "true"
    process.env.CDS_HOOKS_SHARED_SECRET = "s3cret-value"
    const service = await import("./[id]/route")
    expect((await service.POST(post(good), ctx())).status).toBe(401)
    expect((await service.POST(post(good, { authorization: "Bearer wrong" }), ctx())).status).toBe(401)
    expect((await service.POST(post(good, { authorization: "Bearer s3cret-value" }), ctx())).status).toBe(200)
    expect(cdsAuthorised(null, { CDS_HOOKS_SHARED_SECRET: "s" })).toBe(false)
    expect(cdsAuthorised(null, {})).toBe(true)
  })

  it("logs nothing and makes no network call, even for a request full of identifiers", async () => {
    process.env.CDS_HOOKS_ENABLED = "true"
    const service = await import("./[id]/route")
    const calls: string[] = []
    const levels = ["log", "info", "warn", "error", "debug", "trace"] as const
    const real = Object.fromEntries(levels.map((l) => [l, console[l]]))
    for (const l of levels) console[l] = (() => { calls.push(l) }) as never
    const realFetch = globalThis.fetch
    globalThis.fetch = (() => { calls.push("fetch"); throw new Error("no network") }) as never
    try {
      await service.POST(post({ ...good, context: { patientId: "MRN-SECRET", userId: "Practitioner/SECRET" }, prefetch: { ...prefetch, patient: { ...prefetch.patient, name: [{ family: "SECRET-NAME" }] } } }), ctx())
      await service.POST(post(null, {}, "{not json SECRET"), ctx())
    } finally {
      for (const l of levels) console[l] = real[l] as never
      globalThis.fetch = realFetch
    }
    expect(calls).toEqual([])
  })
})
