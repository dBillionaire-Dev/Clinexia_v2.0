// clinexia-upgrade:phase2 tests — patient context safety. The important ones are about NOT carrying data over.
import { describe, expect, it } from "vitest"
import { getCalculatorById } from "../calculators/registry"
import { IDLE_EXPIRY_MS, STALE_AFTER_MS, STORAGE_KEY, createContextStore, type StorageLike } from "./patient-context"

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}
function setup() {
  const storage = memory()
  let now = Date.UTC(2026, 9, 25, 9, 0, 0)
  const store = createContextStore(storage, () => now, (() => { let n = 0.1; return () => (n = (n * 7.13) % 1) })())
  return { storage, store, advance: (ms: number) => (now += ms) }
}
const crcl = getCalculatorById("creatinine-clearance")!

describe("patient context", () => {
  it("starts empty and offers nothing", () => {
    const { store } = setup()
    expect(store.load().entries).toEqual({})
    expect(store.offersFor(crcl)).toEqual([])
  })

  it("saves only what is explicitly saved and offers it with unit and time", () => {
    const { store } = setup()
    expect(store.save("weight", "70").ok).toBe(true)
    const offers = store.offersFor(crcl)
    expect(offers).toHaveLength(1)
    expect(offers[0]).toMatchObject({ key: "weight", inputId: "weight", status: "ready", stale: false })
    expect(offers[0].entry.unit).toBe("kg")
  })

  it("rejects implausible and non-numeric values instead of coercing them", () => {
    const { store } = setup()
    expect(store.save("weight", "7000").ok).toBe(false)
    expect(store.save("age", "forty").ok).toBe(false)
    expect(store.save("age", "0x28").ok).toBe(false)
    expect(store.save("sex", "unknown").ok).toBe(false)
    expect(store.load().entries).toEqual({})
  })

  it("NEW PATIENT removes every value and changes the context id (no carry-over)", () => {
    const { store } = setup()
    store.save("age", "54"); store.save("weight", "70"); store.save("creatinine", "1.2"); store.save("sex", "male")
    const before = store.load().contextId
    const fresh = store.clearAll()
    expect(fresh.entries).toEqual({})
    expect(fresh.contextId).not.toBe(before)
    expect(store.load().entries).toEqual({})
    expect(store.offersFor(crcl)).toEqual([])
  })

  it("expires after 30 minutes idle so the next person at a shared device starts clean", () => {
    const { store, advance } = setup()
    store.save("weight", "70")
    const id = store.load().contextId
    advance(IDLE_EXPIRY_MS + 1000)
    const after = store.load()
    expect(after.entries).toEqual({})
    expect(after.contextId).not.toBe(id)
  })

  it("activity within the idle window keeps the values", () => {
    const { store, advance } = setup()
    store.save("weight", "70")
    advance(IDLE_EXPIRY_MS - 60_000)
    store.touch(store.load())
    advance(IDLE_EXPIRY_MS - 60_000)
    expect(store.load().entries.weight?.value).toBe("70")
  })

  it("flags values older than 24 hours for re-confirmation, but does not hide or change them", () => {
    const { store, advance } = setup()
    store.save("creatinine", "1.4")
    // keep the session alive while time passes
    for (let i = 0; i < 50; i += 1) { advance(STALE_AFTER_MS / 49); store.touch(store.load()) }
    const o = store.offersFor(crcl).find((x) => x.key === "creatinine")!
    expect(o.stale).toBe(true)
    expect(o.entry.value).toBe("1.4")
  })

  it("does not offer a value to an input with a different unit (no silent conversion)", () => {
    const { store } = setup()
    store.save("creatinine", "1.2")
    const gfr = { ...crcl, inputs: crcl.inputs.map((i) => (i.id === "creatinine" ? { ...i, unit: "µmol/L" } : i)) }
    const offer = store.offersFor(gfr)[0]
    expect(offer.status).toBe("unit-mismatch")
    expect(offer.reason).toMatch(/µmol\/L/)
  })

  it("never maps age onto a yes/no select named age (HAS-BLED)", () => {
    const { store } = setup()
    store.save("age", "70")
    expect(store.offersFor(getCalculatorById("has-bled")!)).toEqual([])
  })

  it("never maps urine creatinine or other look-alike fields", () => {
    const { store } = setup()
    store.save("creatinine", "1.2")
    const fena = getCalculatorById("fena")!
    expect(store.offersFor(fena).map((o) => o.inputId)).not.toContain("urineCr")
  })

  it("candidates for saving come only from exact id/kind/unit matches that are filled in", () => {
    const { store } = setup()
    const c = store.candidatesFrom(crcl, { age: "54", weight: "", creatinine: "1.2", sex: "male" })
    expect(c.map((x) => x.key).sort()).toEqual(["age", "creatinine", "sex"])
  })

  it("survives corrupt storage by starting empty", () => {
    const { store, storage } = setup()
    storage.setItem(STORAGE_KEY, "{not json")
    expect(store.load().entries).toEqual({})
  })

  it("two patients in a row never see each other's values", () => {
    const { store } = setup()
    store.save("weight", "92"); store.save("creatinine", "2.1")
    store.clearAll()
    store.save("weight", "58")
    const keys = store.offersFor(crcl).map((o) => `${o.key}=${o.entry.value}`)
    expect(keys).toEqual(["weight=58"])
  })

  it("stores no identifying fields", () => {
    const { store, storage } = setup()
    store.save("age", "54"); store.save("weight", "70")
    const raw = storage.getItem(STORAGE_KEY)!
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["contextId", "entries", "lastActivityAt"])
    expect(Object.keys(JSON.parse(raw).entries).sort()).toEqual(["age", "weight"])
  })
})

