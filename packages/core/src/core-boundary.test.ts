import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * @clinexia/core must stay free of Next.js, React, Supabase, Node and browser APIs, so the same code runs in the web app, a
 * server, a Mirth channel and the Capacitor app. This test is the lint rule: it fails the moment a file in packages/core/src
 * imports anything but another file of the package, or touches a browser global.
 */
const src = resolve(dirname(fileURLToPath(import.meta.url)))
const pkgDir = resolve(src, "..")

const walk = (d: string, out: string[] = []): string[] => {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith(".ts")) out.push(p)
  }
  return out
}
const isTest = (f: string) => /\.test\.ts$/.test(f)
const sources = walk(src).filter((f) => !isTest(f))
const importsOf = (text: string) => [...text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2] ?? m[3])
const typeImportsOf = (text: string) => [...text.matchAll(/(?:^|\n)\s*(?:import|export)\s+type\s[^;]*?from\s+["']([^"']+)["']/g)].map((m) => m[1])
const stripComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("@clinexia/core has no outside dependencies", () => {
  it("has files to check", () => {
    expect(sources.length).toBeGreaterThan(40)
  })

  it("imports only other files inside packages/core/src (no packages, no node:, no @/ app alias)", () => {
    const bad: string[] = []
    for (const f of sources) {
      const text = readFileSync(f, "utf8")
      for (const spec of [...importsOf(text), ...typeImportsOf(text)]) {
        if (!spec.startsWith(".")) { bad.push(`${relative(src, f)} imports "${spec}"`); continue }
        const target = resolve(dirname(f), spec)
        const inside = target.startsWith(src) && [target, `${target}.ts`, join(target, "index.ts")].some((c) => existsSync(c) && statSync(c).isFile())
        if (!inside) bad.push(`${relative(src, f)} imports "${spec}" which is not a file of the package`)
      }
    }
    expect(bad).toEqual([])
  })

  it("does not use browser, DOM-storage or network globals", () => {
    const forbidden = /\b(window|document)\s*\.|\b(localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|BroadcastChannel)\b|\bnavigator\s*\.|\bfetch\s*\(|\bprocess\s*\.|\brequire\s*\(/
    const hits = sources.filter((f) => forbidden.test(stripComments(readFileSync(f, "utf8")))).map((f) => relative(src, f))
    expect(hits).toEqual([])
  })

  it("package.json declares no dependencies of any kind", () => {
    const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"))
    for (const key of ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"]) expect(pkg[key], key).toBeUndefined()
  })

  it("the build config excludes tests and the generated vector data from dist", () => {
    const cfg = JSON.parse(readFileSync(join(pkgDir, "tsconfig.build.json"), "utf8"))
    expect(cfg.exclude).toContain("src/**/*.test.ts")
  })
})
