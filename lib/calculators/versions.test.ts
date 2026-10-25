import { describe, expect, it } from "vitest"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { calculators, getCalculatorById } from "./registry"
import { FORMULA_VERSIONS, getFormulaVersion } from "./versions"
import { getFormulaInfo, getReferenceStatus } from "./formula-info"
import { getCalculatorReferences } from "./dosing-references"
import { buildReferenceGapsMarkdown } from "./reference-gaps"
import { formulaVersionFor } from "@/lib/integration/embed-bridge"

const SEMVER = /^\d+\.\d+\.\d+$/

describe("formula versions", () => {
  it("every calculator in the registry has a version (add it to FORMULA_VERSIONS in versions.ts)", () => {
    const missing = calculators.filter((c) => !FORMULA_VERSIONS[c.id]).map((c) => c.id)
    expect(missing, `no formula version for: ${missing.join(", ")}`).toEqual([])
  })

  it("has no version for a calculator that does not exist", () => {
    const ids = new Set(calculators.map((c) => c.id))
    const extra = Object.keys(FORMULA_VERSIONS).filter((id) => !ids.has(id))
    expect(extra, `versions for unknown calculators: ${extra.join(", ")}`).toEqual([])
  })

  it("versions are semver", () => {
    for (const [id, v] of Object.entries(FORMULA_VERSIONS)) expect(SEMVER.test(v), `${id}: ${v}`).toBe(true)
  })

  it("getFormulaVersion returns the version, or undefined for an unknown id", () => {
    expect(getFormulaVersion("creatinine-clearance")).toBe(FORMULA_VERSIONS["creatinine-clearance"])
    expect(getFormulaVersion("nope")).toBeUndefined()
  })

  it("the embed postMessage version is the real formula version (unknown ids are 'unversioned')", () => {
    expect(formulaVersionFor("creatinine-clearance")).toBe(FORMULA_VERSIONS["creatinine-clearance"])
    expect(formulaVersionFor("nope")).toBe("unversioned")
  })
})

describe("reference status", () => {
  it("is the worst status among a calculator's references", () => {
    const def = getCalculatorById("creatinine-clearance")!
    const refs = getCalculatorReferences(def)
    const status = getReferenceStatus(def)
    if (refs.some((r) => r.status === "review-needed")) expect(status).toBe("review-needed")
    else if (refs.every((r) => r.status === "current")) expect(status).toBe("current")
    else expect(status).toBe("supporting")
  })

  it("getFormulaInfo bundles version, status and the existing references", () => {
    const def = getCalculatorById("bmi")!
    const info = getFormulaInfo(def)
    expect(info.id).toBe("bmi")
    expect(info.version).toBe(FORMULA_VERSIONS.bmi)
    expect(info.references).toEqual(getCalculatorReferences(def))
    expect(info.referenceStatus).toBe(getReferenceStatus(def))
  })

  it("every calculator resolves to a known status or none", () => {
    for (const c of calculators) expect([undefined, "current", "supporting", "review-needed"], c.id).toContain(getReferenceStatus(c))
  })
})

describe("docs/integration/reference-gaps.md", () => {
  const file = resolve(process.cwd(), "docs/integration/reference-gaps.md")
  const expected = buildReferenceGapsMarkdown(calculators)

  it("is in sync with the references (regenerate with: pnpm integration:snapshots)", () => {
    if (process.env.UPDATE_REFERENCE_GAPS === "1") {
      writeFileSync(file, expected)
      return
    }
    expect(readFileSync(file, "utf8")).toBe(expected)
  })

  it("lists exactly the calculators whose status is review-needed", () => {
    const listed = calculators.filter((c) => getReferenceStatus(c) === "review-needed").map((c) => c.id)
    for (const id of listed) expect(expected).toContain(`\`${id}\``)
    if (listed.length === 0) expect(expected).toContain("_None.")
  })
})
