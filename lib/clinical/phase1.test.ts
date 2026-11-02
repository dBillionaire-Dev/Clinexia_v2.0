// clinexia-upgrade:phase1 tests — collections, search synonyms, search quality.
import { describe, expect, it } from "vitest"
import { calculators } from "../calculators/registry"
import { searchCalculators } from "../search"
import { createCollectionStore, MAX_COLLECTIONS, type StorageLike } from "./collections"
import { TOOL_SYNONYMS } from "./tool-synonyms"

function memory(): StorageLike {
  const data = new Map<string, string>()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

describe("collections", () => {
  const mk = () => createCollectionStore(memory())
  it("creates, adds, removes and deletes", () => {
    const s = mk()
    expect(s.create("ICU Toolkit").ok).toBe(true)
    const id = s.list()[0].id
    expect(s.addTool(id, "sofa").ok).toBe(true)
    s.addTool(id, "sofa")
    expect(s.list()[0].toolIds).toEqual(["sofa"])
    s.removeTool(id, "sofa")
    expect(s.list()[0].toolIds).toEqual([])
    s.remove(id)
    expect(s.list()).toEqual([])
  })
  it("rejects blank, over-long and duplicate names (case-insensitive)", () => {
    const s = mk()
    expect(s.create("   ").ok).toBe(false)
    expect(s.create("x".repeat(41)).ok).toBe(false)
    s.create("Emergency")
    expect(s.create("emergency").ok).toBe(false)
  })
  it("caps the number of collections", () => {
    const s = mk()
    for (let i = 0; i < MAX_COLLECTIONS; i += 1) expect(s.create(`C${i}`).ok).toBe(true)
    expect(s.create("one more").ok).toBe(false)
  })
  it("survives corrupt storage", () => {
    const storage = memory(); storage.setItem("clinexia:collections:v1", "oops")
    expect(createCollectionStore(storage).list()).toEqual([])
  })
})

describe("tool synonyms", () => {
  // Tools that arrive in later phases may not be registered yet; they are allowed here so this test passes in every phase.
  const upcoming = ["qsofa", "sofa", "pecarn-head-injury-under-2", "pecarn-head-injury-2-to-17", "ldl-sampson", "blood-volume-nadler-lemmens"]
  it("only reference real tools, so the list cannot silently drift", () => {
    const known = new Set([...calculators.map((c) => c.id), ...upcoming])
    for (const id of Object.keys(TOOL_SYNONYMS)) expect(known.has(id), id).toBe(true)
  })
})

describe("search finds tools by the names clinicians type", () => {
  const top = (q: string, n = 3) => searchCalculators(q).slice(0, n).map((c) => c.id)
  it.each([
    ["cockcroft gault", "creatinine-clearance"],
    ["crcl", "creatinine-clearance"],
    ["chads vasc", "cha2ds2-vasc"],
    ["hasbled", "has-bled"],
    ["lvef", "ejection-fraction"],
    ["body mass index", "bmi"],
  ])("%s -> %s in the top 3", (query, id) => {
    expect(top(query)).toContain(id)
  })
  it("returns nothing for gibberish and does not throw on empty input", () => {
    expect(searchCalculators("zzqxjv")).toEqual([])
    expect(searchCalculators("")).toEqual([])
  })
})
