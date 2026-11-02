// clinexia-upgrade:phase10 tests — every expected number is worked out by hand from sheets-data.ts and its sources.
// They guard arithmetic, caps and wording. They are NOT a clinical review of the doses.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SHEETS, buildSheet, releasedSheets, type SheetId } from "./sheets"
import { SHEET_SOURCES, SEIZURE, TACHYCARDIA, ANAPHYLAXIS, SHOCK_FLUIDS } from "./sheets-data"
import { CLINICAL_REVIEWS, isReleased } from "../clinical/review"

const line = (id: SheetId, w: number, lineId: string) => {
  const r = buildSheet(id, w); if (!r.ok) throw new Error(r.error)
  const l = r.lines.find((x) => x.id === lineId); if (!l) throw new Error("missing " + lineId); return l
}

describe("tachycardia (20 kg and 80 kg)", () => {
  it("adenosine 0.1 then 0.2 mg/kg = 2 mg then 4 mg", () => { const l = line("tachycardia", 20, "tach-adenosine"); expect(l.headline).toBe("2 mg first"); expect(l.detail).toContain("4 mg") })
  it("adenosine is capped at 6 mg and 12 mg (80 kg would be 8 and 16 mg) and says so", () => {
    const l = line("tachycardia", 80, "tach-adenosine")
    expect(l.headline).toBe("6 mg first"); expect(l.detail).toContain("12 mg")
    expect(l.notes.join(" ")).toMatch(/First dose capped at 6 mg/); expect(l.notes.join(" ")).toMatch(/Second dose capped at 12 mg/)
  })
  it("cardioversion 0.5 to 1 J/kg then 2 J/kg = 10 to 20 J then 40 J", () => { const l = line("tachycardia", 20, "tach-cardioversion"); expect(l.headline).toBe("10 to 20 J"); expect(l.detail).toContain("40 J") })
  it("amiodarone 5 mg/kg = 100 mg over 20 to 60 minutes; procainamide 15 mg/kg = 300 mg over 30 to 60 minutes", () => {
    expect(line("tachycardia", 20, "tach-amiodarone").headline).toBe("100 mg"); expect(line("tachycardia", 20, "tach-amiodarone").detail).toContain("20 to 60")
    expect(line("tachycardia", 20, "tach-procainamide").headline).toBe("300 mg"); expect(line("tachycardia", 20, "tach-procainamide").detail).toContain("30 to 60")
  })
  it("states that no maximum exists in the source for amiodarone and procainamide, instead of inventing one", () => {
    for (const id of ["tach-amiodarone", "tach-procainamide"]) expect(line("tachycardia", 100, id).notes.join(" ")).toMatch(/no maximum dose/)
  })
})

describe("shock fluids (20 kg)", () => {
  it("10 and 20 mL/kg = 200 and 400 mL; total to 60 mL/kg = 1200 mL; limited-resource 40 mL/kg = 800 mL", () => {
    const l = line("shock-fluids", 20, "fluid-bolus")
    expect(l.headline).toBe("200 to 400 mL"); expect(l.notes.join(" ")).toContain("1200 mL"); expect(l.notes.join(" ")).toContain("800 mL")
  })
  it("always says to reassess after every bolus", () => expect(line("shock-fluids", 20, "fluid-bolus").repeat).toMatch(/Reassess after EVERY bolus/))
  it("includes no vasoactive infusion rate", () => expect(JSON.stringify(buildSheet("shock-fluids", 20))).not.toMatch(/mcg\/kg\/min/))
})

describe("anaphylaxis", () => {
  it("20 kg: 0.01 mg/kg = 0.2 mg = 0.2 mL of 1 mg/mL", () => { const l = line("anaphylaxis", 20, "ana-epi"); expect(l.headline).toBe("0.2 mg"); expect(l.detail).toBe("0.2 mL of 1 mg/mL") })
  it("30 kg is exactly 0.3 mg; 40 kg is capped at 0.3 mg and says so", () => {
    expect(line("anaphylaxis", 30, "ana-epi").headline).toBe("0.3 mg")
    const l = line("anaphylaxis", 40, "ana-epi"); expect(l.headline).toBe("0.3 mg"); expect(l.notes.join(" ")).toMatch(/Capped at the 0\.3 mg maximum/)
  })
  it("warns never to use the 0.1 mg/mL cardiac-arrest strength IM", () => expect(line("anaphylaxis", 20, "ana-epi").notes.join(" ")).toMatch(/Do NOT use the 0\.1 mg\/mL/))
  it("repeat interval is 5 to 15 minutes", () => expect(line("anaphylaxis", 20, "ana-epi").repeat).toBe("Every 5 to 15 minutes if needed"))
})

describe("seizure", () => {
  it("20 kg: lorazepam 2 mg; diazepam IV 3 to 4 mg; midazolam IM 5 mg; rectal diazepam 4 to 10 mg", () => {
    expect(line("seizure", 20, "sz-lorazepam").headline).toBe("2 mg")
    expect(line("seizure", 20, "sz-diazepam-iv").headline).toBe("3 to 4 mg")
    expect(line("seizure", 20, "sz-midazolam").headline).toBe("5 mg")
    expect(line("seizure", 20, "sz-diazepam-rectal").headline).toBe("4 to 10 mg")
  })
  it("midazolam bands: 13 kg and 40 kg are 5 mg; 41 kg is 10 mg; 12 kg has no fixed dose", () => {
    expect(line("seizure", 13, "sz-midazolam").headline).toBe("5 mg"); expect(line("seizure", 40, "sz-midazolam").headline).toBe("5 mg")
    expect(line("seizure", 41, "sz-midazolam").headline).toBe("10 mg"); expect(line("seizure", 12, "sz-midazolam").headline).toBe("No fixed IM dose")
  })
  it("caps: 80 kg lorazepam 4 mg (8 calculated), diazepam IV 10 mg to 10 mg (12 to 16 calculated), rectal 16 to 20 mg", () => {
    expect(line("seizure", 80, "sz-lorazepam").headline).toBe("4 mg")
    expect(line("seizure", 80, "sz-diazepam-iv").headline).toBe("10 to 10 mg")
    expect(line("seizure", 80, "sz-diazepam-rectal").headline).toBe("16 to 20 mg")
  })
  it("never exceeds a published cap at any allowed weight", () => {
    for (let w = 2; w <= 150; w += 0.5) {
      const mg = (id: string) => Number(line("seizure", w, id).headline.split(" ").filter((t) => /^[\d.]+$/.test(t)).pop())
      expect(mg("sz-lorazepam")).toBeLessThanOrEqual(SEIZURE.lorazepamIv.maxMg)
      expect(mg("sz-diazepam-iv")).toBeLessThanOrEqual(SEIZURE.diazepamIv.maxMg)
      expect(mg("sz-diazepam-rectal")).toBeLessThanOrEqual(SEIZURE.diazepamRectal.maxMg)
      const a = Number(line("tachycardia", w, "tach-adenosine").headline.split(" ")[0]); expect(a).toBeLessThanOrEqual(TACHYCARDIA.adenosine.firstMaxMg)
      expect(Number(line("anaphylaxis", w, "ana-epi").headline.split(" ")[0])).toBeLessThanOrEqual(ANAPHYLAXIS.maxMgChild)
    }
  })
})

describe("weight handling and data integrity", () => {
  it.each([[null], [0], [-3], [Number.NaN], [1], [500]])("weight %s gives no sheet", (w) => { for (const s of SHEETS) expect(buildSheet(s.id, w as number | null).ok, s.id).toBe(false) })
  it("every line has a route, a repeat instruction and existing https sources", () => {
    for (const s of SHEETS) { const r = buildSheet(s.id, 20); if (!r.ok) throw new Error("x"); for (const l of r.lines) { expect(l.route.length, l.id).toBeGreaterThan(0); expect(l.repeat.length, l.id).toBeGreaterThan(0); for (const i of l.sourceIds) expect(SHEET_SOURCES[i], `${l.id}:${i}`).toBeDefined() } }
    for (const s of SHEET_SOURCES) expect(s.url).toMatch(/^https:\/\//)
  })
  it("pins the verified constants so a silent edit fails a test", () => {
    expect(TACHYCARDIA.adenosine.firstMgPerKg).toBe(0.1); expect(TACHYCARDIA.adenosine.secondMgPerKg).toBe(0.2)
    expect(ANAPHYLAXIS.mgPerKg).toBe(0.01); expect(SHOCK_FLUIDS.maxTotalMlPerKg).toBe(60); expect(SEIZURE.lorazepamIv.mgPerKg).toBe(0.1)
  })
  it("does not contain doses that were not verified (hypoglycemia dextrose, infusion rates)", () => {
    const all = JSON.stringify(SHEETS.map((s) => buildSheet(s.id, 20)))
    expect(all).not.toMatch(/dextrose|glucose \d|D10/i); expect(all).not.toMatch(/mcg\/kg\/min/)
  })
})

describe("release gate", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", ""))
  afterEach(() => vi.unstubAllEnvs())
  it("every sheet has its own approval record, pending by default, so nothing is shown", () => {
    for (const s of SHEETS) { expect(CLINICAL_REVIEWS[`pediatric-sheets:${s.id}`], s.id).toBeDefined(); expect(isReleased(`pediatric-sheets:${s.id}`)).toBe(false) }
    expect(releasedSheets()).toEqual([])
  })
  it("in preview builds all four are shown", () => { vi.stubEnv("NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES", "1"); expect(releasedSheets().map((s) => s.id).sort()).toEqual(["anaphylaxis", "seizure", "shock-fluids", "tachycardia"]) })
})
