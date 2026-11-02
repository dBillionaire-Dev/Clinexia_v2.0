// clinexia-upgrade:phase2 — checks that every source link in lib/clinical/evidence.ts still resolves.
// Run with a network connection:  node scripts/verify-evidence-links.mjs
// A DOI link that redirects (3xx) is normal; 404/410 means the identifier is wrong and must be fixed before release.
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const files = ["lib/clinical/evidence.ts", "lib/clinical/modules/qsofa.ts", "lib/clinical/modules/sofa.ts", "lib/clinical/modules/pecarn.ts"]
const urls = new Set()
for (const f of files) {
  const p = path.join(root, f)
  if (!fs.existsSync(p)) continue
  for (const m of fs.readFileSync(p, "utf8").matchAll(/url:\s*"(https:\/\/[^"]+)"/g)) urls.add(m[1])
}

let bad = 0
for (const url of urls) {
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", headers: { "User-Agent": "clinexia-evidence-check" } })
    if (res.status === 405 || res.status === 403) res = await fetch(url, { method: "GET", redirect: "follow", headers: { "User-Agent": "clinexia-evidence-check" } })
    const ok = res.status < 400
    // Some publishers answer automated checks with 403 even for valid DOIs: treat as "check by hand".
    console.log(`${ok ? "OK    " : res.status === 403 ? "MANUAL" : "BROKEN"} ${res.status} ${url}`)
    if (!ok && res.status !== 403) bad += 1
  } catch (e) {
    console.log(`ERROR  ${url} (${e instanceof Error ? e.message : e})`)
    bad += 1
  }
}
console.log(`\n${urls.size} link(s) checked, ${bad} problem(s).`)
process.exit(bad ? 1 : 0)
