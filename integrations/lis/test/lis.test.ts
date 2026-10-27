import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as core from "@clinexia/core"
import { addCalculatedResults, lis, safeSummary } from "../node/adapter.mjs"

const here = fileURLToPath(new URL(".", import.meta.url))
const sample = (name: string) => readFileSync(`${here}../samples/${name}`, "utf8")
const NOW = new Date(Date.UTC(2026, 9, 26, 10, 20, 0))
const run = (text: string, options: Record<string, unknown> = {}) => addCalculatedResults(core, text, { now: NOW, ...options })
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

/** A parsed view of the produced message: OBX segments by local code. */
function produced(oru: string | null) {
  expect(oru).not.toBeNull()
  const msg = lis.parseMessage(oru as string)
  const obx = msg.segments.filter((s: { name: string }) => s.name === "OBX")
  const byCode: Record<string, { value: number; unit: string; fields: string[] }> = {}
  for (const s of obx) byCode[lis.component(msg, lis.field(s, 3), 1)] = { value: Number(lis.component(msg, lis.field(s, 5), 1)), unit: lis.component(msg, lis.field(s, 6), 1), fields: s.fields }
  return { msg, obx, byCode }
}

describe("HL7 parsing", () => {
  const text = "MSH|^~\\&|APP|FAC|X|Y|20261026||ORU^R01|1|P|2.5.1\rPID|1||A^^^H^MR||DOE^J||19721026|F\rOBX|1|NM|2951-2^Na^LN||140|mmol/L^^UCUM\r"
  it("numbers fields the HL7 way, including MSH-1 and MSH-2", () => {
    const m = lis.parseMessage(text)
    expect(m.segments.map((s: { name: string }) => s.name)).toEqual(["MSH", "PID", "OBX"])
    expect(lis.field(m.segments[0], 1)).toBe("|")
    expect(lis.field(m.segments[0], 2)).toBe("^~\\&")
    expect(lis.field(m.segments[0], 3)).toBe("APP")
    expect(lis.field(m.segments[0], 9)).toBe("ORU^R01")
    expect(lis.field(m.segments[1], 8)).toBe("F")
    expect(lis.component(m, lis.field(m.segments[2], 3), 3)).toBe("LN")
    expect(lis.component(m, lis.field(m.segments[2], 6), 1)).toBe("mmol/L")
    expect(lis.field(m.segments[2], 99)).toBe("")
  })
  it("accepts CR, LF and CRLF segment endings", () => {
    for (const nl of ["\r", "\n", "\r\n"]) expect(lis.parseMessage(text.replace(/\r/g, nl)).segments.length).toBe(3)
  })
  it("rejects anything that does not start with MSH", () => {
    expect(() => lis.parseMessage("PID|1")).toThrow()
    expect(() => lis.parseMessage("")).toThrow()
  })
  it("escapes and unescapes the delimiter characters", () => {
    const m = lis.parseMessage(text)
    const raw = "a|b^c&d~e\\f"
    expect(lis.escapeText(raw)).toBe("a\\F\\b\\S\\c\\T\\d\\R\\e\\E\\f")
    expect(lis.unescapeText(m, lis.escapeText(raw))).toBe(raw)
    expect(lis.escapeText("line\r\nbreak")).toBe("line  break")
  })
})

describe("dates and ages", () => {
  it("age is completed years on the observation date", () => {
    const born = lis.dateParts("19721026")
    expect(lis.ageOn(born, lis.dateParts("20261026093000"))).toBe(54)
    expect(lis.ageOn(born, lis.dateParts("20261025"))).toBe(53)
    expect(lis.ageOn(lis.dateParts("20000229"), lis.dateParts("20260228"))).toBe(25)
    expect(lis.ageOn(lis.dateParts("20000229"), lis.dateParts("20260301"))).toBe(26)
  })
  it("incomplete, impossible or future dates give nothing", () => {
    for (const d of ["", "1972", "197210", "19721340", "19720230", "abc"]) expect(lis.dateParts(d), d).toBeNull()
    expect(lis.ageOn(lis.dateParts("20300101"), lis.dateParts("20261026"))).toBeNull()
  })
})

describe("units a LIS prints", () => {
  it("maps equal-quantity spellings and leaves everything else alone", () => {
    expect(lis.lisUnit("10*12/L")).toBe("10\u00b9\u00b2/L")
    expect(lis.lisUnit("x10^12/L")).toBe("10\u00b9\u00b2/L")
    expect(lis.lisUnit("T/L")).toBe("10\u00b9\u00b2/L")
    expect(lis.lisUnit("10^6/uL")).toBe("10\u00b9\u00b2/L")
    expect(lis.lisUnit(" MG/DL ")).toBe("mg/dL")
    expect(lis.lisUnit("\u00b5mol/L")).toBe("umol/L")
    expect(lis.lisUnit("furlongs")).toBe("furlongs")
    expect(lis.lisUnit("")).toBe("")
    expect(lis.asciiUnit("10\u00b9\u00b2/L")).toBe("10*12/L")
  })
})

describe("sample: chemistry panel", () => {
  const { oru, report } = run(sample("oru-chemistry.hl7"))
  const p = produced(oru)

  it("anion gap, albumin-corrected anion gap, corrected calcium and eGFR, matching hand arithmetic", () => {
    expect(p.byCode["CLX-AG"].value).toBe(140 - (104 + 24)) // 12
    expect(p.byCode["CLX-AG"].unit).toBe("mmol/L")
    expect(near(p.byCode["CLX-AGALB"].value, 12 + 2.5 * (4 - 2.5), 0.06)).toBe(true) // 15.75, shown as 15.8
    expect(near(p.byCode["CLX-CCA"].value, 8 + 0.8 * (4 - 2.5), 0.001)).toBe(true) // 9.2
    expect(p.byCode["CLX-CCA"].unit).toBe("mg/dL")
  })

  it("eGFR agrees with an independent CKD-EPI 2021 calculation, creatinine converted from umol/L, age 54 at the sample date, female", () => {
    const scr = 88 / 88.4016 // mg/dL
    const k = 0.7, a = -0.241
    const egfr = 142 * Math.min(scr / k, 1) ** a * Math.max(scr / k, 1) ** -1.2 * 0.9938 ** 54 * 1.012
    expect(near(p.byCode["CLX-EGFR"].value, egfr, 0.6)).toBe(true)
    expect(p.byCode["CLX-EGFR"].unit).toBe("mL/min/{1.73_m2}")
  })

  it("is a new ORU^R01 that attaches to the same order and patient", () => {
    const m = p.msg
    expect(lis.field(m.segments[0], 9)).toBe("ORU^R01^ORU_R01")
    expect(lis.field(m.segments[0], 3)).toBe("CLINEXIA_CALC")
    expect(lis.field(m.segments[0], 5)).toBe("ANALYSER") // goes back to whoever sent the results
    expect(lis.field(m.segments[0], 7)).toBe("20261026102000")
    expect(lis.field(m.segments[0], 10)).toBe("CLX20261026102000")
    const names = m.segments.map((s: { name: string }) => s.name)
    expect(names.slice(0, 4)).toEqual(["MSH", "PID", "PV1", "ORC"])
    const source = lis.parseMessage(sample("oru-chemistry.hl7"))
    const same = (n: string) => m.segments.find((s: { name: string }) => s.name === n).raw === source.segments.find((s: { name: string }) => s.name === n).raw
    expect(same("PID") && same("PV1") && same("ORC") && same("OBR")).toBe(true)
  })

  it("carries only calculated results, each one flagged as calculated, preliminary, with a local code and a note", () => {
    expect(p.obx.length).toBe(4)
    p.obx.forEach((s: { fields: string[] }, i: number) => {
      expect(lis.field(s, 1)).toBe(String(i + 1)) // set ids restart at 1 under the OBR
      expect(lis.field(s, 2)).toBe("NM")
      expect(lis.component(p.msg, lis.field(s, 3), 1)).toMatch(/^CLX-/)
      expect(lis.component(p.msg, lis.field(s, 3), 3)).toBe("L")
      expect(lis.component(p.msg, lis.field(s, 6), 3)).toBe("UCUM")
      expect(lis.field(s, 11)).toBe("P")
      expect(lis.field(s, 14)).toBe("20261026093000")
      expect(lis.component(p.msg, lis.field(s, 17), 1)).toBe("CALCULATED")
    })
    const ntes = p.msg.segments.filter((s: { name: string }) => s.name === "NTE")
    expect(ntes.length).toBe(4)
    expect(lis.field(ntes[0], 3)).toContain("Not an analyser result")
    expect(lis.field(ntes[0], 3)).toContain("formula 1.0.0")
    expect(p.msg.segments.map((s: { name: string }) => s.name).filter((n: string) => n === "OBX" || n === "NTE").join("")).toBe("OBXNTEOBXNTEOBXNTEOBXNTE")
  })

  it("puts the LOINC code only as the ALTERNATE identifier, and only where one is known; the primary code is local", () => {
    const ag = p.byCode["CLX-AG"].fields[3]
    expect(ag.split("^")).toEqual(["CLX-AG", "Anion gap (calculated)", "L", "33037-3", "Anion gap (calculated)", "LN"])
    expect(p.byCode["CLX-CCA"].fields[3].split("^")).toEqual(["CLX-CCA", "Albumin-corrected calcium (calculated)", "L"])
  })

  it("ends every segment with CR and the whole message can be parsed again", () => {
    expect(oru!.endsWith("\r")).toBe(true)
    expect(oru!.includes("\n")).toBe(false)
    expect(lis.parseMessage(oru!).segments.length).toBeGreaterThan(8)
  })

  it("reports what it did", () => {
    expect(report.calculated.map((c: { calculator: string }) => c.calculator)).toEqual(["anion-gap", "corrected-calcium", "egfr-ckd-epi"])
    expect(report.skipped).toEqual([])
  })
})

describe("sample: lipids", () => {
  it("Friedewald LDL in mg/dL: 200 - 50 - 150/5 = 120", () => {
    const p = produced(run(sample("oru-lipids-mgdl.hl7")).oru)
    expect(p.byCode["CLX-LDL"]).toMatchObject({ value: 120, unit: "mg/dL" })
  })
  it("Friedewald LDL in mmol/L (the unit of the results is kept): 5.17 - 1.29 - 1.69/2.2", () => {
    const p = produced(run(sample("oru-lipids-mmol.hl7")).oru)
    expect(p.byCode["CLX-LDL"].unit).toBe("mmol/L")
    expect(near(p.byCode["CLX-LDL"].value, 5.17 - 1.29 - 1.69 / 2.2, 0.006)).toBe(true)
  })
})

describe("sample: red cell indices with LIS-style units (g/L, L/L, 10*12/L)", () => {
  it("MCV, MCH and MCHC equal the hand arithmetic for 14 g/dL, 42 %, 4.5 x10^12/L", () => {
    const p = produced(run(sample("oru-cbc.hl7")).oru)
    expect(near(p.byCode["CLX-MCV"].value, (42 * 10) / 4.5, 0.05)).toBe(true) // 93.3 fL
    expect(near(p.byCode["CLX-MCH"].value, (14 * 10) / 4.5, 0.05)).toBe(true) // 31.1 pg
    expect(near(p.byCode["CLX-MCHC"].value, (14 / 42) * 100, 0.05)).toBe(true) // 33.3 g/dL
    expect([p.byCode["CLX-MCV"].unit, p.byCode["CLX-MCH"].unit, p.byCode["CLX-MCHC"].unit]).toEqual(["fL", "pg", "g/dL"])
  })
  it("the NTE shows the units in ASCII", () => {
    const { oru } = run(sample("oru-cbc.hl7"))
    expect(/^[\x00-\x7F]*$/.test(oru!)).toBe(true)
    expect(oru).toContain("10*12/L")
  })
})

describe("never double-calculate what the analyser already reports", () => {
  const text = sample("oru-analyser-reports.hl7")

  it("skips an output whose code the message already contains, calculates the rest of the same panel", () => {
    const { oru, report } = run(text)
    const p = produced(oru)
    expect(Object.keys(p.byCode).sort()).toEqual(["CLX-MCH", "CLX-MCHC"]) // anion gap, MCV and eGFR were reported
    const reasons = report.skipped.map((s: { reason: string }) => s.reason).sort()
    expect(reasons).toEqual(["already_reported:CLX-AG", "already_reported:CLX-EGFR", "already_reported:CLX-MCV"])
    expect(report.reconciliation).toEqual([])
  })

  it("with compare on, still not emitted, but the differences are reported for reconciliation", () => {
    const { oru, report } = run(text, { compare: true })
    expect(Object.keys(produced(oru).byCode).sort()).toEqual(["CLX-MCH", "CLX-MCHC"])
    const by = Object.fromEntries(report.reconciliation.map((r: { code: string }) => [r.code, r]))
    expect(by["CLX-AG"]).toMatchObject({ analyser: 13, calculated: 12, difference: -1, unitsMatch: true })
    expect(by["CLX-MCV"]).toMatchObject({ analyser: 93, calculated: 93.3 })
    expect(near(by["CLX-MCV"].difference, 0.3, 1e-9)).toBe(true)
    expect(by["CLX-EGFR"].analyser).toBe(75)
  })

  it("a message that already holds ONLY reported values produces no message at all", () => {
    const only = "MSH|^~\\&|A|B|C|D|20261026||ORU^R01|1|P|2.5.1\rPID|1||X||T^T||19721026|F\rOBR|1|P1|F1|X\rOBX|1|NM|2951-2^Na^LN||140|mmol/L|||||F\rOBX|2|NM|2075-0^Cl^LN||104|mmol/L|||||F\rOBX|3|NM|1963-8^HCO3^LN||24|mmol/L|||||F\rOBX|4|NM|33037-3^AG^LN||12|mmol/L|||||F\r"
    const { oru, report } = run(only)
    expect(oru).toBeNull()
    expect(report.skipped.map((s: { reason: string }) => s.reason)).toEqual(["already_reported:CLX-AG"])
  })

  it("its own output is never processed again (no loops in a channel)", () => {
    const first = run(sample("oru-chemistry.hl7")).oru!
    const again = run(first)
    expect(again.oru).toBeNull()
    expect(again.report.errors).toEqual(["already_processed_by_this_adapter"])
    // even if a LIS rewrote the sending application, the local codes mark the outputs as already present
    const rewritten = first.replace("CLINEXIA_CALC", "OTHER")
    const third = run(rewritten)
    expect(third.oru).toBeNull()
  })
})

describe("safety rules: when it refuses to calculate", () => {
  const { oru, report } = run(sample("oru-skips.hl7"))
  const reason = (filler: string, calculator: string) => report.skipped.find((s: { order: { filler: string }; calculator: string }) => s.order.filler === filler && s.calculator === calculator)?.reason

  it("produces no message when nothing could be calculated", () => {
    expect(oru).toBeNull()
    expect(report.calculated).toEqual([])
  })
  it("preliminary results are not used", () => expect(reason("FIL-A", "anion-gap")).toBe("status_not_final:hco3"))
  it("a missing required input", () => expect(reason("FIL-A", "corrected-calcium")).toBe("missing_input:albumin"))
  it("censored values such as <18 are not numbers", () => expect(reason("FIL-B", "egfr-ckd-epi")).toBe("non_numeric:creatinine"))
  it("results in different units for one calculator that has a single unit setting", () => expect(reason("FIL-C", "ldl-friedewald")).toBe("mixed_units"))
  it("inputs measured at different times are never combined", () => expect(reason("FIL-C", "red-cell-indices")).toBe("different_times"))
  it("an unknown unit is reported, never guessed", () => expect(reason("FIL-D", "egfr-ckd-epi")).toBe("invalid_input:creatinine/unit_unknown"))
  it("no sex of M or F: no eGFR", () => {
    const r = run(sample("oru-no-sex.hl7"))
    expect(r.oru).toBeNull()
    expect(r.report.skipped[0].reason).toBe("sex_not_m_or_f")
  })
  it("calculators with none of their inputs in the order are not even mentioned", () => {
    expect(report.skipped.some((s: { calculator: string; order: { filler: string } }) => s.calculator === "red-cell-indices" && s.order.filler === "FIL-A")).toBe(false)
  })

  const base = (obx: string, pid = "PID|1||X||T^T||19721026|F") => `MSH|^~\\&|A|B|C|D|20261026||ORU^R01|1|P|2.5.1\r${pid}\rOBR|1|P1|F1|X|||20261026093000\r${obx}`
  const ag = (extra = "") => `OBX|1|NM|2951-2^Na^LN||140|mmol/L|||||F|||20261026093000\rOBX|2|NM|2075-0^Cl^LN||104|mmol/L|||||F|||20261026093000\rOBX|3|NM|1963-8^HCO3^LN||24|mmol/L|||||F|||20261026093000\r${extra}`

  it("two different values for one input in one order are never averaged or picked", () => {
    const r = run(base(ag("OBX|4|NM|2951-2^Na^LN||141|mmol/L|||||F|||20261026093000\r")))
    expect(r.oru).toBeNull()
    expect(r.report.skipped[0].reason).toBe("multiple_values:na")
  })
  it("the same value repeated (a re-sent result) is fine", () => {
    expect(run(base(ag("OBX|4|NM|2951-2^Na^LN||140|mmol/L|||||F|||20261026093000\r"))).oru).not.toBeNull()
  })
  it("results from DIFFERENT orders are never combined", () => {
    const split = `MSH|^~\\&|A|B|C|D|20261026||ORU^R01|1|P|2.5.1\rPID|1||X||T^T||19721026|F\rOBR|1|P1|F1|X\rOBX|1|NM|2951-2^Na^LN||140|mmol/L|||||F\rOBR|2|P2|F2|Y\rOBX|1|NM|2075-0^Cl^LN||104|mmol/L|||||F\rOBX|2|NM|1963-8^HCO3^LN||24|mmol/L|||||F\r`
    const r = run(split)
    expect(r.oru).toBeNull()
    expect(r.report.skipped.map((s: { reason: string }) => s.reason)).toEqual(["missing_input:cl", "missing_input:na"])
  })
  it("a value that is not numeric type, or has no unit, is skipped", () => {
    expect(run(base(ag().replace("OBX|1|NM|2951-2", "OBX|1|ST|2951-2"))).report.skipped[0].reason).toBe("value_type_not_numeric:na")
    expect(run(base(ag().replace("140|mmol/L", "140|"))).report.skipped[0].reason).toBe("missing_unit:na")
  })
  it("age cannot be worked out from a partial birth date", () => {
    const eg = "OBX|1|NM|2160-0^Cr^LN||0.9|mg/dL|||||F|||20261026093000\r"
    expect(run(base(eg, "PID|1||X||T^T||1972|F")).report.skipped[0].reason).toBe("age_not_determinable")
    expect(run(base(eg, "PID|1||X||T^T||19721026|F")).oru).not.toBeNull()
    expect(run(base(eg, "")).report.skipped[0].reason).toBe("no_demographics")
  })
  it("a message that is not an ORU^R01 is refused", () => {
    const r = run("MSH|^~\\&|A|B|C|D|20261026||ADT^A01|1|P|2.5.1\rPID|1\r")
    expect(r.oru).toBeNull()
    expect(r.report.errors).toEqual(["not_oru_r01"])
  })
  it("a backend that fails or throws skips that calculator and never aborts the message or leaks its error", () => {
    const failing = { calculate: () => ({ ok: false, reason: "http_503" }) }
    const throwing = { calculate: () => { throw new Error("SECRET-VALUE 140 leaked") } }
    const a = lis.deriveCalculatedResults(sample("oru-chemistry.hl7"), failing, { now: NOW })
    expect(a.oru).toBeNull()
    expect(a.report.skipped.map((s: { reason: string }) => s.reason)).toEqual(["http_503", "http_503", "http_503"])
    const b = lis.deriveCalculatedResults(sample("oru-chemistry.hl7"), throwing, { now: NOW })
    expect(JSON.stringify(b.report)).not.toContain("SECRET-VALUE")
    expect(b.report.skipped.map((s: { reason: string }) => s.reason)).toEqual(["backend_error", "backend_error", "backend_error"])
  })
})

describe("options", () => {
  it("resultStatus and acceptStatuses", () => {
    const p = produced(run(sample("oru-lipids-mgdl.hl7"), { resultStatus: "F" }).oru)
    expect(lis.field(p.obx[0], 11)).toBe("F")
    const prelim = sample("oru-lipids-mgdl.hl7").replace(/\|F\|\|\|/g, "|P|||")
    expect(run(prelim).oru).toBeNull()
    expect(run(prelim, { acceptStatuses: ["F", "C", "P"] }).oru).not.toBeNull()
  })
  it("calculators limits what is calculated", () => {
    const p = produced(run(sample("oru-chemistry.hl7"), { calculators: ["corrected-calcium"] }).oru)
    expect(Object.keys(p.byCode)).toEqual(["CLX-CCA"])
  })
  it("localCodeMap lets a lab with local codes feed the calculators", () => {
    const local = sample("oru-lipids-mgdl.hl7").replace(/2093-3\^Cholesterol total\^LN/, "CHOL^Cholesterol^L").replace(/2085-9\^HDL cholesterol\^LN/, "HDLC^HDL^L").replace(/2571-8\^Triglyceride\^LN/, "TRIG^TG^L")
    expect(run(local).oru).toBeNull()
    const mapped = run(local, { localCodeMap: { CHOL: "2093-3", HDLC: "2085-9", TRIG: "2571-8" } })
    expect(produced(mapped.oru).byCode["CLX-LDL"].value).toBe(120)
  })
  it("sender and receiver names", () => {
    const { oru } = run(sample("oru-lipids-mgdl.hl7"), { sendingApplication: "MYAPP", sendingFacility: "MYLAB", receivingApplication: "LIS2", receivingFacility: "HOSP2", controlId: "CTRL9" })
    const msh = lis.parseMessage(oru!).segments[0]
    expect([3, 4, 5, 6, 10].map((n) => lis.field(msh, n))).toEqual(["MYAPP", "MYLAB", "LIS2", "HOSP2", "CTRL9"])
  })
})

describe("what may be printed", () => {
  it("safeSummary has counts and skip reasons only: no values, no identifiers, no order numbers", () => {
    const { report } = run(sample("oru-skips.hl7"))
    const text = JSON.stringify(safeSummary(report))
    for (const secret of ["TEST-0006", "TESTPATIENT", "PLC-A", "FIL-A", "FIL-B", "140", "18"]) expect(text, secret).not.toContain(secret)
    expect(safeSummary(report).skipped).toBe(report.skipped.length)
    const ok = safeSummary(run(sample("oru-chemistry.hl7")).report)
    expect(ok).toMatchObject({ calculated: 3, outputs: 4, skipped: 0 })
  })
})

describe("source hygiene", () => {
  const read = (rel: string) => readFileSync(`${here}../${rel}`, "utf8")
  const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1")
  const ES6 = [/=>/, /`/, /\blet\b/, /\bconst\b/, /\.\.\./, /\bclass\b/, /\basync\b|\bawait\b/, /\?\./, /\?\?/, /\bfor\s*\(\s*(var|let|const)?\s*\w+\s+of\s/]

  it("the shared module and the Mirth files are plain ES5 (Mirth's Rhino engine), and plain ASCII", () => {
    for (const f of ["shared/clinexia-lis.js", "mirth/clinexia-api-backend.js", "mirth/transformer-step.js"]) {
      const text = read(f)
      expect(/^[\x00-\x7F]*$/.test(text), `${f} is not ASCII`).toBe(true)
      for (const re of ES6) expect(re.test(strip(text)), `${f} uses ${re}`).toBe(false)
    }
  })
  it("nothing logs: no console, logger or print calls, no Java System output, in any example source", () => {
    for (const f of ["shared/clinexia-lis.js", "mirth/clinexia-api-backend.js", "mirth/transformer-step.js", "node/adapter.mjs", "node/core-backend.mjs"]) {
      expect(/\bconsole\s*\.|\blogger\s*\.|java\.lang\.System|\bprint\s*\(|\balert\s*\(/.test(strip(read(f))), f).toBe(false)
    }
  })
  it("the command line tool prints only the safe summary (plus its one 'not built' notice)", () => {
    const cli = strip(read("node/cli.mjs"))
    expect((cli.match(/console\.\w+\(/g) ?? []).length).toBe(2)
    expect(cli).toContain("console.error(JSON.stringify(summary))")
  })
  it("no network or storage in the shared module", () => {
    expect(/XMLHttpRequest|fetch\s*\(|localStorage|java\.net|java\.io/.test(strip(read("shared/clinexia-lis.js")))).toBe(false)
  })
})
