import type { FhirObservation, FhirPatient } from "./mapping"

/**
 * Reads the patient and the observations a calculator needs, from the FHIR server, in the browser. Nothing is sent to Clinexia.
 * Only the minimal client surface is described here so it can be tested with a fake.
 */
export interface FhirClientLike {
  patient: { id: string | null; read: () => Promise<unknown> }
  request: (url: string) => Promise<unknown>
}

const enc = encodeURIComponent
export const LOINC_SYSTEM = "http://loinc.org"

/** One search per LOINC code, newest first. Relative to the FHIR base URL. */
export const observationSearchUrl = (patientId: string, loinc: string) => `Observation?patient=${enc(patientId)}&code=${enc(`${LOINC_SYSTEM}|${loinc}`)}&_sort=-date&_count=10`

/** A search can come back as a Bundle, an array of Bundles (paging) or an array of resources; take the Observations out of any of them. */
export function observationsFromResponse(res: unknown): FhirObservation[] {
  const out: FhirObservation[] = []
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) { node.forEach(visit); return }
    const n = node as { resourceType?: string; entry?: Array<{ resource?: unknown }> }
    if (n.resourceType === "Bundle") { (n.entry ?? []).forEach((e) => visit(e.resource)); return }
    if (n.resourceType === "Observation") out.push(n as FhirObservation)
  }
  visit(res)
  return out
}

export interface LoadedRecord {
  patient: FhirPatient
  observations: FhirObservation[]
  /** LOINC codes whose search failed (for example no permission). Those inputs are simply left for the clinician to enter. */
  failedCodes: string[]
}

export async function loadRecord(client: FhirClientLike, loincCodes: string[]): Promise<LoadedRecord> {
  const patient = (await client.patient.read()) as FhirPatient
  const patientId = patient?.id ?? client.patient.id
  const observations: FhirObservation[] = []
  const failedCodes: string[] = []
  if (patientId) {
    for (const code of Array.from(new Set(loincCodes))) {
      try {
        observations.push(...observationsFromResponse(await client.request(observationSearchUrl(patientId, code))))
      } catch {
        failedCodes.push(code)
      }
    }
  }
  return { patient, observations, failedCodes }
}
