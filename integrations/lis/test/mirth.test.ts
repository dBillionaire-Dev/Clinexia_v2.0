import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import vm from "node:vm"
import * as core from "@clinexia/core"
import { addCalculatedResults } from "../node/adapter.mjs"
import { createCoreBackend } from "../node/core-backend.mjs"

/**
 * Runs the Mirth Connect files (the shared ES5 library, the API backend and the transformer step) in a sandbox that imitates the parts of
 * Mirth and Java they use, with a fake Clinexia API behind java.net.URL. This proves the Mirth path produces the same calculated results
 * as the Node path. It does NOT prove anything about a real Mirth engine (Rhino); that is listed in FINDINGS.md.
 */
const here = fileURLToPath(new URL(".", import.meta.url))
const read = (rel: string) => readFileSync(`${here}../${rel}`, "utf8")
const sample = (name: string) => read(`samples/${name}`)

type Call = { url: string; headers: Record<string, string>; body: string; method: string }

function fakeApi(options: { key?: string; fail?: number } = {}) {
  const backend = createCoreBackend(core)
  const calls: Call[] = []
  const respond = (call: Call): { status: number; text: string } => {
    if (options.fail) return { status: options.fail, text: JSON.stringify({ error: { code: "x" } }) }
    if (call.headers["Authorization"] !== `Bearer ${options.key ?? "test-key"}`) return { status: 401, text: JSON.stringify({ error: { code: "invalid_api_key" } }) }
    const m = /\/api\/v1\/calculators\/([^/]+)\/calculate$/.exec(call.url)
    if (!m || call.method !== "POST") return { status: 404, text: "{}" }
    const r = backend.calculate(m[1], JSON.parse(call.body).inputs)
    if (r.ok) return { status: 200, text: JSON.stringify({ id: m[1], version: r.version, result: { ...r.result, warnings: r.warnings } }) }
    return { status: 422, text: JSON.stringify({ error: { code: "validation_failed", fields: r.fields ?? [] } }) }
  }
  // The few java.* classes the Mirth files use.
  const java = {
    net: {
      URL: function (this: { openConnection: () => unknown }, url: string) {
        this.openConnection = () => {
          const call: Call = { url, headers: {}, body: "", method: "" }
          let reply: { status: number; text: string } | null = null
          const get = () => (reply ??= respond(call))
          return {
            setRequestMethod: (m: string) => { call.method = m },
            setConnectTimeout: () => undefined,
            setReadTimeout: () => undefined,
            setRequestProperty: (k: string, v: string) => { call.headers[k] = v },
            setDoOutput: () => undefined,
            getOutputStream: () => ({ write: (b: string) => { call.body = b }, close: () => { calls.push(call) } }),
            getResponseCode: () => get().status,
            getInputStream: () => ({ text: get().text }),
            getErrorStream: () => ({ text: get().text }),
          }
        }
      },
    },
    lang: { String: function (this: { getBytes: () => string }, s: string) { this.getBytes = () => s } },
    util: { Scanner: function (this: { useDelimiter: () => { next: () => string } }, stream: { text: string }) { this.useDelimiter = () => ({ next: () => stream.text }) } },
  }
  return { java, calls }
}

function runMirth(rawMessage: string, api = fakeApi(), config: Record<string, string> = { CLINEXIA_API_BASE: "https://clinexia.example.test/", CLINEXIA_API_KEY: "test-key" }) {
  const channelMap = new Map<string, string>()
  const sandbox: Record<string, unknown> = {
    java: api.java,
    JSON,
    connectorMessage: { getRawData: () => rawMessage },
    configurationMap: { get: (k: string) => config[k] },
    channelMap: { put: (k: string, v: string) => channelMap.set(k, v), get: (k: string) => channelMap.get(k) ?? null },
  }
  const context = vm.createContext(sandbox)
  // Code templates first, then the step: exactly what a Mirth channel does.
  vm.runInContext(read("shared/clinexia-lis.js"), context)
  vm.runInContext(read("mirth/clinexia-api-backend.js"), context)
  vm.runInContext(read("mirth/transformer-step.js"), context)
  return { channelMap, calls: api.calls }
}

/** The new message's MSH-7 timestamp and control id depend on the clock; everything else must match. */
const withoutClock = (oru: string) => oru.replace(/^(MSH\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|)\d{14}(\|\|[^|]*\|)[^|]*/, "$1T$2C")

describe("Mirth Connect transformer step (sandbox with a fake API)", () => {
  for (const name of ["oru-chemistry.hl7", "oru-lipids-mgdl.hl7", "oru-lipids-mmol.hl7", "oru-cbc.hl7", "oru-analyser-reports.hl7"]) {
    it(`${name}: the same calculated message as the Node example`, () => {
      const text = sample(name)
      const mirth = runMirth(text)
      const node = addCalculatedResults(core, text, {})
      expect(mirth.channelMap.get("calculatedOru")).toBeDefined()
      expect(withoutClock(mirth.channelMap.get("calculatedOru")!)).toBe(withoutClock(node.oru!))
    })
  }

  it("puts only counts in the channel map summary", () => {
    const { channelMap } = runMirth(sample("oru-chemistry.hl7"))
    expect(JSON.parse(channelMap.get("calcSummary")!)).toEqual({ calculated: 3, skipped: 0, errors: 0 })
    expect(channelMap.get("calcSummary")).not.toMatch(/TEST|140|PLC/)
  })

  it("sets nothing to send when no calculated result could be made (so the destination filter drops it)", () => {
    const { channelMap } = runMirth(sample("oru-skips.hl7"))
    expect(channelMap.get("calculatedOru")).toBeUndefined() // nothing put in the map: Mirth returns null for it, so the filter "!= null" drops the message
    expect(JSON.parse(channelMap.get("calcSummary")!).skipped).toBe(6)
  })

  it("calls the API once per calculator with Bearer auth and sends only numbers, age and sex: no names, identifiers or birth date", () => {
    const { calls } = runMirth(sample("oru-chemistry.hl7"))
    expect(calls.length).toBe(3)
    for (const c of calls) {
      expect(c.url.startsWith("https://clinexia.example.test/api/v1/calculators/")).toBe(true)
      expect(c.method).toBe("POST")
      expect(c.headers["Authorization"]).toBe("Bearer test-key")
      for (const secret of ["TEST-0001", "TESTPATIENT", "SAMPLE", "19721026", "PLC100", "FIL200", "HOSP"]) expect(c.body, secret).not.toContain(secret)
    }
    const egfr = calls.find((c) => c.url.includes("egfr-ckd-epi"))!
    expect(JSON.parse(egfr.body).inputs).toEqual({ creatinine: { value: 88, unit: "umol/L" }, age: 54, sex: "female" })
  })

  it("API failures (401, 503) skip the calculation, never break the channel, and leak nothing", () => {
    for (const api of [fakeApi({ key: "other-key" }), fakeApi({ fail: 503 })]) {
      const { channelMap } = runMirth(sample("oru-chemistry.hl7"), api)
      expect(channelMap.get("calculatedOru")).toBeUndefined() // nothing put in the map: Mirth returns null for it, so the filter "!= null" drops the message
      expect(JSON.parse(channelMap.get("calcSummary")!)).toEqual({ calculated: 0, skipped: 3, errors: 0 })
    }
  })

  it("a network exception is a skip, not a channel error", () => {
    const api = fakeApi()
    const broken = { ...api.java, net: { URL: function () { throw new Error("connection refused to 10.0.0.1 SECRET") } } }
    const { channelMap } = runMirth(sample("oru-chemistry.hl7"), { java: broken, calls: [] })
    expect(channelMap.get("calculatedOru")).toBeUndefined() // nothing put in the map: Mirth returns null for it, so the filter "!= null" drops the message
    expect(channelMap.get("calcSummary")).not.toContain("SECRET")
  })

  it("never processes its own output again", () => {
    const first = runMirth(sample("oru-chemistry.hl7")).channelMap.get("calculatedOru")!
    const again = runMirth(first)
    expect(again.channelMap.get("calculatedOru")).toBeUndefined()
    expect(JSON.parse(again.channelMap.get("calcSummary")!).errors).toBe(1)
  })
})
