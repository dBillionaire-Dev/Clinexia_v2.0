import { describe, expect, it } from "vitest"
import { calculators, getCalculatorById } from "@/lib/calculators/registry"
import { FORMULA_VERSIONS } from "@/lib/calculators/versions"
import { generateApiKey } from "../keys"
import { createMemoryKeyStore } from "../key-store"
import { createRateLimiter } from "../rate-limit"
import { DEFAULT_SCOPES } from "../scopes"
import { MAX_BATCH, runApi, type ApiContext, type ApiDeps, type ApiResult } from "./kit"
import { batchHandler, calculateHandler, calculatorHandler, catalogHandler, conversionsHandler, convertHandler, healthResponse, openApiResponse } from "./handlers"

const ORG = "11111111-1111-4111-8111-111111111111"
const ALL = ["read:catalog", "calculate:general", "calculate:dosing", "convert"]

function setup(opts: { limit?: number } = {}) {
  const store = createMemoryKeyStore()
  const limiter = createRateLimiter({ limit: () => opts.limit ?? 1000 })
  const deps: ApiDeps = { store, limiter, buildId: "test-build" }
  const seed = async (scopes: string[] = [...DEFAULT_SCOPES]) => {
    const g = generateApiKey()
    await store.create({ orgId: ORG, name: "t", keyPrefix: g.prefix, keyHash: g.hash, scopes, createdBy: ORG })
    return g.key
  }
  return { store, deps, seed }
}

type Call = { key?: string | null; method?: string; body?: unknown; rawBody?: string; headers?: Record<string, string>; url?: string }
async function call(deps: ApiDeps, handler: (c: ApiContext) => Promise<ApiResult> | ApiResult, path: string, params: Record<string, string>, c: Call = {}) {
  const headers: Record<string, string> = { ...(c.headers ?? {}) }
  if (c.key) headers.authorization = `Bearer ${c.key}`
  if (c.body !== undefined || c.rawBody !== undefined) headers["content-type"] = "application/json"
  const request = new Request(c.url ?? `https://x.test/api/v1${path}`, {
    method: c.method ?? (c.body !== undefined || c.rawBody !== undefined ? "POST" : "GET"),
    headers,
    body: c.rawBody ?? (c.body !== undefined ? JSON.stringify(c.body) : undefined),
  })
  const res = await runApi(request, deps, handler, params)
  const json = await res.json()
  return { res, json, status: res.status }
}

const CRCL = { age: 54, weight: 70, sex: "male" }

describe("authentication", () => {
  it("401 without a key, with the standard headers", async () => {
    const { deps } = setup()
    const r = await call(deps, catalogHandler, "/calculators", {})
    expect(r.status).toBe(401)
    expect(r.json.error.code).toBe("invalid_api_key")
    expect(r.res.headers.get("www-authenticate")).toContain("Bearer")
    expect(r.res.headers.get("cache-control")).toBe("no-store")
    expect((r.res.headers.get("x-request-id") ?? "").startsWith("req_")).toBe(true)
    expect(r.json.requestId).toBe(r.res.headers.get("x-request-id"))
  })

  it("401 for unknown, malformed, and revoked keys", async () => {
    const { deps, seed, store } = setup()
    const good = await seed()
    expect((await call(deps, catalogHandler, "/calculators", {}, { key: generateApiKey().key })).status).toBe(401)
    expect((await call(deps, catalogHandler, "/calculators", {}, { key: "cx_live_short" })).status).toBe(401)
    expect((await call(deps, catalogHandler, "/calculators", {}, { key: good })).status).toBe(200)
    store.keys[0].revokedAt = new Date().toISOString()
    expect((await call(deps, catalogHandler, "/calculators", {}, { key: good })).status).toBe(401)
  })

  it("only the Authorization header counts: a cookie or a query string carrying a valid key is refused", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    expect((await call(deps, catalogHandler, "/calculators", {}, { headers: { cookie: `cx_live=${key}; api_key=${key}` } })).status).toBe(401)
    expect((await call(deps, catalogHandler, "/calculators", {}, { url: `https://x.test/api/v1/calculators?api_key=${key}&key=${key}` })).status).toBe(401)
  })

  it("503 (not a crash) when the key store is down", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    deps.store.findByHash = async () => { throw new Error("db down") }
    const r = await call(deps, catalogHandler, "/calculators", {}, { key })
    expect(r.status).toBe(503)
  })
})

describe("POST /calculators/{id}/calculate", () => {
  it("returns the documented shape", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const r = await call(deps, calculateHandler, "/calculators/creatinine-clearance/calculate", { id: "creatinine-clearance" }, { key, body: { inputs: { ...CRCL, creatinine: 1.2 } } })
    expect(r.status).toBe(200)
    expect(Object.keys(r.json).sort()).toEqual(["conversions", "disclaimer", "id", "intendedUse", "referenceStatus", "references", "requestId", "result", "version"])
    expect(r.json.id).toBe("creatinine-clearance")
    expect(r.json.version).toBe(FORMULA_VERSIONS["creatinine-clearance"])
    expect(typeof r.json.result.display).toBe("string")
    expect(r.json.conversions).toEqual([])
    expect(Array.isArray(r.json.references)).toBe(true)
    expect(r.json.disclaimer.length).toBeGreaterThan(10)
  })

  it("88 umol/L gives the same CrCl as the mg/dL path with the converted value (the doc's curl example)", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const viaUnit = await call(deps, calculateHandler, "", { id: "creatinine-clearance" }, { key, body: { inputs: { ...CRCL, creatinine: { value: 88, unit: "umol/L" } } } })
    expect(viaUnit.status).toBe(200)
    expect(viaUnit.json.conversions.length).toBe(1)
    expect(viaUnit.json.conversions[0].from).toEqual({ value: 88, unit: "umol/L" })
    const mgdl = viaUnit.json.conversions[0].to.value
    expect(Math.abs(mgdl - 0.99546) < 1e-4).toBe(true)
    const plain = await call(deps, calculateHandler, "", { id: "creatinine-clearance" }, { key, body: { inputs: { ...CRCL, creatinine: mgdl } } })
    expect(plain.status).toBe(200)
    expect(viaUnit.json.result).toEqual(plain.json.result)
    // and it is exactly what the calculator itself returns
    const direct = getCalculatorById("creatinine-clearance")!.calculate({ age: "54", weight: "70", sex: "male", creatinine: String(mgdl) })
    expect(viaUnit.json.result.display).toBe(direct.display)
  })

  it("422 with field-level messages for missing, out-of-range, unknown and bad-unit inputs", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const r = await call(deps, calculateHandler, "", { id: "creatinine-clearance" }, { key, body: { inputs: { age: -3, weight: 70, creatinine: { value: 1, unit: "furlongs" }, mrn: "SECRET-12345" } } })
    expect(r.status).toBe(422)
    expect(r.json.error.code).toBe("validation_failed")
    const byId = Object.fromEntries(r.json.error.fields.map((f: { id: string; code: string }) => [f.id, f.code]))
    expect(byId).toEqual({ mrn: "unknown_input", age: "out_of_range", creatinine: "unit_unknown", sex: "required" })
    expect(JSON.stringify(r.json)).not.toContain("SECRET-12345")
  })

  it("422 when the calculator itself rejects the combination", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const r = await call(deps, calculateHandler, "", { id: "gestational-age" }, { key, body: { inputs: { lmp: "2026-01-10", edd: "2026-10-17", asOf: "2026-03-15", cycleLength: "" } } })
    expect(r.status).toBe(422)
    expect(r.json.error.fields[0].code).toBe("calculation_error")
  })

  it("404 for an unknown calculator (after the key is checked)", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    expect((await call(deps, calculateHandler, "", { id: "nope" }, { key, body: { inputs: {} } })).status).toBe(404)
    expect((await call(deps, calculateHandler, "", { id: "nope" }, { body: { inputs: {} } })).status).toBe(401)
  })

  it("rejects bad bodies: invalid JSON 400, non-object 422, missing inputs 422, too large 413", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const p = { id: "bmi" }
    expect((await call(deps, calculateHandler, "", p, { key, rawBody: "{not json" })).status).toBe(400)
    expect((await call(deps, calculateHandler, "", p, { key, rawBody: "[1,2]" })).status).toBe(422)
    expect((await call(deps, calculateHandler, "", p, { key, body: { nothing: 1 } })).status).toBe(422)
    expect((await call(deps, calculateHandler, "", p, { key, rawBody: JSON.stringify({ inputs: { x: "a".repeat(200_000) } }) })).status).toBe(413)
  })
})

describe("scopes: dosing and oncology are blocked for default keys", () => {
  it("calculate: 403 for dosing and oncology with a default key, 200-or-422 (not 403) with the dosing scope", async () => {
    const { deps, seed } = setup()
    const def = await seed()
    const dosing = await seed(ALL)
    const dosingIds = calculators.filter((c) => c.category === "dosing" || c.category === "oncology").map((c) => c.id)
    expect(dosingIds.length).toBeGreaterThanOrEqual(72)
    for (const id of dosingIds) {
      const blocked = await call(deps, calculateHandler, "", { id }, { key: def, body: { inputs: {} } })
      expect(blocked.status, id).toBe(403)
      expect(blocked.json.error.code).toBe("scope_required")
      expect(blocked.json.error.scope).toBe("calculate:dosing")
    }
    const allowed = await call(deps, calculateHandler, "", { id: dosingIds[0] }, { key: dosing, body: { inputs: {} } })
    expect(allowed.status).toBe(422) // reached the validation, so not blocked
  })

  it("the catalog hides them from default keys and lists them for dosing keys; the detail endpoint is 403", async () => {
    const { deps, seed } = setup()
    const def = await seed()
    const dosing = await seed(ALL)
    const a = await call(deps, catalogHandler, "/calculators", {}, { key: def })
    const b = await call(deps, catalogHandler, "/calculators", {}, { key: dosing })
    expect(a.status).toBe(200)
    expect(a.json.calculators.some((c: { category: string }) => c.category === "dosing" || c.category === "oncology")).toBe(false)
    expect(a.json.count).toBe(calculators.filter((c) => c.category !== "dosing" && c.category !== "oncology").length)
    expect(b.json.count).toBe(calculators.length)
    const detail = await call(deps, calculatorHandler, "", { id: calculators.find((c) => c.category === "dosing")!.id }, { key: def })
    expect(detail.status).toBe(403)
  })

  it("a key without the scope for an endpoint gets 403", async () => {
    const { deps, seed } = setup()
    const noConvert = await seed(["read:catalog", "calculate:general"])
    const noCatalog = await seed(["convert"])
    expect((await call(deps, conversionsHandler, "", {}, { key: noConvert })).status).toBe(403)
    expect((await call(deps, convertHandler, "", {}, { key: noConvert, body: { category: "mass", value: 1, from: "kg", to: "lb" } })).status).toBe(403)
    expect((await call(deps, catalogHandler, "", {}, { key: noCatalog })).status).toBe(403)
    expect((await call(deps, calculateHandler, "", { id: "bmi" }, { key: noCatalog, body: { inputs: {} } })).status).toBe(403) // convert-only key cannot calculate
  })
})

describe("catalog", () => {
  it("describes inputs with units, bounds, options and coding, plus version and reference status", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const r = await call(deps, calculatorHandler, "", { id: "creatinine-clearance" }, { key })
    expect(r.status).toBe(200)
    const c = r.json.calculator
    expect(c.version).toBe(FORMULA_VERSIONS["creatinine-clearance"])
    expect(c.requiredScope).toBe("calculate:general")
    const cr = c.inputs.find((i: { id: string }) => i.id === "creatinine")
    expect(cr.unit).toBe("mg/dL")
    expect(cr.loinc).toBe("2160-0")
    expect(cr.ucum).toBe("mg/dL")
    expect(c.inputs.find((i: { id: string }) => i.id === "sex").options.map((o: { value: string }) => o.value)).toEqual(["male", "female"])
    expect([null, "current", "supporting", "review-needed"]).toContain(c.referenceStatus)
  })
  it("filters by category", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const r = await call(deps, catalogHandler, "", {}, { key, url: "https://x.test/api/v1/calculators?category=renal" })
    expect(r.json.calculators.every((c: { category: string }) => c.category === "renal")).toBe(true)
    expect(r.json.count).toBe(calculators.filter((c) => c.category === "renal").length)
  })
})

describe("POST /calculators/batch", () => {
  const item = (id = "bmi") => ({ id, inputs: { weight: 70, height: 170 } })

  it("answers up to 25 items, each with its own status", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const r = await call(deps, batchHandler, "", {}, { key, body: { calculations: Array.from({ length: MAX_BATCH }, () => item()) } })
    expect(r.status).toBe(200)
    expect(r.json.count).toBe(25)
    expect(r.json.results.every((x: { status: number }) => x.status === 200)).toBe(true)
    expect(r.json.results[0].version).toBe(FORMULA_VERSIONS.bmi)
  })

  it("26 items is refused; an empty or malformed batch is refused", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const big = await call(deps, batchHandler, "", {}, { key, body: { calculations: Array.from({ length: 26 }, () => item()) } })
    expect(big.status).toBe(422)
    expect(big.json.error.code).toBe("batch_too_large")
    expect((await call(deps, batchHandler, "", {}, { key, body: { calculations: [] } })).status).toBe(422)
    expect((await call(deps, batchHandler, "", {}, { key, body: { calculations: "x" } })).status).toBe(422)
    expect((await call(deps, batchHandler, "", {}, { key, body: {} })).status).toBe(422)
  })

  it("mixes 200, 404, 403 (dosing), 422 and malformed items without failing the whole request", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const dosingId = calculators.find((c) => c.category === "dosing")!.id
    const r = await call(deps, batchHandler, "", {}, { key, body: { calculations: [item(), { id: "nope", inputs: {} }, { id: dosingId, inputs: {} }, { id: "bmi", inputs: { weight: -1, height: 170 } }, "junk", { id: "bmi" }] } })
    expect(r.status).toBe(200)
    expect(r.json.results.map((x: { status: number }) => x.status)).toEqual([200, 404, 403, 422, 422, 422])
    expect(r.json.results[3].error.fields.length).toBeGreaterThan(0)
  })

  it("a batch counts once toward the rate limit", async () => {
    const { deps, seed } = setup({ limit: 2 })
    const key = await seed()
    const body = { calculations: Array.from({ length: 25 }, () => item()) }
    expect((await call(deps, batchHandler, "", {}, { key, body })).status).toBe(200)
    expect((await call(deps, batchHandler, "", {}, { key, body })).status).toBe(200)
    expect((await call(deps, batchHandler, "", {}, { key, body })).status).toBe(429)
  })
})

describe("conversions", () => {
  it("lists categories with UCUM codes and analytes", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const r = await call(deps, conversionsHandler, "", {}, { key })
    expect(r.status).toBe(200)
    const pressure = r.json.categories.find((c: { id: string }) => c.id === "pressure")
    expect(pressure.units.find((u: { id: string }) => u.id === "mmHg").ucum).toBe("mm[Hg]")
    expect(r.json.analytes.items.some((a: { id: string }) => a.id === "creatinine")).toBe(true)
  })

  it("converts within a category, accepting engine ids or UCUM codes", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const a = await call(deps, convertHandler, "", {}, { key, body: { category: "mass", value: 154.32358, from: "lb", to: "kg" } })
    expect(a.status).toBe(200)
    expect(Math.abs(a.json.result - 70) < 1e-4).toBe(true)
    const b = await call(deps, convertHandler, "", {}, { key, body: { category: "pressure", value: 120, from: "mm[Hg]", to: "kPa" } })
    expect(b.status).toBe(200)
    expect(Math.abs(b.json.result - 15.99868) < 1e-3).toBe(true)
    const c = await call(deps, convertHandler, "", {}, { key, body: { category: "temperature", value: 98.6, from: "[degF]", to: "Cel" } })
    expect(Math.abs(c.json.result - 37) < 1e-9).toBe(true)
  })

  it("converts an analyte between mass and molar units (creatinine 88.4 umol/L is about 1 mg/dL)", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const r = await call(deps, convertHandler, "", {}, { key, body: { analyte: "creatinine", value: 88.4, from: "umol/L", to: "mg/dL" } })
    expect(r.status).toBe(200)
    expect(Math.abs(r.json.result - 1) < 1e-3).toBe(true)
    expect(r.json.molecularWeight).toBe(113.12)
  })

  it("refuses unknown units, categories, analytes and bad numbers (nothing is guessed)", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const bad = (body: unknown) => call(deps, convertHandler, "", {}, { key, body })
    expect((await bad({ category: "mass", value: 1, from: "stone", to: "kg" })).status).toBe(422)
    expect((await bad({ category: "nope", value: 1, from: "a", to: "b" })).status).toBe(422)
    expect((await bad({ analyte: "unobtainium", value: 1, from: "mg/dL", to: "mmol/L" })).status).toBe(422)
    expect((await bad({ analyte: "creatinine", value: 1, from: "lb", to: "mmol/L" })).status).toBe(422)
    expect((await bad({ category: "mass", value: "abc", from: "kg", to: "lb" })).status).toBe(422)
    expect((await bad({ category: "mass", value: 1e999, from: "kg", to: "lb" })).status).toBe(422)
  })
})

describe("public endpoints", () => {
  it("health and the OpenAPI document need no key", async () => {
    const h = healthResponse("abc123")
    expect(h.status).toBe(200)
    const body = await h.json()
    expect(body.status).toBe("ok")
    expect(body.buildId).toBe("abc123")
    expect(h.headers.get("cache-control")).toBe("no-store")
    expect(healthResponse("")).toBeDefined()
    const o = openApiResponse()
    expect(o.status).toBe(200)
    expect((await o.json()).openapi).toBe("3.1.0")
  })
})

describe("rate limiting and headers", () => {
  it("429 with Retry-After once the per-key limit is used up; X-RateLimit-* on every response", async () => {
    const { deps, seed } = setup({ limit: 2 })
    const key = await seed()
    const one = await call(deps, catalogHandler, "", {}, { key })
    expect(one.res.headers.get("x-ratelimit-limit")).toBe("2")
    expect(one.res.headers.get("x-ratelimit-remaining")).toBe("1")
    expect(Number(one.res.headers.get("x-ratelimit-reset")) > 0).toBe(true)
    await call(deps, catalogHandler, "", {}, { key })
    const three = await call(deps, catalogHandler, "", {}, { key })
    expect(three.status).toBe(429)
    expect(three.json.error.code).toBe("rate_limited")
    expect(Number(three.res.headers.get("retry-after")) >= 1).toBe(true)
    expect(three.res.headers.get("x-ratelimit-remaining")).toBe("0")
    expect(three.res.headers.get("cache-control")).toBe("no-store")
  })
  it("limits are per key", async () => {
    const { deps, seed } = setup({ limit: 1 })
    const a = await seed()
    const b = await seed()
    expect((await call(deps, catalogHandler, "", {}, { key: a })).status).toBe(200)
    expect((await call(deps, catalogHandler, "", {}, { key: a })).status).toBe(429)
    expect((await call(deps, catalogHandler, "", {}, { key: b })).status).toBe(200)
  })
})

describe("errors and metering", () => {
  it("an exception inside a handler becomes a generic 500 with no message or stack", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    const r = await call(deps, () => { throw new Error("SECRET-789 at /srv/app/secret.ts:12") }, "", {}, { key })
    expect(r.status).toBe(500)
    expect(r.json.error.code).toBe("internal_error")
    const text = JSON.stringify(r.json)
    expect(text).not.toContain("SECRET-789")
    expect(text).not.toContain("secret.ts")
    expect(text).not.toContain("stack")
  })

  it("meters counts only: calls and errors per key, nothing else", async () => {
    const { deps, seed, store } = setup()
    const key = await seed()
    await call(deps, catalogHandler, "", {}, { key })
    await call(deps, calculateHandler, "", { id: "bmi" }, { key, body: { inputs: { weight: 70, height: 170 } } })
    await call(deps, calculateHandler, "", { id: "bmi" }, { key, body: { inputs: {} } })
    const [usage] = [...store.usage.values()]
    expect(usage).toEqual({ calls: 3, errors: 1 })
    expect(Object.keys(usage).sort()).toEqual(["calls", "errors"])
    expect((await call(deps, catalogHandler, "", {}, {})).status).toBe(401)
    expect(store.usage.size).toBe(1) // unauthenticated calls are not metered
  })

  it("a metering failure never breaks the request", async () => {
    const { deps, seed } = setup()
    const key = await seed()
    deps.store.recordUsage = async () => { throw new Error("meter down") }
    expect((await call(deps, catalogHandler, "", {}, { key })).status).toBe(200)
  })
})
