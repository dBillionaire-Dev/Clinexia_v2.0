// clinexia-upgrade:phase4 — PECARN pediatric head injury rules. Hidden until approved in ./review.ts.
// Source: Kuppermann et al., Lancet 2009 (erratum Lancet 2014). Two tools because the rules differ by age and
// the generic form has no conditional fields. The rule applies only to children with blunt head trauma in the
// last 24 hours and GCS 14 to 15, with none of the exclusions: outside that, no result is given.
import type { CalculatorDefinition, InputDefinition } from "../types"
import { CalculatorInputError, str } from "../helpers"

const yesNo = [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]
const yn = (id: string, label: string, helpText?: string): InputDefinition => ({ id, label, kind: "select", options: yesNo, helpText })

const eligibility: InputDefinition[] = [
  yn("blunt", "Blunt head trauma within the last 24 hours?"),
  { id: "gcs", label: "Glasgow Coma Scale", kind: "select", options: [{ value: "15", label: "15" }, { value: "14", label: "14" }, { value: "below14", label: "Below 14" }] },
  yn("exclusion", "Any exclusion present?", "Exclusions: trivial mechanism (ground-level fall or running into a stationary object) with no signs other than scalp abrasion or laceration; penetrating trauma; known brain tumor; pre-existing neurological disorder that complicates assessment; ventricular shunt; bleeding disorder; neuroimaging already done before arrival."),
]

function yes(inputs: Record<string, number | string>, id: string): boolean {
  const v = str(inputs, id)
  if (v !== "yes" && v !== "no") throw new CalculatorInputError(`Answer yes or no: ${id}.`)
  return v === "yes"
}

function checkEligibility(inputs: Record<string, number | string>): { gcs14: boolean } {
  if (!yes(inputs, "blunt")) throw new CalculatorInputError("The PECARN rule applies only to blunt head trauma within the last 24 hours. No result given.")
  const gcs = str(inputs, "gcs")
  if (gcs === "below14") throw new CalculatorInputError("The PECARN rule was derived in children with GCS 14 to 15. No result given.")
  if (yes(inputs, "exclusion")) throw new CalculatorInputError("An exclusion applies, so the PECARN rule cannot be used. No result given.")
  return { gcs14: gcs === "14" }
}

interface RuleSpec {
  id: string
  name: string
  shortName: string
  description: string
  highIds: string[]
  intermediateIds: string[]
  extraInputs: InputDefinition[]
  highRisk: string
  intermediateRisk: string
  veryLowRisk: string
  population: string
}

function buildRule(spec: RuleSpec): CalculatorDefinition {
  return {
    id: spec.id,
    name: spec.name,
    shortName: spec.shortName,
    category: "general",
    description: spec.description,
    keywords: ["pecarn", "head injury", "head trauma", "pediatric", "ct head", "emergency"],
    inputs: [...eligibility, ...spec.extraInputs],
    calculate: (inputs) => {
      const { gcs14 } = checkEligibility(inputs)
      const high = gcs14 || spec.highIds.some((id) => yes(inputs, id))
      const intermediateHits = spec.intermediateIds.filter((id) => yes(inputs, id))
      const group = high ? "high" : intermediateHits.length ? "intermediate" : "very-low"
      const text = {
        high: { name: "High-risk group", risk: spec.highRisk, rec: "The rule recommends CT." },
        intermediate: { name: "Intermediate-risk group", risk: spec.intermediateRisk, rec: "The rule recommends observation or CT, decided from other factors: clinician experience, multiple versus isolated findings, worsening symptoms during observation, age under 3 months, and parental preference." },
        "very-low": { name: "Very-low-risk group", risk: spec.veryLowRisk, rec: "The rule says CT is not recommended." },
      }[group]
      return {
        value: text.name,
        display: `PECARN: ${text.name}`,
        secondary: [
          { label: "Risk of clinically important traumatic brain injury (study data)", value: text.risk },
          { label: "What the rule says", value: text.rec },
        ],
        interpretation: `${text.rec} This is a decision rule that supports, and does not replace, clinical judgement. ${spec.population}`,
        warnings: ["Applies only to children who meet the inclusion criteria and have no exclusion. Follow local protocol."],
      }
    },
    limitations: [spec.population, "Derived and validated in emergency departments in the United States."],
  }
}

export const pecarnUnder2Calculator = buildRule({
  id: "pecarn-head-injury-under-2",
  name: "PECARN head injury rule: children under 2 years",
  shortName: "PECARN <2y",
  description: "Classifies a child under 2 years with minor blunt head trauma into the PECARN very-low, intermediate or high-risk group for clinically important brain injury.",
  highIds: ["otherAms", "palpableFracture"],
  intermediateIds: ["nonFrontalHematoma", "loc5s", "severeMechanism", "notActingNormally"],
  extraInputs: [
    yn("otherAms", "Other signs of altered mental status?", "Agitation, somnolence, repetitive questioning or slow response to verbal communication."),
    yn("palpableFracture", "Palpable skull fracture?"),
    yn("nonFrontalHematoma", "Occipital, parietal or temporal scalp hematoma?"),
    yn("loc5s", "Loss of consciousness for 5 seconds or more?"),
    yn("severeMechanism", "Severe mechanism of injury?", "Motor vehicle crash with ejection, death of another passenger or rollover; pedestrian or cyclist without a helmet struck by a motor vehicle; fall of more than 0.9 m (3 ft); head struck by a high-impact object."),
    yn("notActingNormally", "Not acting normally according to the parent?"),
  ],
  highRisk: "about 4.4%",
  intermediateRisk: "about 0.9%",
  veryLowRisk: "below 0.02%",
  population: "For children under 2 years with GCS 14 to 15 after blunt head trauma in the last 24 hours.",
})

export const pecarn2To17Calculator = buildRule({
  id: "pecarn-head-injury-2-to-17",
  name: "PECARN head injury rule: children 2 to under 18 years",
  shortName: "PECARN 2-17y",
  description: "Classifies a child aged 2 to under 18 years with minor blunt head trauma into the PECARN very-low, intermediate or high-risk group for clinically important brain injury.",
  highIds: ["otherAms", "basilarFracture"],
  intermediateIds: ["loc", "vomiting", "severeHeadache", "severeMechanism"],
  extraInputs: [
    yn("otherAms", "Other signs of altered mental status?", "Agitation, somnolence, repetitive questioning or slow response to verbal communication."),
    yn("basilarFracture", "Signs of basilar skull fracture?", "For example hemotympanum, raccoon eyes, Battle sign, or cerebrospinal fluid leak from the ear or nose."),
    yn("loc", "Any loss of consciousness?"),
    yn("vomiting", "Vomiting?"),
    yn("severeHeadache", "Severe headache?"),
    yn("severeMechanism", "Severe mechanism of injury?", "Motor vehicle crash with ejection, death of another passenger or rollover; pedestrian or cyclist without a helmet struck by a motor vehicle; fall of more than 1.5 m (5 ft); head struck by a high-impact object."),
  ],
  highRisk: "about 4.3%",
  intermediateRisk: "about 0.9%",
  veryLowRisk: "below 0.05%",
  population: "For children aged 2 to under 18 years with GCS 14 to 15 after blunt head trauma in the last 24 hours.",
})

