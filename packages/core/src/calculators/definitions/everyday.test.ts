import { describe, expect, it } from "vitest"
import {
  alcoholUnitsCalculator,
  dailyWaterIntakeCalculator,
  estimatedDueDateCalculator,
  estimatedDueDateMs,
  gestationalAgeCalculator,
  gestationDaysFromLmp,
  leanBodyMassCalculator,
  packYearsCalculator,
  targetHeartRateCalculator,
  trimesterLabel,
} from "./everyday"
import { addDays, formatDate, formatIsoDate, parseIsoDate, todayUtcMs, weeksAndDays } from "../date-helpers"

const secondary = (r: { secondary?: { label: string; value: string }[] }, label: string) => r.secondary?.find((s) => s.label === label)?.value
const iso = (ms: number) => formatIsoDate(ms)

describe("date helpers", () => {
  it("parses valid dates and rejects impossible or malformed ones", () => {
    expect(formatIsoDate(parseIsoDate("2025-02-28", "Date"))).toBe("2025-02-28")
    expect(formatIsoDate(parseIsoDate("2024-02-29", "Date"))).toBe("2024-02-29")
    expect(() => parseIsoDate("2025-02-30", "Date")).toThrow()
    expect(() => parseIsoDate("13/01/2025", "Date")).toThrow()
    expect(() => parseIsoDate("", "Date")).toThrow()
    expect(() => parseIsoDate(undefined, "Date")).toThrow()
    expect(() => parseIsoDate("1800-01-01", "Date")).toThrow()
  })
  it("formats a date with fixed wording", () => {
    expect(formatDate(Date.UTC(2026, 9, 12))).toBe("Mon 12 Oct 2026")
  })
  it("formats weeks and days with correct plurals", () => {
    expect(weeksAndDays(0)).toBe("0 weeks 0 days")
    expect(weeksAndDays(8)).toBe("1 week 1 day")
    expect(weeksAndDays(100)).toBe("14 weeks 2 days")
  })
})

describe("dailyWaterIntakeCalculator", () => {
  const run = (age: number, sex: string, status = "none") => dailyWaterIntakeCalculator.calculate({ age, sex, status })
  it("returns the EFSA adequate intake for adults", () => {
    expect(run(30, "male").value).toBe(2500)
    expect(run(30, "female").value).toBe(2000)
    expect(run(30, "male").display).toBe("2.5 L per day")
  })
  it("returns the EFSA values for children", () => {
    expect(run(2, "female").value).toBe(1300)
    expect(run(3, "male").value).toBe(1300)
    expect(run(5, "female").value).toBe(1600)
    expect(run(10, "male").value).toBe(2100)
    expect(run(10, "female").value).toBe(1900)
    expect(run(14, "male").value).toBe(2500)
  })
  it("adds 300 mL in pregnancy and 700 mL when breastfeeding", () => {
    expect(run(28, "female", "pregnant").value).toBe(2300)
    expect(run(28, "female", "lactating").value).toBe(2700)
    expect(secondary(run(28, "female", "pregnant"), "Added for pregnancy")).toBe("+300 mL")
  })
  it("rejects invalid combinations", () => {
    expect(() => run(1, "female")).toThrow()
    expect(() => run(130, "male")).toThrow()
    expect(() => run(30, "male", "pregnant")).toThrow()
    expect(() => run(12, "female", "pregnant")).toThrow()
    expect(() => run(30, "other")).toThrow()
    expect(() => dailyWaterIntakeCalculator.calculate({ sex: "male", status: "none" })).toThrow()
  })
})

describe("pregnancy dating helpers", () => {
  it("applies Naegele's rule: LMP + 280 days", () => {
    expect(iso(estimatedDueDateMs(parseIsoDate("2025-01-01", "d"), 28))).toBe("2025-10-08")
  })
  it("shifts the due date with cycle length", () => {
    expect(iso(estimatedDueDateMs(parseIsoDate("2025-01-01", "d"), 35))).toBe("2025-10-15")
    expect(iso(estimatedDueDateMs(parseIsoDate("2025-01-01", "d"), 24))).toBe("2025-10-04")
  })
  it("counts gestational days from the LMP, adjusting for cycle length", () => {
    const lmp = parseIsoDate("2025-01-01", "d")
    const asOf = parseIsoDate("2025-04-11", "d")
    expect(gestationDaysFromLmp(lmp, asOf, 28)).toBe(100)
    expect(gestationDaysFromLmp(lmp, asOf, 35)).toBe(93)
  })
  it("uses the ACOG trimester boundaries", () => {
    expect(trimesterLabel(13 * 7 + 6)).toBe("First trimester")
    expect(trimesterLabel(14 * 7)).toBe("Second trimester")
    expect(trimesterLabel(27 * 7 + 6)).toBe("Second trimester")
    expect(trimesterLabel(28 * 7)).toBe("Third trimester")
  })
})

describe("estimatedDueDateCalculator", () => {
  it("returns the due date for a known LMP", () => {
    const r = estimatedDueDateCalculator.calculate({ lmp: "2025-01-01" })
    expect(r.value).toBe("2025-10-08")
    expect(r.display).toBe("Wed 8 Oct 2025")
  })
  it("treats a blank or missing cycle length as 28 days", () => {
    expect(estimatedDueDateCalculator.calculate({ lmp: "2025-01-01", cycleLength: "" }).value).toBe("2025-10-08")
    expect(estimatedDueDateCalculator.calculate({ lmp: "2025-01-01", cycleLength: 35 }).value).toBe("2025-10-15")
  })
  it("reports gestational age today for a recent LMP", () => {
    const lmp = iso(addDays(todayUtcMs(), -100))
    const r = estimatedDueDateCalculator.calculate({ lmp })
    expect(secondary(r, "Gestational age today")).toBe("14 weeks 2 days")
    expect(secondary(r, "Trimester today")).toBe("Second trimester")
    expect(secondary(r, "Days until due date")).toBe("180")
  })
  it("rejects a future LMP, a bad date and an out-of-range cycle", () => {
    expect(() => estimatedDueDateCalculator.calculate({ lmp: iso(addDays(todayUtcMs(), 1)) })).toThrow()
    expect(() => estimatedDueDateCalculator.calculate({ lmp: "2025-02-30" })).toThrow()
    expect(() => estimatedDueDateCalculator.calculate({})).toThrow()
    expect(() => estimatedDueDateCalculator.calculate({ lmp: "2025-01-01", cycleLength: 10 })).toThrow()
  })
  it("warns when the LMP is more than 42 weeks ago", () => {
    const r = estimatedDueDateCalculator.calculate({ lmp: iso(addDays(todayUtcMs(), -320)) })
    expect(r.warnings?.length).toBe(1)
  })
})

describe("gestationalAgeCalculator", () => {
  it("calculates from the LMP on a chosen date", () => {
    const r = gestationalAgeCalculator.calculate({ lmp: "2025-01-01", asOf: "2025-04-11" })
    expect(r.display).toBe("14 weeks 2 days")
    expect(secondary(r, "Trimester")).toBe("Second trimester")
    expect(secondary(r, "Total days")).toBe("100")
    expect(secondary(r, "Estimated due date")).toBe("Wed 8 Oct 2025")
  })
  it("gives the same answer from the matching due date", () => {
    const r = gestationalAgeCalculator.calculate({ edd: "2025-10-08", asOf: "2025-04-11" })
    expect(r.display).toBe("14 weeks 2 days")
  })
  it("adjusts for cycle length on the LMP method", () => {
    const r = gestationalAgeCalculator.calculate({ lmp: "2025-01-01", asOf: "2025-04-11", cycleLength: 35 })
    expect(r.display).toBe("13 weeks 2 days")
    expect(secondary(r, "Trimester")).toBe("First trimester")
  })
  it("accepts blank optional inputs (web sends empty strings, mobile omits them)", () => {
    const r = gestationalAgeCalculator.calculate({ lmp: "2025-01-01", edd: "", asOf: "2025-04-11", cycleLength: "" })
    expect(r.display).toBe("14 weeks 2 days")
  })
  it("defaults to today", () => {
    const r = gestationalAgeCalculator.calculate({ lmp: iso(addDays(todayUtcMs(), -100)) })
    expect(r.display).toBe("14 weeks 2 days")
  })
  it("requires exactly one of LMP or due date, and a sensible date", () => {
    expect(() => gestationalAgeCalculator.calculate({ asOf: "2025-04-11" })).toThrow()
    expect(() => gestationalAgeCalculator.calculate({ lmp: "2025-01-01", edd: "2025-10-08" })).toThrow()
    expect(() => gestationalAgeCalculator.calculate({ lmp: "2025-04-11", asOf: "2025-01-01" })).toThrow()
  })
})

describe("leanBodyMassCalculator", () => {
  it("applies the Boer equation for men", () => {
    const r = leanBodyMassCalculator.calculate({ sex: "male", weight: 75, weightUnit: "kg", height: 180, heightUnit: "cm" })
    expect(r.value).toBe(59.4)
  })
  it("applies the Boer equation for women", () => {
    const r = leanBodyMassCalculator.calculate({ sex: "female", weight: 62, weightUnit: "kg", height: 168, heightUnit: "cm" })
    expect(r.value).toBe(46.8)
    expect(secondary(r, "Estimated non-lean (fat) mass")).toBe("15.2 kg")
  })
  it("converts pounds and inches", () => {
    const r = leanBodyMassCalculator.calculate({ sex: "male", weight: 165.347, weightUnit: "lb", height: 70.866, heightUnit: "in" })
    expect(r.value as number).toBeCloseTo(59.4, 0)
  })
  it("rejects missing, zero or invalid values", () => {
    expect(() => leanBodyMassCalculator.calculate({ weight: 75, weightUnit: "kg", height: 180, heightUnit: "cm" })).toThrow()
    expect(() => leanBodyMassCalculator.calculate({ sex: "male", weight: 0, weightUnit: "kg", height: 180, heightUnit: "cm" })).toThrow()
    expect(() => leanBodyMassCalculator.calculate({ sex: "female", weight: 20, weightUnit: "kg", height: 30, heightUnit: "cm" })).toThrow()
  })
})

describe("targetHeartRateCalculator", () => {
  it("estimates maximum heart rate with Tanaka and targets with Karvonen", () => {
    const r = targetHeartRateCalculator.calculate({ age: 40, restingHr: 60 })
    expect(r.value).toBe(180)
    expect(secondary(r, "Heart rate reserve")).toBe("120 bpm")
    expect(secondary(r, "Target at 50% of reserve")).toBe("120 bpm")
    expect(secondary(r, "Target at 70% of reserve")).toBe("144 bpm")
    expect(secondary(r, "Target at 90% of reserve")).toBe("168 bpm")
  })
  it("rejects out-of-range ages and resting rates", () => {
    expect(() => targetHeartRateCalculator.calculate({ age: 17, restingHr: 60 })).toThrow()
    expect(() => targetHeartRateCalculator.calculate({ age: 101, restingHr: 60 })).toThrow()
    expect(() => targetHeartRateCalculator.calculate({ age: 40, restingHr: 20 })).toThrow()
    expect(() => targetHeartRateCalculator.calculate({ age: 40 })).toThrow()
  })
})

describe("packYearsCalculator", () => {
  it("multiplies packs per day by years", () => {
    expect(packYearsCalculator.calculate({ cigarettesPerDay: 20, yearsSmoked: 10 }).value).toBe(10)
    expect(packYearsCalculator.calculate({ cigarettesPerDay: 10, yearsSmoked: 20 }).display).toBe("10 pack-years")
  })
  it("honours a custom pack size and flags 20 or more", () => {
    expect(packYearsCalculator.calculate({ cigarettesPerDay: 25, yearsSmoked: 10, cigarettesPerPack: 25 }).value).toBe(10)
    expect(secondary(packYearsCalculator.calculate({ cigarettesPerDay: 20, yearsSmoked: 25 }), "20 pack-years or more")).toBe("Yes")
    expect(secondary(packYearsCalculator.calculate({ cigarettesPerDay: 20, yearsSmoked: 19 }), "20 pack-years or more")).toBe("No")
  })
  it("treats a blank pack size as 20 and rejects zero or missing values", () => {
    expect(packYearsCalculator.calculate({ cigarettesPerDay: 20, yearsSmoked: 10, cigarettesPerPack: "" }).value).toBe(10)
    expect(() => packYearsCalculator.calculate({ cigarettesPerDay: 0, yearsSmoked: 10 })).toThrow()
    expect(() => packYearsCalculator.calculate({ cigarettesPerDay: 10 })).toThrow()
    expect(() => packYearsCalculator.calculate({ cigarettesPerDay: 10, yearsSmoked: 95 })).toThrow()
  })
})

describe("alcoholUnitsCalculator", () => {
  it("converts volume and strength to UK units", () => {
    expect(alcoholUnitsCalculator.calculate({ volume: 440, abv: 5 }).value).toBe(2.2)
    expect(alcoholUnitsCalculator.calculate({ volume: 175, abv: 13 }).display).toBe("2.3 UK units")
    expect(alcoholUnitsCalculator.calculate({ volume: 25, abv: 40 }).value).toBe(1)
  })
  it("multiplies by the number of drinks and reports pure alcohol", () => {
    const r = alcoholUnitsCalculator.calculate({ volume: 440, abv: 5, drinks: 2 })
    expect(r.value).toBe(4.4)
    expect(secondary(r, "Pure alcohol")).toBe("44 mL (about 35 g)")
    expect(secondary(r, "Share of the UK weekly guideline (14 units)")).toBe("31%")
  })
  it("treats a blank drink count as one and accepts alcohol-free drinks", () => {
    expect(alcoholUnitsCalculator.calculate({ volume: 440, abv: 5, drinks: "" }).value).toBe(2.2)
    expect(alcoholUnitsCalculator.calculate({ volume: 330, abv: 0 }).value).toBe(0)
  })
  it("rejects impossible values", () => {
    expect(() => alcoholUnitsCalculator.calculate({ volume: 0, abv: 5 })).toThrow()
    expect(() => alcoholUnitsCalculator.calculate({ volume: 330, abv: 101 })).toThrow()
    expect(() => alcoholUnitsCalculator.calculate({ volume: 330, abv: -1 })).toThrow()
    expect(() => alcoholUnitsCalculator.calculate({ volume: 330, abv: 5, drinks: 0 })).toThrow()
  })
})
