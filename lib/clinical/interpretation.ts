// clinexia-upgrade:phase2 — interpretation bands.
//
// A band is shown only when exactly one band matches the result (and any conditions such as sex).
// No match, or an ambiguous match, returns null: the app then shows the raw result with no category.
// It never picks the "closest" band.

export interface Band {
  id: string
  /** Inclusive lower bound of the score. */
  min: number
  /** Inclusive upper bound of the score. */
  max: number
  label: string
  meaning: string
  /** Indexes into the evidence record's sources that support this band. */
  sourceIds: number[]
  /** The band applies only when every listed input equals the given value (e.g. { sex: "female" }). */
  appliesTo?: Record<string, string>
}

export function findBand(bands: Band[], value: number, inputs: Record<string, string | number> = {}): Band | null {
  if (!Number.isFinite(value)) return null
  const matches = bands.filter((band) => {
    if (value < band.min || value > band.max) return false
    if (!band.appliesTo) return true
    return Object.entries(band.appliesTo).every(([key, expected]) => String(inputs[key]) === expected)
  })
  return matches.length === 1 ? matches[0] : null
}

/** Lists gaps and overlaps for integer scores between min and max, for each scenario. Empty list = clean. */
export function auditBands(
  bands: Band[],
  domain: { min: number; max: number },
  scenarios: Array<Record<string, string>> = [{}],
): string[] {
  const problems: string[] = []
  for (const scenario of scenarios) {
    for (let value = domain.min; value <= domain.max; value += 1) {
      const count = bands.filter((band) => {
        if (value < band.min || value > band.max) return false
        return !band.appliesTo || Object.entries(band.appliesTo).every(([k, v]) => scenario[k] === v)
      }).length
      if (count === 0) problems.push(`gap at ${value} (${JSON.stringify(scenario)})`)
      if (count > 1) problems.push(`overlap at ${value} (${JSON.stringify(scenario)})`)
    }
  }
  return problems
}
