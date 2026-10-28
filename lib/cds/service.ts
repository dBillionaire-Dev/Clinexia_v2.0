import { getCalculatorById, type CalculatorDefinition } from "@clinexia/core"
import { runCalculation } from "@/lib/api/v1/calculate"
import { observationsFromResponse } from "@/lib/smart/fhir"
import { mapFhirToInputs, DEFAULT_STALE_THRESHOLDS, type FhirPatient, type MappedValue, type StaleThresholds } from "@/lib/smart/mapping"
import { buildPrefillFragment } from "@/lib/smart/provenance"

/**
 * CDS Hooks service stub: the "patient-view" hook, answering with kidney-function cards (eGFR by CKD-EPI, creatinine clearance by
 * Cockcroft-Gault) computed from the creatinine and weight the EHR PREFETCHES.
 *
 * Stateless and free of PHI by construction: it reads the request, computes, returns cards. It stores nothing, calls nothing, and
 * the route that wraps it never logs the body. It does not verify the EHR's JWT yet (see docs/integration/smart-on-fhir.md).
 */
export const CDS_SERVICE_ID = "clinexia-renal-function"
const CALCULATORS = ["egfr-ckd-epi", "creatinine-clearance"] as const

export function discoveryDocument() {
  return {
    services: [
      {
        hook: "patient-view",
        id: CDS_SERVICE_ID,
        title: "Clinexia renal function",
        description: "Shows eGFR (CKD-EPI) and creatinine clearance (Cockcroft-Gault) from the latest creatinine, with the result's date. A calculation aid: verify before relying on it.",
        // UNVERIFIED: the LOINC codes in these templates are the unverified ones from Phase 2 (2160-0 creatinine, 29463-7 body weight).
        prefetch: {
          patient: "Patient/{{context.patientId}}",
          creatinine: "Observation?patient={{context.patientId}}&code=http://loinc.org|2160-0&_sort=-date&_count=5",
          weight: "Observation?patient={{context.patientId}}&code=http://loinc.org|29463-7&_sort=-date&_count=5",
        },
      },
    ],
  }
}

export interface CdsCard {
  summary: string
  indicator: "info" | "warning"
  detail: string
  source: { label: string; url?: string }
  links?: Array<{ label: string; url: string; type: "absolute" }>
}

export type CdsOutcome = { ok: true; cards: CdsCard[] } | { ok: false; status: 400 | 422; message: string }

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

export interface CdsOptions { baseUrl: string; today?: Date; thresholds?: Partial<StaleThresholds> }

function describeInputs(def: CalculatorDefinition, values: MappedValue[]): string {
  return values
    .map((v) => {
      const input = def.inputs.find((i) => i.id === v.inputId)
      const where = v.source === "patient" ? "patient record" : `result dated ${v.observedAt}, ${v.ageDays} day${v.ageDays === 1 ? "" : "s"} old${v.stale ? " (OLDER THAN " + v.staleAfterDays + " DAYS)" : ""}`
      return `- ${input?.label ?? v.inputId}: ${v.value}${input?.unit ? " " + input.unit : ""} (${where})`
    })
    .join("\n")
}

export function handlePatientView(body: unknown, options: CdsOptions): CdsOutcome {
  if (!isObject(body) || body.hook !== "patient-view") return { ok: false, status: 400, message: 'Expected a CDS Hooks request for the "patient-view" hook.' }
  const prefetch = isObject(body.prefetch) ? body.prefetch : null
  if (!prefetch) return { ok: true, cards: [] } // nothing prefetched: nothing to compute

  const patient = isObject(prefetch.patient) && prefetch.patient.resourceType === "Patient" ? (prefetch.patient as FhirPatient) : undefined
  const observations = [...observationsFromResponse(prefetch.creatinine), ...observationsFromResponse(prefetch.weight)]
  const cards: CdsCard[] = []

  for (const id of CALCULATORS) {
    const def = getCalculatorById(id)
    if (!def) continue
    const mapping = mapFhirToInputs(def, { patient, observations }, { today: options.today, thresholds: options.thresholds ?? DEFAULT_STALE_THRESHOLDS })
    const needed = def.inputs.filter((i) => !i.optional && i.fhir)
    if (mapping.values.length < needed.length) continue // not every required input is available: no card, no guessing

    const inputs: Record<string, string> = {}
    for (const v of mapping.values) inputs[v.inputId] = v.value
    const calc = runCalculation(def, inputs)
    if (!calc.ok) continue

    const stale = mapping.values.some((v) => v.stale)
    const fragment = buildPrefillFragment(mapping.values)
    cards.push({
      summary: `${def.name}: ${calc.result.display}${stale ? " (based on an old result)" : ""}`.slice(0, 140),
      indicator: stale ? "warning" : "info",
      detail:
        `**${def.name}: ${calc.result.display}** (formula version ${calc.version})\n\nCalculated from:\n${describeInputs(def, mapping.values)}\n\n` +
        `${stale ? "One or more results are older than the freshness limit: check they are still current.\n\n" : ""}` +
        `${calc.intendedUse} ${calc.disclaimer}`,
      source: { label: "Clinexia", url: options.baseUrl },
      links: [{ label: "Open the calculator", url: `${options.baseUrl}/calculators/${def.category}/${def.id}#${fragment}`, type: "absolute" }],
    })
  }
  return { ok: true, cards }
}

