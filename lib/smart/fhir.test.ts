import { describe, expect, it } from "vitest"
import { loadRecord, observationSearchUrl, observationsFromResponse, type FhirClientLike } from "./fhir"

const o = (id: string) => ({ resourceType: "Observation", id })

describe("observationSearchUrl", () => {
  it("searches one LOINC code for one patient, newest first, relative to the FHIR base", () => {
    const url = observationSearchUrl("p 1", "2160-0")
    expect(url).toBe("Observation?patient=p%201&code=http%3A%2F%2Floinc.org%7C2160-0&_sort=-date&_count=10")
    expect(url.startsWith("http")).toBe(false)
  })
})

describe("observationsFromResponse", () => {
  it("reads a Bundle, an array of Bundles and a plain array, ignoring everything that is not an Observation", () => {
    const bundle = { resourceType: "Bundle", entry: [{ resource: o("a") }, { resource: { resourceType: "OperationOutcome" } }, { resource: o("b") }, {}] }
    expect(observationsFromResponse(bundle).map((x) => x.id)).toEqual(["a", "b"])
    expect(observationsFromResponse([bundle, { resourceType: "Bundle", entry: [{ resource: o("c") }] }]).map((x) => x.id)).toEqual(["a", "b", "c"])
    expect(observationsFromResponse([o("d")]).map((x) => x.id)).toEqual(["d"])
  })
  it("copes with junk", () => {
    for (const bad of [null, undefined, "x", 3, {}, [], { resourceType: "Bundle" }]) expect(observationsFromResponse(bad)).toEqual([])
  })
})

describe("loadRecord", () => {
  const fake = (handler: (url: string) => Promise<unknown>, patient: unknown = { resourceType: "Patient", id: "p1" }): FhirClientLike & { urls: string[] } => {
    const urls: string[] = []
    return { urls, patient: { id: "p1", read: async () => patient }, request: async (url) => { urls.push(url); return handler(url) } }
  }

  it("reads the patient and one search per distinct LOINC code", async () => {
    const client = fake(async (u) => ({ resourceType: "Bundle", entry: [{ resource: o(u.includes("2160-0") ? "creat" : "wt") }] }))
    const r = await loadRecord(client, ["2160-0", "29463-7", "2160-0"])
    expect(client.urls.length).toBe(2)
    expect(r.observations.map((x) => x.id)).toEqual(["creat", "wt"])
    expect(r.failedCodes).toEqual([])
  })
  it("a failed search (no permission, not found) leaves that input to the clinician and keeps the rest", async () => {
    const client = fake(async (u) => { if (u.includes("29463-7")) throw new Error("403"); return { resourceType: "Bundle", entry: [{ resource: o("creat") }] } })
    const r = await loadRecord(client, ["2160-0", "29463-7"])
    expect(r.observations.map((x) => x.id)).toEqual(["creat"])
    expect(r.failedCodes).toEqual(["29463-7"])
  })
  it("a failure reading the patient itself is an error", async () => {
    const client: FhirClientLike = { patient: { id: "p1", read: async () => { throw new Error("401") } }, request: async () => ({}) }
    await expect(loadRecord(client, ["2160-0"])).rejects.toThrow()
  })
  it("makes no observation search without a patient id", async () => {
    const client = fake(async () => ({}), { resourceType: "Patient" })
    client.patient.id = null
    const r = await loadRecord(client, ["2160-0"])
    expect(client.urls).toEqual([])
    expect(r.observations).toEqual([])
  })
})
