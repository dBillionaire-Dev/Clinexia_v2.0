import { describe, expect, it } from "vitest"
import { CDS_SERVICE_ID, discoveryDocument, handlePatientView } from "./service"

const TODAY = new Date(Date.UTC(2026, 9, 26, 12))
const BASE = "https://clinexia.example.test"
const obsBundle = (loinc: string, value: number, unit: string, date: string) => ({
  resourceType: "Bundle",
  entry: [{ resource: { resourceType: "Observation", id: "obs-SECRET-ID", status: "final", code: { coding: [{ system: "http://loinc.org", code: loinc }] }, effectiveDateTime: date, valueQuantity: { value, unit, system: "http://unitsofmeasure.org", code: unit } } }],
})
const patient = { resourceType: "Patient", id: "patient-SECRET-1", name: [{family: "SECRET-NAME", given: ["Jane"]}], birthDate: "1972-10-26", gender: "male" }
const request = (prefetch: Record<string, unknown>) => ({ hook: "patient-view", hookInstance: "d1b2", context: { patientId: "patient-SECRET-1", userId: "Practitioner/SECRET-USER" }, prefetch })
const run = (prefetch: Record<string, unknown>) => handlePatientView(request(prefetch), { baseUrl: BASE, today: TODAY })

describe("discovery", () => {
  const d = discoveryDocument()
  it("describes one patient-view service with prefetch templates for the patient, creatinine and weight", () => {
    expect(d.services.length).toBe(1)
    const s = d.services[0]
    expect(s.hook).toBe("patient-view")
    expect(s.id).toBe(CDS_SERVICE_ID)
    expect(Object.keys(s.prefetch).sort()).toEqual(["creatinine", "patient", "weight"])
    expect(s.prefetch.patient).toBe("Patient/{{context.patientId}}")
    expect(s.prefetch.creatinine).toContain("{{context.patientId}}")
  })
})

describe("handlePatientView", () => {
  it("gives eGFR and creatinine clearance cards from prefetched creatinine (umol/L) and weight", () => {
    const r = run({ patient, creatinine: obsBundle("2160-0", 88, "umol/L", "2026-10-20"), weight: obsBundle("29463-7", 70, "kg", "2026-10-21") })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.cards.length).toBe(2)
    const cr = r.cards.find((c) => c.summary.startsWith("Creatinine"))!
    expect(cr.summary).toContain("84 mL/min") // the same answer as the API example
    expect(cr.indicator).toBe("info")
    expect(cr.source.label).toBe("Clinexia")
    expect(cr.detail).toContain("2026-10-20")
    expect(cr.detail).toContain("Not a diagnostic device")
    expect(cr.links?.[0].type).toBe("absolute")
    expect(cr.links?.[0].url.startsWith(`${BASE}/calculators/renal/`)).toBe(true)
    expect(cr.links?.[0].url).toContain("#") // values travel in the fragment
    expect(cr.links?.[0].url.split("#")[0]).not.toContain("?")
    expect(r.cards.every((c) => c.summary.length <= 140)).toBe(true)
  })

  it("only the cards whose inputs are all available: no weight, no creatinine clearance", () => {
    const r = run({ patient, creatinine: obsBundle("2160-0", 1.1, "mg/dL", "2026-10-20") })
    expect(r.ok && r.cards.length).toBe(1)
    expect(r.ok && r.cards[0].summary).toContain("eGFR")
  })

  it("no creatinine, no patient, no prefetch: no cards, no guessing", () => {
    for (const prefetch of [{ patient }, { creatinine: obsBundle("2160-0", 1, "mg/dL", "2026-10-20") }, {}]) {
      const r = run(prefetch)
      expect(r.ok && r.cards).toEqual([])
    }
    expect(handlePatientView({ hook: "patient-view" }, { baseUrl: BASE, today: TODAY })).toEqual({ ok: true, cards: [] })
  })

  it("an old creatinine makes a warning card that says so", () => {
    const r = run({ patient, creatinine: obsBundle("2160-0", 1.1, "mg/dL", "2026-08-01"), weight: obsBundle("29463-7", 70, "kg", "2026-10-21") })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.cards.every((c) => c.indicator === "warning")).toBe(true)
    expect(r.cards[0].summary).toContain("old result")
    expect(r.cards[0].detail).toContain("OLDER THAN 30 DAYS")
  })

  it("a creatinine in an unknown unit gives no card instead of a guess", () => {
    const r = run({ patient, creatinine: obsBundle("2160-0", 88, "furlongs", "2026-10-20") })
    expect(r.ok && r.cards).toEqual([])
  })

  it("never repeats identifiers from the request (patient id, name, practitioner, observation id)", () => {
    const r = run({ patient, creatinine: obsBundle("2160-0", 88, "umol/L", "2026-10-20"), weight: obsBundle("29463-7", 70, "kg", "2026-10-21") })
    const text = JSON.stringify(r)
    for (const secret of ["SECRET-1", "SECRET-NAME", "Jane", "SECRET-USER", "SECRET-ID", "d1b2"]) expect(text, secret).not.toContain(secret)
  })

  it("rejects other hooks and malformed bodies without echoing them", () => {
    for (const bad of [null, "x", [], { hook: "order-select" }, { hook: 5 }]) {
      const r = handlePatientView(bad, { baseUrl: BASE, today: TODAY })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.status).toBe(400)
    }
  })
})
