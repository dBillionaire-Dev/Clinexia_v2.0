import { calculators } from "./calculators/registry"
import { CALCULATOR_CATEGORY_LABELS, CALCULATOR_SUBCATEGORY_LABELS } from "./calculators/types"
import { conversionCategories } from "./conversions/registry"
import { labTools } from "./lab-tools-registry"
import { getToolSynonyms, hasExactSynonym } from "./clinical/tool-synonyms" // clinexia-upgrade:phase1 synonyms

export interface SearchResult {
  id: string
  title: string
  subtitle: string
  href: string
  type: "calculator" | "conversion" | "tool"
}

type SearchableCalculator = (typeof calculators)[number]

const CONCEPT_ALIASES: Record<string, string[]> = {
  pediatric: ["pediatric", "paediatric", "child", "children", "infant", "neonate", "young infant"],
  antimalarial: ["antimalarial", "antimalaria", "malaria", "act", "artemisinin", "artemisinin-based"],
  antibiotic: ["antibiotic", "antimicrobial", "antibacterial", "anti-infective"],
  chemotherapy: ["chemotherapy", "chemo", "cytotoxic", "anticancer", "anti-cancer", "oncology"],
  renal: ["renal", "kidney", "egfr", "gfr", "creatinine clearance", "crcl"],
  dilution: ["dilution", "dilute", "serial dilution", "c1v1c2v2"],
  spectrophotometry: ["spectrophotometry", "spectrophotometer", "spectro", "absorbance", "transmittance", "beer lambert", "standard curve", "photometry", "optical density"],
  hematology: ["hematology", "haematology", "blood", "cbc", "coagulation", "transfusion", "anemia", "anaemia"],
  cardiovascular: ["cardiovascular", "cardiac", "heart", "hypertension", "arrhythmia", "anticoagulation", "antiplatelet"],
  transplant: ["transplant", "stem cell", "hct", "engraftment", "chimerism", "cd34"],
  chemistry: ["chemistry", "clinical chemistry", "electrolyte", "sodium", "calcium", "glucose", "lipid", "osmolality"],
  microbiology: ["microbiology", "culture", "cfu", "colony", "serial dilution", "susceptibility"],
  laboratory: ["laboratory", "lab", "reagent", "solution", "molarity", "normality", "preparation"],
  oncology: ["oncology", "cancer", "chemotherapy", "chemo", "cytotoxic", "anticancer", "anti-cancer"],
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[↔←/\\_–-]/g, " ")
    .replace(/[^a-z0-9µ²³.%+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokens(value: string): string[] {
  return normalize(value).split(/\s+/).filter(Boolean)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length]
}

function fuzzyTokenMatch(token: string, fieldTokens: string[]): { matched: boolean; score: number } {
  if (fieldTokens.includes(token)) return { matched: true, score: 5 }
  if (fieldTokens.some((candidate) => candidate.startsWith(token) || token.startsWith(candidate))) return { matched: true, score: 3 }

  const maxDistance = token.length >= 8 ? Math.max(2, Math.ceil(token.length * 0.36)) : token.length >= 5 ? 2 : 1
  let best = Infinity
  for (const candidate of fieldTokens) {
    if (Math.abs(candidate.length - token.length) > maxDistance) continue
    best = Math.min(best, levenshtein(token, candidate))
  }
  return best <= maxDistance ? { matched: true, score: Math.max(1, 3 - best) } : { matched: false, score: 0 }
}

function conceptForToken(token: string): string | undefined {
  for (const [concept, aliases] of Object.entries(CONCEPT_ALIASES)) {
    const normalizedAliases = aliases.flatMap((alias) => tokens(alias))
    if (aliases.some((alias) => normalize(alias) === token)) return concept
    if (normalizedAliases.includes(token)) return concept
    const match = fuzzyTokenMatch(token, normalizedAliases)
    if (match.matched && token.length >= 5) return concept
  }
  return undefined
}

function queryConcepts(queryTokens: string[]): Set<string> {
  const concepts = new Set<string>()
  for (const token of queryTokens) {
    const concept = conceptForToken(token)
    if (concept) concepts.add(concept)
  }
  const phrase = queryTokens.join(" ")
  for (const [concept, aliases] of Object.entries(CONCEPT_ALIASES)) {
    if (aliases.some((alias) => normalize(alias) === phrase)) concepts.add(concept)
  }
  return concepts
}

function calculatorSearchText(c: SearchableCalculator): string[] {
  const subcategory = c.subcategory ? CALCULATOR_SUBCATEGORY_LABELS[c.category][c.subcategory] ?? "" : ""
  return tokens([
    c.name,
    c.shortName ?? "",
    c.description,
    CALCULATOR_CATEGORY_LABELS[c.category],
    subcategory,
    ...(c.keywords ?? []),
    ...getToolSynonyms(c.id),
  ].join(" "))
}

function calculatorConceptMatch(c: SearchableCalculator, concept: string): boolean {
  const subcategory = c.subcategory ? c.subcategory.toLowerCase() : ""
  const label = CALCULATOR_CATEGORY_LABELS[c.category].toLowerCase()
  const keywords = (c.keywords ?? []).map((k) => k.toLowerCase()).join(" ")
  const text = `${label} ${subcategory} ${keywords}`

  if (concept === "antimalarial") return c.category === "dosing" && c.subcategory === "antimalarial"
  if (concept === "chemotherapy") return c.category === "oncology" || text.includes("chemotherapy")
  if (concept === "pediatric") {
    // The antimalarial section contains weight-band regimens intended to cover children as well as adults.
    if (c.category === "dosing" && c.subcategory === "antimalarial") return true
    return /pediatric|paediatric|children|child|infant|neonate|young infant/.test(text)
  }
  if (concept === "renal") return c.category === "renal" || c.subcategory === "renal-adjustment" || /renal|egfr|gfr|creatinine clearance|crcl/.test(text)
  if (concept === "antibiotic") return c.subcategory === "antibiotic" || /antibiotic|antimicrobial|antibacterial/.test(text)
  if (concept === "dilution") return c.category === "lab-solutions" || /dilution|dilute|c1v1/.test(text)
  if (concept === "spectrophotometry") return c.category === "spectrophotometry"
  if (concept === "hematology") return c.category === "hematology"
  if (concept === "cardiovascular") return c.category === "cardiovascular"
  if (concept === "transplant") return c.category === "stem-cell-transplant"
  if (concept === "chemistry") return c.category === "chemistry"
  if (concept === "microbiology") return c.category === "microbiology"
  if (concept === "laboratory") return c.category === "lab-solutions"
  if (concept === "oncology") return c.category === "oncology"
  return false
}

function scoreCalculator(c: SearchableCalculator, queryTokens: string[]): number {
  const fieldTokens = calculatorSearchText(c)
  const concepts = queryConcepts(queryTokens)
  let score = 0
  let matched = 0

  for (const token of queryTokens) {
    const concept = conceptForToken(token)
    if (concept && calculatorConceptMatch(c, concept)) {
      score += 8
      matched += 1
      continue
    }

    const match = fuzzyTokenMatch(token, fieldTokens)
    if (match.matched) {
      score += match.score
      matched += 1
    }
  }

  // A query containing multiple concepts should strongly prefer tools matching
  // all of them, while still allowing useful partial results.
  if (concepts.size > 1) {
    const matchedConcepts = [...concepts].filter((concept) => calculatorConceptMatch(c, concept)).length
    score += matchedConcepts * 3
    if (matchedConcepts === concepts.size) score += 10
    else if (matchedConcepts === 0 && matched === 0) return 0
  }

  if (!matched && !concepts.size) return 0
  if (!matched && concepts.size && ![...concepts].some((concept) => calculatorConceptMatch(c, concept))) return 0

  const normalizedQuery = queryTokens.join(" ")
  const normalizedName = normalize(c.name)
  if (normalizedName === normalizedQuery) score += 12
  else if (normalizedName.includes(normalizedQuery)) score += 7
  else if (queryTokens.every((t) => normalizedName.includes(t))) score += 5

  if (queryTokens.some((t) => t === normalize(c.subcategory ?? ""))) score += 4
  return score
}

export function searchCalculators(query: string): SearchableCalculator[] {
  const queryTokens = tokens(query)
  if (!queryTokens.length) return []

  const ranked = calculators
    .map((calculator) => ({ calculator, score: scoreCalculator(calculator, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => Number(hasExactSynonym(b.calculator.id, query)) - Number(hasExactSynonym(a.calculator.id, query)) || b.score - a.score || a.calculator.name.localeCompare(b.calculator.name))
    .map(({ calculator }) => calculator)

  // A query naming several clinical concepts ("pediatric antimalarial") is an
  // intent, not a keyword bag: once tools satisfying every concept exist, a
  // partial keyword match is noise rather than a useful broader result. The
  // broad ranking is still returned when nothing satisfies the full intent.
  const concepts = queryConcepts(queryTokens)
  if (concepts.size > 1) {
    const exact = ranked.filter((calculator) =>
      [...concepts].every((concept) => calculatorConceptMatch(calculator, concept)),
    )
    if (exact.length) return exact
  }

  return ranked
}

export function globalSearch(query: string): SearchResult[] {
  const q = query.trim()
  if (!q) return []

  const calcResults: SearchResult[] = searchCalculators(q).map((c) => {
    const subcategory = c.subcategory ? CALCULATOR_SUBCATEGORY_LABELS[c.category][c.subcategory] ?? "" : ""
    return {
      id: c.id,
      title: c.name,
      subtitle: subcategory ? `${CALCULATOR_CATEGORY_LABELS[c.category]} · ${subcategory}` : CALCULATOR_CATEGORY_LABELS[c.category],
      href: `/calculators/${c.category}/${c.id}`,
      type: "calculator" as const,
    }
  })

  const queryTokens = tokens(q)
  const conversionResults: SearchResult[] = conversionCategories
    .map((cat) => {
      const haystack = tokens([cat.name, ...cat.units.map((u) => `${u.name} ${u.symbol}`)].join(" "))
      const score = queryTokens.reduce((sum, token) => sum + fuzzyTokenMatch(token, haystack).score, 0)
      return { cat, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.cat.name.localeCompare(b.cat.name))
    .map(({ cat }) => ({ id: cat.id, title: cat.name, subtitle: "Conversion", href: `/conversions/${cat.id}`, type: "conversion" as const }))

  const toolResults: SearchResult[] = labTools
    .map((tool) => {
      const haystack = tokens([tool.name, tool.description, ...(tool.keywords ?? [])].join(" "))
      const score = queryTokens.reduce((sum, token) => sum + fuzzyTokenMatch(token, haystack).score, 0)
      return { tool, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .map(({ tool }) => ({ id: tool.id, title: tool.name, subtitle: "Lab Tool", href: tool.href, type: "tool" as const }))

  return [...calcResults, ...conversionResults, ...toolResults]
}
