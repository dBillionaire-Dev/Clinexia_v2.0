// Compares the calculator/formula source files of ANOTHER copy (for example the Capacitor mobile app's) with @clinexia/core and
// reports every file that differs, is missing, or is extra.
//
//   node scripts/check-formula-drift.mjs <path-to-mobile-calculators-folder> [--conversions <path-to-mobile-conversions-folder>]
//                                        [--ignore-imports] [--json]
//
// <path...> is the folder in the mobile repo that corresponds to lib/calculators (and optionally lib/conversions): the one that
// contains registry.ts, types.ts and definitions/. Files are compared after normalising line endings and trailing whitespace.
// --ignore-imports also ignores single-line import / export-from lines, useful when the other copy uses different import paths.
// Test files and the generated vector data are not compared.
// Exit code: 0 identical, 1 drift found, 2 usage error.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const coreSrc = resolve(here, "..", "packages/core/src")

const walk = (d, out = []) => {
  for (const n of readdirSync(d)) {
    if (n === "node_modules" || n === ".git") continue
    const p = join(d, n)
    statSync(p).isDirectory() ? walk(p, out) : out.push(p)
  }
  return out
}
const compared = (rel) => /\.(ts|tsx)$/.test(rel) && !/\.test\.tsx?$/.test(rel) && !/test-vector-data\.ts$/.test(rel)

export function normalise(text, { ignoreImports = false } = {}) {
  let lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/g, ""))
  if (ignoreImports) lines = lines.filter((l) => !/^\s*(import\b.*\bfrom\b|export\s+\*\s+from\b|export\s+\{[^}]*\}\s+from\b)/.test(l))
  return lines.join("\n").replace(/\n+$/g, "") + "\n"
}

function firstDifference(a, b) {
  const x = a.split("\n"), y = b.split("\n")
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return { line: i + 1, web: x[i] ?? "(end of file)", other: y[i] ?? "(end of file)" }
  return null
}

/** Compares one folder pair. Returns { identical, differing, onlyInWeb, onlyInOther }. */
export function compareFolders(webDir, otherDir, opts = {}) {
  const list = (d) => new Map(walk(d).map((p) => [relative(d, p).split(sep).join("/"), p]).filter(([rel]) => compared(rel)))
  const web = list(webDir), other = list(otherDir)
  const identical = [], differing = [], onlyInWeb = [], onlyInOther = []
  for (const [rel, wp] of web) {
    const op = other.get(rel)
    if (!op) { onlyInWeb.push(rel); continue }
    const a = normalise(readFileSync(wp, "utf8"), opts), b = normalise(readFileSync(op, "utf8"), opts)
    if (a === b) identical.push(rel)
    else differing.push({ file: rel, ...firstDifference(a, b), webLines: a.split("\n").length - 1, otherLines: b.split("\n").length - 1 })
  }
  for (const rel of other.keys()) if (!web.has(rel)) onlyInOther.push(rel)
  return { identical: identical.sort(), differing: differing.sort((p, q) => p.file.localeCompare(q.file)), onlyInWeb: onlyInWeb.sort(), onlyInOther: onlyInOther.sort() }
}

const clip = (s) => (s.length > 110 ? s.slice(0, 107) + "..." : s)

function report(title, r) {
  console.log(`\n== ${title}`)
  console.log(`   identical: ${r.identical.length}   differing: ${r.differing.length}   only in web: ${r.onlyInWeb.length}   only in other copy: ${r.onlyInOther.length}`)
  for (const d of r.differing) {
    console.log(`\n   DIFFERS  ${d.file}  (web ${d.webLines} lines, other ${d.otherLines} lines)`)
    console.log(`     first difference at line ${d.line}:`)
    console.log(`       web   : ${clip(d.web)}`)
    console.log(`       other : ${clip(d.other)}`)
  }
  for (const f of r.onlyInWeb) console.log(`   MISSING in other copy  ${f}`)
  for (const f of r.onlyInOther) console.log(`   EXTRA in other copy    ${f}`)
}

function main(argv) {
  const args = argv.slice(2)
  const opts = { ignoreImports: args.includes("--ignore-imports") }
  const json = args.includes("--json")
  const ci = args.indexOf("--conversions")
  const convPath = ci >= 0 ? args[ci + 1] : null
  const positional = args.filter((a, i) => !a.startsWith("--") && i !== ci + 1)
  if (positional.length !== 1 || (ci >= 0 && !convPath)) {
    console.error("usage: node scripts/check-formula-drift.mjs <mobile calculators folder> [--conversions <mobile conversions folder>] [--ignore-imports] [--json]")
    return 2
  }
  const pairs = [["calculators", join(coreSrc, "calculators"), resolve(positional[0])]]
  if (convPath) pairs.push(["conversions", join(coreSrc, "conversions"), resolve(convPath)])
  for (const [, , other] of pairs) if (!existsSync(other) || !statSync(other).isDirectory()) { console.error(`not a folder: ${other}`); return 2 }

  const results = pairs.map(([name, web, other]) => ({ name, ...compareFolders(web, other, opts) }))
  if (json) console.log(JSON.stringify(results, null, 2))
  else {
    for (const r of results) report(r.name, r)
    console.log(
      "\nNote: this compares source text. A formula copied and reformatted shows as DIFFERS; identical text can still behave differently if the other copy's helpers differ. After migrating, run the vector check in docs/integration/mobile-migration.md.",
    )
  }
  const drift = results.some((r) => r.differing.length || r.onlyInWeb.length || r.onlyInOther.length)
  if (!json) console.log(drift ? "\nRESULT: DRIFT FOUND" : "\nRESULT: no drift: every compared file is identical")
  return drift ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv))
