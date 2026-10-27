// Builds @clinexia/core into dist/ with the TypeScript compiler only (no extra dependencies):
//   dist/esm    ES modules (relative imports get .js added so Node's ESM loader accepts them)
//   dist/cjs    CommonJS
//   dist/types  .d.ts files
// Usage: node scripts/build.mjs        (set TSC_BIN to use a specific tsc)
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(pkgDir, "dist")

function findTsc() {
  if (process.env.TSC_BIN) return process.env.TSC_BIN
  try {
    return createRequire(join(pkgDir, "package.json")).resolve("typescript/bin/tsc")
  } catch {
    throw new Error("TypeScript not found. Run `pnpm install` at the repository root first, or set TSC_BIN.")
  }
}

const tsc = findTsc()
const run = (args) => {
  const r = spawnSync(process.execPath, [tsc, "-p", "tsconfig.build.json", ...args], { cwd: pkgDir, stdio: "inherit" })
  if (r.status !== 0) throw new Error(`tsc failed (${args.join(" ")})`)
}

rmSync(dist, { recursive: true, force: true })
run(["--module", "esnext", "--moduleResolution", "bundler", "--outDir", "dist/esm", "--declaration", "--declarationDir", "dist/types"])
// The CommonJS pass uses classic node resolution, which TypeScript 6 deprecates (still allowed) and TypeScript 7 removes.
const version = spawnSync(process.execPath, [tsc, "-v"], { encoding: "utf8" }).stdout.match(/Version (\d+)/)
const major = version ? Number(version[1]) : 5
if (major >= 7) throw new Error("This build needs TypeScript 5 or 6 (the CommonJS pass relies on moduleResolution node10).")
run(["--module", "commonjs", "--moduleResolution", "node10", "--ignoreDeprecations", major >= 6 ? "6.0" : "5.0", "--outDir", "dist/cjs"])
writeFileSync(join(dist, "esm/package.json"), '{"type":"module"}\n')
writeFileSync(join(dist, "cjs/package.json"), '{"type":"commonjs"}\n')

// ESM output keeps TypeScript's extensionless relative specifiers; Node's ESM loader needs the extension.
const walk = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p, out) : out.push(p) } return out }
let fixed = 0
for (const file of walk(join(dist, "esm")).filter((f) => f.endsWith(".js"))) {
  const text = readFileSync(file, "utf8")
  const next = text.replace(/(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (m, pre, q, spec) => {
    if (/\.(js|json|mjs|cjs)$/.test(spec)) return m
    const target = resolve(dirname(file), spec)
    const withExt = existsSync(target + ".js") ? spec + ".js" : existsSync(join(target, "index.js")) ? spec + "/index.js" : null
    if (!withExt) throw new Error(`cannot resolve ${spec} from ${file}`)
    fixed++
    return `${pre}${q}${withExt}${q}`
  })
  if (next !== text) writeFileSync(file, next)
}
console.log(`built @clinexia/core: dist/esm, dist/cjs, dist/types (${fixed} import specifiers fixed for Node ESM)`)
