#!/usr/bin/env node
// Reads an HL7 v2 ORU^R01 file (or stdin) and writes the message of calculated results to stdout (or --out FILE).
//   node integrations/lis/node/cli.mjs samples/oru-chemistry.hl7 [--out calculated.hl7] [--compare] [--status F]
// It uses the BUILT @clinexia/core (run `pnpm core:build` once). It prints only counts and skip reasons to stderr: never values or identifiers.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { addCalculatedResults, safeSummary } from "./adapter.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--out", "--status"].includes(args[i - 1])))

const dist = resolve(here, "../../../packages/core/dist/esm/index.js")
if (!existsSync(dist)) {
  console.error("@clinexia/core is not built. Run `pnpm core:build` in the repository root first.")
  process.exit(2)
}
const core = await import(pathToFileURL(dist).href)

const input = positional[0] ? readFileSync(positional[0], "utf8") : readFileSync(0, "utf8")
const { oru, report } = addCalculatedResults(core, input, { compare: flag("--compare"), resultStatus: value("--status") ?? "P" })
const summary = safeSummary(report)
console.error(JSON.stringify(summary))
if (!oru) process.exit(summary.errors.length ? 1 : 0)
if (value("--out")) writeFileSync(value("--out"), oru)
else process.stdout.write(oru.replace(/\r/g, "\n"))
