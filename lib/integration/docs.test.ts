import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { INTENDED_USE_LINE } from "./constants"
import { API_SCOPES } from "@/lib/api/scopes"

/**
 * Keeps the governance documents honest: the files they point at exist, the intended-use line matches the code, the scopes they
 * name are the real ones, and FINDINGS.md still has every section and every decision the brief requires.
 */
const root = process.cwd()
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8")
const DOCS = ["README", "intended-use", "no-phi-by-design", "security", "FINDINGS", "embed", "api", "units-and-coding", "smart-on-fhir", "CHANGELOG", "reference-gaps", "mobile-migration"]

describe("the integration documents exist", () => {
  for (const name of DOCS) it(`docs/integration/${name}.md`, () => expect(existsSync(resolve(root, `docs/integration/${name}.md`))).toBe(true))
  it("the README links every document", () => {
    const readme = read("docs/integration/README.md")
    for (const name of DOCS.filter((n) => n !== "README")) expect(readme, name).toContain(`\`${name}.md\``)
  })
})

describe("every file the governance documents point at exists", () => {
  const PATH = /`((?:[\w.@-]+\/)+[\w.@\[\]-]+\.(?:ts|tsx|mjs|js|md|sql|json|hl7|yml))`/g
  for (const doc of ["README", "no-phi-by-design", "security", "intended-use"]) {
    it(`docs/integration/${doc}.md`, () => {
      const text = read(`docs/integration/${doc}.md`)
      const missing: string[] = []
      for (const m of text.matchAll(PATH)) {
        const ref = m[1]
        // README lives in docs/integration, so its relative links start with ../../ or are bare file names; resolve bare doc names against that folder
        const candidates = [ref, `docs/integration/${ref}`, ref.replace(/^\.\.\/\.\.\//, "")]
        if (!candidates.some((c) => existsSync(resolve(root, c)))) missing.push(ref)
      }
      expect(missing).toEqual([])
    })
  }
})

describe("the intended-use statement", () => {
  const text = read("docs/integration/intended-use.md")
  it("is marked DRAFT for legal and regulatory review", () => {
    expect(text).toMatch(/\*\*DRAFT\. Not approved\. For legal and regulatory review\.\*\*/)
  })
  it("quotes the exact line the product shows", () => {
    expect(text).toContain(INTENDED_USE_LINE)
  })
  it("says it is not a diagnostic device and not a substitute for clinical judgement", () => {
    expect(text).toMatch(/Not a diagnostic device/)
    expect(text).toMatch(/Not a substitute for clinical judgement/)
  })
})

describe("the security and API documents match the code", () => {
  it("name every API scope", () => {
    const security = read("docs/integration/security.md")
    const api = read("docs/integration/api.md")
    for (const scope of API_SCOPES) {
      expect(security, scope).toContain(scope)
      expect(api, scope).toContain(scope)
    }
  })
  it("name the environment variables that control the integration features", () => {
    const all = ["security", "smart-on-fhir", "api", "embed"].map((d) => read(`docs/integration/${d}.md`)).join("\n")
    for (const v of ["EMBED_ALLOWED_ORIGINS", "API_RATE_LIMIT_PER_MINUTE", "CDS_HOOKS_ENABLED", "CDS_HOOKS_SHARED_SECRET", "NEXT_PUBLIC_SMART_CLIENT_ID", "NEXT_PUBLIC_SMART_ALLOWED_ISS"]) expect(all, v).toContain(v)
  })
  it("the no-PHI document warns that a query string reaches server logs", () => {
    const text = read("docs/integration/no-phi-by-design.md")
    expect(text).toMatch(/query. string is part of the request URL/)
    expect(text).toMatch(/fragment/)
  })
  it("the embed guide carries the same warning", () => {
    expect(read("docs/integration/embed.md")).toMatch(/Keeping patient values out of server logs/)
  })
})

describe("FINDINGS.md", () => {
  const text = read("docs/integration/FINDINGS.md")
  it("has every section the brief requires", () => {
    for (const heading of ["Baseline", "UNVERIFIED", "Suspected formula issues", "Reference gaps", "Decisions needed"]) expect(text, heading).toContain(heading)
  })
  it("no longer has placeholder text from earlier phases", () => {
    expect(text).not.toMatch(/_None yet\._|_Filled in by Phase/)
  })
  it("lists every decision the brief asks for", () => {
    const decisions = text.slice(text.indexOf("## Decisions needed (consolidated)"))
    expect(decisions.length).toBeGreaterThan(200)
    for (const needle of [/pricing/i, /licen[cs]e/i, /browser-origin/i, /partner onboarding/i, /regulatory review/i, /data residency/i]) expect(decisions, String(needle)).toMatch(needle)
  })
  it("says plainly what was not run", () => {
    expect(text).toMatch(/not (been )?(run|tried|verified|tested)/i)
  })
})
