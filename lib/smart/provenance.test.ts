import { describe, expect, it } from "vitest"
import { getCalculatorById } from "@clinexia/core"
import { buildPrefillFragment, noticeLines, parseSmartProvenance } from "./provenance"
import type { MappedValue } from "./mapping"

const TODAY = new Date(Date.UTC(2026, 9, 26, 12))
const mv = (o: Partial<MappedValue> & { inputId: string; value: string }): MappedValue => ({ source: "observation", stale: false, converted: false, ...o })

describe("fragment (never sent to a server)", () => {
  const values = [mv({ inputId: "age", value: "54", source: "patient" }), mv({ inputId: "creatinine", value: "0.995456", observedAt: "2026-09-10" })]

  it("carries the values, the SMART marker and where each came from", () => {
    const p = new URLSearchParams(buildPrefillFragment(values))
    expect(p.get("age")).toBe("54")
    expect(p.get("creatinine")).toBe("0.995456")
    expect(p.get("from")).toBe("smart")
    expect(p.get("src_age")).toBe("patient")
    expect(p.get("src_creatinine")).toBe("2026-09-10")
    expect(p.get("calculate")).toBeNull() // a calculation is never started automatically from a record
  })
  it("round-trips", () => {
    const prov = parseSmartProvenance(new URLSearchParams(buildPrefillFragment(values)))
    expect(prov).toEqual({ fromSmart: true, sources: { age: "patient", creatinine: "2026-09-10" } })
  })
  it("ignores anything not from SMART, and malformed sources", () => {
    expect(parseSmartProvenance(new URLSearchParams("src_age=patient"))).toEqual({ fromSmart: false, sources: {} })
    const prov = parseSmartProvenance(new URLSearchParams("from=smart&src_age=banana&src_creatinine=2026-13-45x&src_bad id=patient&src_ok=2026-01-02&src_weight=patient"))
    expect(prov.sources).toEqual({ ok: "2026-01-02", weight: "patient" })
  })
})

describe("noticeLines (what the calculator page shows)", () => {
  const def = getCalculatorById("creatinine-clearance")!
  it("shows the date, the age of each result and a warning when stale", () => {
    const prov = { fromSmart: true, sources: { creatinine: "2026-09-10", weight: "2026-10-20", age: "patient" } }
    const lines = noticeLines(def, prov, ["creatinine", "weight", "age"], TODAY)
    const by = Object.fromEntries(lines.map((l) => [l.inputId, l]))
    expect(by.creatinine).toMatchObject({ from: "observation", observedAt: "2026-09-10", ageDays: 46, stale: true, staleAfterDays: 30 })
    expect(by.weight).toMatchObject({ ageDays: 6, stale: false })
    expect(by.age).toMatchObject({ from: "patient", stale: false })
  })
  it("lists only inputs that were actually filled in, in the form's order", () => {
    const prov = { fromSmart: true, sources: { creatinine: "2026-10-20", weight: "2026-10-20" } }
    expect(noticeLines(def, prov, ["weight"], TODAY).map((l) => l.inputId)).toEqual(["weight"])
    expect(noticeLines(def, prov, ["weight", "creatinine"], TODAY).map((l) => l.inputId)).toEqual(["weight", "creatinine"].sort((a, b) => def.inputs.findIndex((i) => i.id === a) - def.inputs.findIndex((i) => i.id === b)))
  })
  it("honours configured thresholds", () => {
    const prov = { fromSmart: true, sources: { creatinine: "2026-10-16" } }
    expect(noticeLines(def, prov, ["creatinine"], TODAY, { creatinineDays: 7, heightDays: 365, otherDays: 90 })[0].stale).toBe(true)
  })
})
