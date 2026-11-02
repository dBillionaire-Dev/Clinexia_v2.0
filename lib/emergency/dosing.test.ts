// clinexia-upgrade:phase6 tests. Every expected number is worked out by hand from the AHA 2025 text quoted in
// dose-data.ts (tolerance: exact after display rounding). These tests guard arithmetic, caps and wording.
// They are NOT a clinical review of the dose data.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildDashboard, checkWeight, fmt } from "./dosing"
import { EMERGENCY_SOURCES, PEDIATRIC } from "./dose-data"
import { isReleased } from "../clinical/review"

const line = (group: "neonate" | "pediatric" | "adult", w: number | null, id: string) => {
  const d = buildDashboard(group, w)
  if (!d.ok) throw new Error(d.error)
  const found = d.lines.find((l) => l.id === id)
  if (!found) throw new Error("missing " + id)
  return found
}

describe("pediatric (20 kg)", () => {
  it("epinephrine 0.01 mg/kg = 0.2 mg = 2 mL of 0.1 mg/mL", () => {
    const l = line("pediatric", 20, "ped-epi")
    expect(l.headline).toBe("0.2 mg")
    expect(l.detail).toContain("2 mL of 0.1 mg/mL")
  })
  it("amiodarone 5 mg/kg = 100 mg (below both caps)", () => {
    const l = line("pediatric", 20, "ped-amio")
    expect(l.headline).toBe("100 mg")
    expect(l.detail).toContain("100 mg")
  })
  it("atropine 0.02 mg/kg = 0.4 mg, listed under bradycardia and not under cardiac arrest", () => {
    const l = line("pediatric", 20, "ped-atro")
    expect(l.headline).toBe("0.4 mg")
    expect(l.section).toBe("Bradycardia with a pulse")
  })
  it("defibrillation 2 J/kg, 4 J/kg, max 10 J/kg", () => {
    const l = line("pediatric", 20, "ped-defib")
    expect(l.headline).toBe("40 J first")
    expect(l.detail).toContain("80 J second")
    expect(l.repeat).toContain("200 J")
  })
})

describe("pediatric caps and minimums are applied and announced", () => {
  it("epinephrine is capped at 1 mg (100 kg would be 1 mg exactly; 150 kg would be 1.5 mg)", () => {
    expect(line("pediatric", 100, "ped-epi").headline).toBe("1 mg")
    const l = line("pediatric", 150, "ped-epi")
    expect(l.headline).toBe("1 mg")
    expect(l.notes.join(" ")).toMatch(/Capped at the 1 mg maximum/)
  })
  it("amiodarone first dose capped at 300 mg, later doses at 150 mg (80 kg: 400 mg calculated)", () => {
    const l = line("pediatric", 80, "ped-amio")
    expect(l.headline).toBe("300 mg")
    expect(l.detail).toContain("150 mg")
    expect(l.notes.join(" ")).toMatch(/Capped/)
  })
  it("atropine below 0.1 mg is raised to 0.1 mg (3 kg: 0.06 mg calculated) and says so", () => {
    const l = line("pediatric", 3, "ped-atro")
    expect(l.headline).toBe("0.1 mg")
    expect(l.notes.join(" ")).toMatch(/Raised to the 0\.1 mg minimum/)
  })
  it("atropine above 0.5 mg is capped at 0.5 mg (60 kg: 1.2 mg calculated)", () => {
    expect(line("pediatric", 60, "ped-atro").headline).toBe("0.5 mg")
  })
  it("no dose line ever exceeds its published cap, at any allowed weight", () => {
    for (let w = 2; w <= 150; w += 0.5) {
      const d = buildDashboard("pediatric", w)
      if (!d.ok) throw new Error("unexpected")
      const mg = (id: string) => Number(d.lines.find((l) => l.id === id)!.headline.split(" ")[0])
      expect(mg("ped-epi")).toBeLessThanOrEqual(1)
      expect(mg("ped-amio")).toBeLessThanOrEqual(300)
      const atro = mg("ped-atro")
      expect(atro).toBeGreaterThanOrEqual(0.1)
      expect(atro).toBeLessThanOrEqual(0.5)
    }
  })
})

describe("neonate", () => {
  it("3 kg: epinephrine 0.01 to 0.03 mg/kg = 0.03 to 0.09 mg = 0.3 to 0.9 mL; start 0.02 mg/kg = 0.06 mg = 0.6 mL", () => {
    const l = line("neonate", 3, "neo-epi-iv")
    expect(l.headline).toBe("0.03 to 0.09 mg")
    expect(l.detail).toContain("0.3 to 0.9 mL")
    expect(l.detail).toContain("0.06 mg = 0.6 mL")
  })
  it("3 kg endotracheal: 0.05 to 0.1 mg/kg = 0.15 to 0.3 mg = 1.5 to 3 mL", () => {
    const l = line("neonate", 3, "neo-epi-et")
    expect(l.headline).toBe("0.15 to 0.3 mg")
    expect(l.detail).toContain("1.5 to 3 mL")
  })
  it("offers epinephrine only: no amiodarone, atropine, lidocaine or shock energy", () => {
    const d = buildDashboard("neonate", 3)
    if (!d.ok) throw new Error("unexpected")
    expect(d.lines.map((l) => l.drug.split(" ")[0])).toEqual(["Epinephrine", "Epinephrine"])
    expect(d.warnings.join(" ")).toMatch(/only medication/)
  })
  it("warns never to use 1 mg/mL epinephrine", () => {
    expect(line("neonate", 3, "neo-epi-iv").notes.join(" ")).toMatch(/Never give 1 mg\/mL/)
  })
})

describe("adult", () => {
  it("fixed doses without a weight", () => {
    const d = buildDashboard("adult", null)
    if (!d.ok) throw new Error("unexpected")
    expect(d.lines.find((l) => l.id === "adult-epi")!.headline).toBe("1 mg")
    expect(d.lines.find((l) => l.id === "adult-amio")!.headline).toBe("300 mg first")
    expect(d.lines.find((l) => l.id === "adult-atro")!.headline).toBe("1 mg")
    expect(d.lines.some((l) => l.id === "adult-lido")).toBe(false)
  })
  it("lidocaine is weight-based and appears only with a weight (70 kg: 70 to 105 mg, then 35 to 52.5 mg)", () => {
    const l = line("adult", 70, "adult-lido")
    expect(l.headline).toBe("70 to 105 mg first")
    expect(l.detail).toContain("35 to 52.5 mg")
  })
  it("states the atropine maximum total of 3 mg", () => {
    expect(line("adult", null, "adult-atro").repeat).toContain("3 mg")
  })
})

describe("weight handling: never guess", () => {
  it.each([[null], [Number.NaN], [0], [-5], [Number.POSITIVE_INFINITY]])("pediatric weight %s gives no doses", (w) => {
    expect(buildDashboard("pediatric", w as number | null).ok).toBe(false)
  })
  it("an implausible weight for the age group gives no doses and names the range", () => {
    const d = buildDashboard("neonate", 70)
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.error).toMatch(/0\.3 to 10 kg/)
  })
  it("a switch of age group re-checks the same weight", () => {
    expect(checkWeight("pediatric", 70).ok).toBe(true)
    expect(checkWeight("neonate", 70).ok).toBe(false)
  })
  it("fmt trims floating-point noise", () => {
    expect(fmt(0.1 + 0.2)).toBe("0.3")
    expect(fmt(0.060000001)).toBe("0.06")
  })
})

describe("data integrity", () => {
  it("every line cites sources that exist and has a route and a repeat instruction", () => {
    for (const [g, w] of [["neonate", 3], ["pediatric", 20], ["adult", 70]] as const) {
      const d = buildDashboard(g, w)
      if (!d.ok) throw new Error("unexpected")
      for (const l of d.lines) {
        expect(l.route.length, l.id).toBeGreaterThan(0)
        expect(l.repeat.length, l.id).toBeGreaterThan(0)
        for (const s of l.sourceIds) expect(EMERGENCY_SOURCES[s], `${l.id} source ${s}`).toBeDefined()
      }
    }
  })
  it("source links are https", () => {
    for (const s of EMERGENCY_SOURCES) expect(s.url).toMatch(/^https:\/\//)
  })
  it("pins the verified constants so a silent edit fails a test", () => {
    expect(PEDIATRIC.epinephrine.mgPerKg).toBe(0.01)
    expect(PEDIATRIC.amiodarone.mgPerKg).toBe(5)
    expect(PEDIATRIC.atropine.mgPerKg).toBe(0.02)
  })
})

describe("release gate", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", ""))
  afterEach(() => vi.unstubAllEnvs())
  it("is hidden until a clinician approves it", () => expect(isReleased("emergency-doses")).toBe(false))
  it("shows in preview builds only", () => {
    vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", "1")
    expect(isReleased("emergency-doses")).toBe(true)
  })
})
