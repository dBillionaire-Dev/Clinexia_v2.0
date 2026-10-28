import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve, sep } from "node:path"

/**
 * "No PHI" guard for the SMART launcher and the CDS Hooks stub (rule 3). Values read from a patient record must never be logged,
 * persisted or sent to Clinexia's servers or to analytics. Structural checks, paired with the runtime checks in
 * app/api/cds-services/routes.test.ts. Browser storage is allowed in exactly one file (lib/smart/session.ts), which stores only
 * the calculator id and the embed choice.
 */
const root = process.cwd()
const walk = (dir: string, out: string[] = []): string[] => {
  if (!existsSync(dir)) return out
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p)
  }
  return out
}
const rel = (p: string) => p.slice(root.length + 1).split(sep).join("/")

const sources = [...walk(resolve(root, "lib/smart")), ...walk(resolve(root, "lib/cds")), ...walk(resolve(root, "app/smart")), ...walk(resolve(root, "app/api/cds-services")), resolve(root, "components/calculators/smart-prefill-notice.tsx")]

const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
const FORBIDDEN: Array<[RegExp, string]> = [
  [/\bconsole\s*\./, "console"],
  [/\bfetch\s*\(/, "fetch"],
  [/sendBeacon|XMLHttpRequest|WebSocket/, "network API"],
  [/\blocalStorage\b|\bindexedDB\b|document\.cookie/, "persistent browser storage"],
  [/@\/lib\/(analytics|history|feedback)|track-calculation|trackCalculation|calculation_events|recently-used|use-history/, "analytics or history"],
]

describe("SMART launcher and CDS Hooks: no logging, persistence or analytics", () => {
  it("finds the files to check", () => {
    expect(sources.filter((f) => existsSync(f)).length).toBeGreaterThan(10)
    for (const must of ["lib/smart/mapping.ts", "lib/cds/service.ts", "app/smart/callback/page.tsx", "app/api/cds-services/[id]/route.ts"]) expect(sources.map(rel)).toContain(must)
  })

  for (const [pattern, label] of FORBIDDEN) {
    it(`no file uses ${label}`, () => {
      const hits = sources.filter((f) => existsSync(f) && pattern.test(strip(readFileSync(f, "utf8")))).map(rel)
      expect(hits).toEqual([])
    })
  }

  it("sessionStorage is used only in lib/smart/session.ts, and that file stores nothing but the calculator id and the embed choice", () => {
    const users = sources.filter((f) => existsSync(f) && /sessionStorage/.test(strip(readFileSync(f, "utf8")))).map(rel)
    expect(users).toEqual(["lib/smart/session.ts"])
    const session = readFileSync(resolve(root, "lib/smart/session.ts"), "utf8")
    expect(session).toMatch(/JSON\.stringify\(\{ calculatorId: o\.calculatorId, embed: o\.embed \}\)/)
    expect(session.match(/setItem\(/g)?.length).toBe(1)
  })

  it("the review step clears the OAuth session as soon as the review is built", () => {
    const cb = readFileSync(resolve(root, "app/smart/callback/page.tsx"), "utf8")
    expect(cb.indexOf("clearFhirSession()")).toBeGreaterThan(-1)
    expect(cb.indexOf("clearFhirSession()")).toBeLessThan(cb.indexOf('setState({ kind: "review"'))
  })

  it("record values reach the calculator only in the URL fragment, never in a query string", () => {
    const cb = readFileSync(resolve(root, "app/smart/callback/page.tsx"), "utf8")
    expect(cb).toMatch(/\}#\$\{buildPrefillFragment/)
    expect(cb).not.toMatch(/\?\$\{buildPrefillFragment/)
  })

  it("nothing reachable from lib/smart or lib/cds imports analytics, history or feedback code", () => {
    const IMPORT = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm
    const resolveImport = (spec: string, from: string): string | null => {
      let base: string
      if (spec === "@clinexia/core") base = resolve(root, "packages/core/src/index")
      else if (spec.startsWith("@clinexia/core/")) base = resolve(root, "packages/core/src", spec.slice(15))
      else if (spec.startsWith("@/")) base = resolve(root, spec.slice(2))
      else if (spec.startsWith(".")) base = resolve(dirname(from), spec)
      else return null
      for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c
      return null
    }
    const seen = new Set<string>()
    const stack = [...walk(resolve(root, "lib/smart")), ...walk(resolve(root, "lib/cds"))]
    while (stack.length) {
      const f = stack.pop()!
      if (seen.has(f)) continue
      seen.add(f)
      for (const m of readFileSync(f, "utf8").matchAll(IMPORT)) {
        const next = resolveImport(m[1], f)
        if (next) stack.push(next)
      }
    }
    const names = [...seen].map(rel)
    expect(names.length).toBeGreaterThan(20)
    expect(names.filter((n) => /^lib\/(analytics|history|feedback)\//.test(n) || /recently-used/.test(n) || /^components\//.test(n))).toEqual([])
  })
})
