// clinexia-upgrade:phase9 — estimating a child's weight from age when it cannot be measured. THIS IS A DOSING INPUT.
//
// Rules:
//  - Two published age formulas are shown side by side where both apply, so a large disagreement is visible.
//  - Nothing is chosen for the user. They press "Use this weight", and the dashboard then says ESTIMATED, loudly.
//  - No estimate below 1 month (weigh the baby) or above 12 years (formulas not defined; use a measured or length-based weight).
//  - Always shown with the known ways these formulas go wrong. Overestimating weight means overdosing.
//
// Formulas (completed years; infants in completed months):
//   APLS 2011:   1 to 11 months  0.5 x months + 4      1 to 5 years  2 x years + 8      6 to 12 years  3 x years + 7
//   Luscombe & Owens: 3 x years + 7, intended for 1 to 10 years

export interface WeightEstimateSource { title: string; citation: string; url: string }

export const ESTIMATE_SOURCES: WeightEstimateSource[] = [
  { title: "Validation of Advanced Paediatric Life Support formulas for weight calculation in a multiethnic population", citation: "Sets out the APLS formulas used here and compares them with measured weights.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3463167/" }, // 0
  { title: "Are APLS formulae for estimating weight appropriate for use in children admitted to PICU?", citation: "Resuscitation. Reports over- and under-estimation by age band.", url: "https://www.sciencedirect.com/science/article/abs/pii/S0300957214004572" }, // 1
  { title: "Comparison of paediatric weight estimation methods at a tertiary hospital in Ghana", citation: "Afr J Emerg Med. Compares age formulas with a length-based tape in an African setting.", url: "https://www.sciencedirect.com/science/article/pii/S2211419X21000227" }, // 2
  { title: "Comparison of age-based weight estimation with actual measured weight in children aged one to twelve years in Enugu", citation: "Niger J Clin Pract. 2020. Nigerian children.", url: "https://journals.lww.com/njcp/fulltext/2020/23090/comparison_of_age_based_weight_estimation_with.8.aspx" }, // 3
]

export interface WeightEstimate {
  id: "apls" | "luscombe" | "both"
  label: string
  kg: number
  formula: string
  sourceIds: number[]
}

export type EstimateResult =
  | { ok: true; completedYears: number; totalMonths: number; estimates: WeightEstimate[]; differenceKg: number | null; warnings: string[] }
  | { ok: false; error: string }

const isWhole = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n)

export const ESTIMATE_WARNINGS = [
  "An estimate can be far from the real weight. Use a measured weight, or a length-based tape, as soon as you can.",
  "Studies of these age formulas report both over- and under-estimates. For infants and for some older children they tend to over-estimate, which would mean too much drug.",
  "Formulas developed in high-income countries may over-estimate weight in children from other settings, including parts of Africa. Local studies of the same formulas are listed under Sources.",
  "Children who are thin, overweight or short for their age are the most likely to be badly estimated.",
]

export function estimateWeights(years: unknown, months: unknown): EstimateResult {
  if (!isWhole(years) || !isWhole(months)) return { ok: false, error: "Enter the age as whole numbers of years and months." }
  if (years < 0 || months < 0 || months > 11) return { ok: false, error: "Months must be 0 to 11, and years cannot be negative." }
  const totalMonths = years * 12 + months
  if (totalMonths < 1) return { ok: false, error: "No estimate is given for a baby under 1 month old. Weigh the baby." }
  if (years > 12) return { ok: false, error: "No age formula applies above 12 years. Use a measured or length-based weight." }

  const estimates: WeightEstimate[] = []
  if (years < 1) {
    estimates.push({ id: "apls", label: "APLS 2011 (infant)", kg: 0.5 * months + 4, formula: `0.5 × ${months} months + 4`, sourceIds: [0, 1] })
  } else if (years <= 5) {
    estimates.push({ id: "apls", label: "APLS 2011", kg: 2 * years + 8, formula: `2 × ${years} years + 8`, sourceIds: [0, 1] })
    estimates.push({ id: "luscombe", label: "Luscombe and Owens", kg: 3 * years + 7, formula: `3 × ${years} years + 7`, sourceIds: [0] })
  } else if (years <= 10) {
    estimates.push({ id: "both", label: "APLS 2011 and Luscombe and Owens (same formula at this age)", kg: 3 * years + 7, formula: `3 × ${years} years + 7`, sourceIds: [0, 1] })
  } else {
    estimates.push({ id: "apls", label: "APLS 2011 (the Luscombe formula is not intended above 10 years)", kg: 3 * years + 7, formula: `3 × ${years} years + 7`, sourceIds: [0, 1] })
  }
  const kgs = estimates.map((e) => e.kg)
  const differenceKg = kgs.length > 1 ? Math.max(...kgs) - Math.min(...kgs) : null
  const warnings = [...ESTIMATE_WARNINGS]
  if (differenceKg !== null && differenceKg > 0) warnings.unshift(`The two formulas differ by ${differenceKg} kg here. That disagreement is a sign of how uncertain the estimate is.`)
  return { ok: true, completedYears: years, totalMonths, estimates, differenceKg, warnings }
}
