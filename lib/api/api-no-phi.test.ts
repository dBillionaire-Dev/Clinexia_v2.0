import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve, sep } from "node:path"
import { generateApiKey } from "./keys"
import { createMemoryKeyStore } from "./key-store"
import { createRateLimiter } from "./rate-limit"
import { runApi, type ApiDeps } from "./v1/kit"
import { calculateHandler, batchHandler, convertHandler } from "./v1/handlers"

/**
 * "No PHI" guard for the public API (rule 3). The API must never write inputs or results to a log, a database or an analytics
 * table, and must never call the analytics or tracking modules. Three independent checks:
 *   1. static: nothing reachable from the API entry points imports lib/analytics, history, usage tracking or calculation_events
 *   2. static: the API sources contain no console.* calls (nothing is logged)
 *   3. runtime: a real request with identifiable-looking values produces no console output and no network call
 */
const root = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

// The public API: everything under lib/api and app/api/v1. (The organisation-side key management route sits on the existing billing
// stores, which are outside this guarantee, and is covered by keys-admin.test.ts.)
const entryFiles = [...walk(resolve(root, "lib/api")), ...walk(resolve(root, "app/api/v1"))]

const IMPORT = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm

function resolveImport(spec: string, from: string): string | null {
  let base: string
  if (spec === "@clinexia/core") base = resolve(root, "packages/core/src/index")
  else if (spec.startsWith("@clinexia/core/")) base = resolve(root, "packages/core/src", spec.slice("@clinexia/core/".length))
  else if (spec.startsWith("@/")) base = resolve(root, spec.slice(2))
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec)
  else return null // a package: not our code
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c
  return null
}

function reachable(entries: string[]): Set<string> {
  const seen = new Set<string>()
  const stack = [...entries]
  while (stack.length) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const text = readFileSync(file, "utf8")
    for (const m of text.matchAll(IMPORT)) {
      const next = resolveImport(m[1] ?? m[2], file)
      if (next) stack.push(next)
    }
  }
  return seen
}

const rel = (p: string) => p.slice(root.length + 1).split(sep).join("/")

describe("the public API never reaches analytics, history or usage tracking", () => {
  const files = reachable(entryFiles)
  const names = [...files].map(rel)

  it("crawls a meaningful part of the codebase (so the check below is not vacuous)", () => {
    expect(names.some((n) => n === "lib/calculators/registry.ts")).toBe(true)
    expect(names.some((n) => n === "lib/integration/normalise.ts")).toBe(true)
    expect(names.some((n) => n === "packages/core/src/calculators/registry.ts")).toBe(true) // the crawl follows the shims into the package
    expect(names.length).toBeGreaterThan(40)
  })

  it("no file reachable from the API imports an analytics, history, feedback or UI module", () => {
    const forbidden = names.filter((n) => /^lib\/analytics\//.test(n) || /^lib\/history\//.test(n) || /^lib\/feedback\//.test(n) || /recently-used/.test(n) || /^components\//.test(n))
    expect(forbidden).toEqual([])
  })

  it("no reachable file mentions calculation_events or trackCalculation", () => {
    const hits = [...files].filter((f) => /calculation_events|trackCalculation|track-calculation/.test(readFileSync(f, "utf8"))).map(rel)
    expect(hits).toEqual([])
  })

  it("the API sources contain no console calls: nothing is logged", () => {
    const hits = entryFiles.filter((f) => /\bconsole\s*\./.test(readFileSync(f, "utf8"))).map(rel)
    expect(hits).toEqual([])
  })
})

describe("a real request leaves no trace", () => {
  it("no console output and no network call while calculating, batching and converting identifiable-looking values", async () => {
    const store = createMemoryKeyStore()
    const g = generateApiKey()
    await store.create({ orgId: "o", name: "t", keyPrefix: g.prefix, keyHash: g.hash, scopes: ["read:catalog", "calculate:general", "convert"], createdBy: "u" })
    const deps: ApiDeps = { store, limiter: createRateLimiter({ limit: () => 100 }) }

    const calls: string[] = []
    const levels = ["log", "info", "warn", "error", "debug", "trace"] as const
    const realConsole = Object.fromEntries(levels.map((l) => [l, console[l]]))
    for (const l of levels) console[l] = (() => { calls.push(l) }) as never
    const realFetch = globalThis.fetch
    globalThis.fetch = (() => { calls.push("fetch"); throw new Error("network is not allowed") }) as never
    try {
      const post = (handler: typeof calculateHandler, params: Record<string, string>, body: unknown) =>
        runApi(new Request("https://x.test/api/v1/x", { method: "POST", headers: { authorization: `Bearer ${g.key}`, "content-type": "application/json" }, body: JSON.stringify(body) }), deps, handler, params)
      await post(calculateHandler, { id: "creatinine-clearance" }, { inputs: { age: 54, weight: 70, sex: "male", creatinine: 1.2, mrn: "MRN-SECRET-1", name: "Jane Doe" } })
      await post(calculateHandler, { id: "creatinine-clearance" }, { inputs: { age: "bad" } })
      await post(batchHandler, {}, { calculations: [{ id: "bmi", inputs: { weight: 70, height: 170 } }, { id: "nope", inputs: {} }] })
      await post(convertHandler, {}, { analyte: "creatinine", value: 88, from: "umol/L", to: "mg/dL" })
      await post(calculateHandler, { id: "creatinine-clearance" }, "not an object" as never)
    } finally {
      for (const l of levels) console[l] = realConsole[l] as never
      globalThis.fetch = realFetch
    }
    expect(calls).toEqual([])
  })
})
