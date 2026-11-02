// clinexia-upgrade:phase8 — records a clinician's approval in the right review register.
//
//   node scripts/approve-clinical.mjs list
//   node scripts/approve-clinical.mjs approve <key> --reviewer "Full Name" --credentials "MD, Cardiology" \
//        --date 2026-11-02 --scope "What exactly you reviewed" [--notes "optional"]
//   node scripts/approve-clinical.mjs revoke <key>
//
// It only edits text in the register files. It cannot know whether the content is correct: the person named as reviewer
// must really have reviewed it. Keys look like  has-bled:bands  emergency-doses  patient:bmi  qsofa  ldl-sampson ...
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const calc = fs.existsSync(path.join(root, "packages/core/src/calculators/registry.ts")) ? "packages/core/src/calculators" : "lib/calculators"
const FILES = ["lib/clinical/review.ts", `${calc}/clinical-modules/review.ts`].filter((f) => fs.existsSync(path.join(root, f)))
if (FILES.length === 0) { console.error("No review register found. Run this from the repository root."); process.exit(1) }

const [cmd, key, ...rest] = process.argv.slice(2)
const flags = {}
for (let i = 0; i < rest.length; i += 2) { if (!rest[i]?.startsWith("--")) { console.error(`Unexpected argument: ${rest[i]}`); process.exit(1) } flags[rest[i].slice(2)] = rest[i + 1] }
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\@PHASE_BODY@")
const q = (s) => JSON.stringify(s)
const read = (f) => fs.readFileSync(path.join(root, f), "utf8")

const pendingRe = (k) => new RegExp(`^([ \\t]*)(["']?${esc(k)}["']?)\\s*:\\s*\\{\\s*status:\\s*"pending"\\s*\\}(,?)`, "m")
const approvedRe = (k) => new RegExp(`^([ \\t]*)(["']?${esc(k)}["']?)\\s*:\\s*\\{[^}]*status:\\s*"approved"[^}]*\\}(,?)`, "m")
const allKeys = () => FILES.flatMap((f) => [...read(f).matchAll(/^[ \t]*["']?([\w:.-]+)["']?\s*:\s*\{[^}]*status:\s*"(pending|approved)"/gm)].map((m) => ({ file: f, key: m[1], status: m[2] })))

if (cmd === "list") {
  for (const r of allKeys()) console.log(`${r.status === "approved" ? "APPROVED" : "pending "}  ${r.key.padEnd(34)} ${r.file}`)
  process.exit(0)
}
if (!["approve", "revoke"].includes(cmd) || !key) { console.error("Usage: approve-clinical.mjs list | approve <key> --reviewer ... | revoke <key>"); process.exit(1) }

const hits = FILES.filter((f) => pendingRe(key).test(read(f)) || approvedRe(key).test(read(f)))
if (hits.length !== 1) { console.error(hits.length === 0 ? `No review record named "${key}". Run: node scripts/approve-clinical.mjs list` : `"${key}" appears in more than one register: ${hits.join(", ")}`); process.exit(1) }
const file = hits[0]; let text = read(file)

if (cmd === "revoke") {
  if (!approvedRe(key).test(text)) { console.error(`"${key}" is not approved.`); process.exit(1) }
  text = text.replace(approvedRe(key), (_, ind, k, comma) => `${ind}${k}: { status: "pending" }${comma}`)
  fs.writeFileSync(path.join(root, file), text); console.log(`Reverted ${key} to pending in ${file}. The content is hidden again.`); process.exit(0)
}

const bad = []
const need = (n, min) => { if (!flags[n] || flags[n].trim().length < min) bad.push(`--${n} is required (at least ${min} characters)`) }
need("reviewer", 3); need("credentials", 2); need("scope", 12)
if (!/^\d{4}-\d{2}-\d{2}$/.test(flags.date ?? "") || Number.isNaN(Date.parse(flags.date))) bad.push("--date must be a real date as YYYY-MM-DD")
else if (Date.parse(flags.date) > Date.now() + 864e5) bad.push("--date is in the future")
if (bad.length) { console.error(bad.map((b) => "  - " + b).join("\n")); process.exit(1) }
if (approvedRe(key).test(text)) { console.error(`"${key}" is already approved. Revoke it first if the content changed and needs a new review.`); process.exit(1) }

text = text.replace(pendingRe(key), (_, ind, k, comma) => {
  const lines = [`${ind}${k}: {`, `${ind}  status: "approved",`, `${ind}  reviewer: ${q(flags.reviewer.trim())},`, `${ind}  credentials: ${q(flags.credentials.trim())},`, `${ind}  reviewedAt: ${q(flags.date)},`, `${ind}  scope: ${q(flags.scope.trim())},`]
  if (flags.notes) lines.push(`${ind}  notes: ${q(flags.notes.trim())},`)
  lines.push(`${ind}}${comma}`); return lines.join("\n")
})
fs.writeFileSync(path.join(root, file), text)
console.log(`Approved ${key} in ${file} (reviewer: ${flags.reviewer}, ${flags.date}).`)
console.log("Next: run the tests. If this is a calculator tool in clinical-modules, your integration tests will ask for its formula version and test vectors.")
