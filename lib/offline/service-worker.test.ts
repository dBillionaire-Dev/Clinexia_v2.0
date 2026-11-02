// clinexia-upgrade:phase3 tests — runs the real public/service-worker.js in a sandbox with a fake network and
// fake Cache Storage, and checks what ends up cached. This is the closest automated check to "airplane mode".
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import vm from "node:vm"

const source = readFileSync(resolve(__dirname, "../../public/service-worker.js"), "utf8")
const ORIGIN = "https://clinexia.test"

type Fake = { body: string; status?: number; type?: string; html?: boolean }

function boot(network: (path: string) => Fake | "network-error") {
  const stores = new Map<string, Map<string, unknown>>()
  const keyOf = (k: unknown) => (typeof k === "string" ? k : (k as { url: string }).url.replace(ORIGIN, ""))
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const s = stores.get(name)!
      return { put: async (k: unknown, v: unknown) => void s.set(keyOf(k), v), match: async (k: unknown) => s.get(keyOf(k)), keys: async () => [...s.keys()].map((url) => ({ url: ORIGIN + url })), delete: async (k: unknown) => s.delete(keyOf(k)) }
    },
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    match: async (k: unknown) => { for (const s of stores.values()) if (s.has(keyOf(k))) return s.get(keyOf(k)) },
  }
  const fetchFn = async (req: { url: string } | string) => {
    const path = (typeof req === "string" ? req : req.url).replace(ORIGIN, "")
    const r = network(path)
    if (r === "network-error") throw new TypeError("offline")
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, type: r.type ?? "basic", url: ORIGIN + path, headers: { get: () => (r.html === false ? "application/javascript" : "text/html") }, text: async () => r.body, clone() { return this } }
  }
  const handlers: Record<string, (e: unknown) => void> = {}
  const selfObj = { addEventListener: (t: string, f: (e: unknown) => void) => void (handlers[t] = f), location: { origin: ORIGIN }, skipWaiting: async () => {}, clients: { claim: async () => {} } }
  class FakeRequest { url: string; constructor(u: string) { this.url = ORIGIN + u } }
  const ctx = vm.createContext({ self: selfObj, caches, fetch: fetchFn, Request: FakeRequest, Response, URL, console, Promise, Set, Map, JSON, Date })
  vm.runInContext(source, ctx)
  const install = async () => { let p: Promise<unknown> = Promise.resolve(); handlers.install({ waitUntil: (x: Promise<unknown>) => (p = x) }); await p }
  const cached = (name = "clinexia-shell-v6") => [...(stores.get(name)?.keys() ?? [])]
  const status = async () => JSON.parse(await (stores.get("clinexia-shell-v6")!.get("/__precache-status.json") as Response).text())
  return { install, cached, status }
}

const page = (extra = "") => ({ body: `<html><script src="/_next/static/chunks/app-1.js"></script><link href="/_next/static/css/site.css?dpl=abc&amp;x=1" rel="stylesheet">${extra}</html>` })

describe("service worker precache", () => {
  it("caches the JS and CSS that cached pages need, including query-string URLs", async () => {
    const sw = boot((p) => (p.startsWith("/_next/static/") ? { body: "x", html: false } : page()))
    await sw.install()
    const keys = sw.cached()
    expect(keys).toContain("/_next/static/chunks/app-1.js")
    expect(keys).toContain("/_next/static/css/site.css?dpl=abc&x=1")
    expect(keys).toContain("/")
  })

  it("discovers calculator pages linked from category pages and caches them", async () => {
    const sw = boot((p) => {
      if (p.startsWith("/_next/static/")) return { body: "x", html: false }
      if (p === "/calculators/general") return page('<a href="/calculators/general/brand-new-tool">x</a>')
      if (p === "/calculators/general/brand-new-tool") return page('<script src="/_next/static/chunks/new-only.js"></script>')
      return page()
    })
    await sw.install()
    expect(sw.cached()).toContain("/calculators/general/brand-new-tool")
    expect(sw.cached()).toContain("/_next/static/chunks/new-only.js")
  })

  it("reports network failures honestly, and treats 404 as skipped rather than failed", async () => {
    const sw = boot((p) => (p === "/settings" ? "network-error" : p === "/history" ? { body: "", status: 404 } : p.startsWith("/_next/static/") ? { body: "x", html: false } : page()))
    await sw.install()
    const s = await sw.status()
    expect(s.failed).toContain("/settings")
    expect(s.failed).not.toContain("/history")
    expect(s.skipped).toBeGreaterThanOrEqual(1)
    expect(s.version).toBe("v6")
  })

  it("still installs when the whole network is down", async () => {
    const sw = boot(() => "network-error")
    await expect(sw.install()).resolves.toBeUndefined()
    expect((await sw.status()).failed.length).toBeGreaterThan(100)
  })

  it("never caches non-same-origin or non-basic responses", async () => {
    const sw = boot((p) => (p === "/" ? { body: "x", type: "cors" } : page()))
    await sw.install()
    expect(sw.cached()).not.toContain("/")
  })
})
