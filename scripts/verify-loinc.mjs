// Checks every LOINC code in lib/calculators/coding-metadata.ts against a LOINC table you download from loinc.org
// (free account; the file is Loinc.csv inside the "LOINC Table File (CSV)" download). It cannot judge meaning for you: it prints
// each code with its official long name so a person can confirm it is the right one, and flags codes that are missing or deprecated.
//
//   node --experimental-strip-types scripts/verify-loinc.mjs path/to/Loinc.csv
//
// Exit code 1 if any code is missing from the table or not ACTIVE.
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"

const csvPath = process.argv[2]
if (!csvPath) { console.error("usage: node --experimental-strip-types scripts/verify-loinc.mjs path/to/Loinc.csv"); process.exit(2) }

function parseCsv(text) {
  const rows = []; let row = [], field = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false } else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = "" }
    else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const rows = parseCsv(readFileSync(csvPath, "utf8"))
const header = rows.shift()
const col = (name) => { const i = header.indexOf(name); if (i < 0) { console.error(`Column ${name} not found in ${csvPath}`); process.exit(2) } return i }
const iNum = col("LOINC_NUM"), iName = col("LONG_COMMON_NAME"), iStatus = col("STATUS")
const table = new Map(rows.filter((r) => r.length > iStatus).map((r) => [r[iNum], { name: r[iName], status: r[iStatus] }]))

const meta = await import(pathToFileURL(resolve("lib/calculators/coding-metadata.ts")).href)
const used = new Map() // code -> where
const add = (code, where) => { if (code) used.set(code, [...(used.get(code) ?? []), where]) }
for (const [calc, inputs] of Object.entries(meta.INPUT_CODING)) for (const [id, c] of Object.entries(inputs)) { add(c.loinc, `${calc}.${id}`); add(c.fhir?.loinc, `${calc}.${id} (fhir)`) }
for (const [calc, c] of Object.entries(meta.RESULT_CODING)) add(c.loinc, `${calc} (result)`)

let bad = 0
for (const [code, where] of [...used.entries()].sort()) {
  const hit = table.get(code)
  if (!hit) { bad++; console.log(`MISSING  ${code}  used by ${[...new Set(where)].join(", ")}`); continue }
  if (hit.status !== "ACTIVE") bad++
  console.log(`${hit.status === "ACTIVE" ? "ok     " : hit.status.padEnd(7)}  ${code.padEnd(9)} ${hit.name}\n           used by ${[...new Set(where)].join(", ")}`)
}
console.log(`\n${used.size} codes checked, ${bad} problem(s). A listed name that does not match what the input or result means is a mistake to fix in coding-metadata.ts.`)
process.exit(bad ? 1 : 0)
