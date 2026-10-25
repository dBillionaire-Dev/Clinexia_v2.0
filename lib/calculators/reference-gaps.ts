import type { CalculatorDefinition } from "./types"
import { CALCULATOR_CATEGORY_LABELS } from "./types"
import { getCalculatorReferences } from "./dosing-references"
import { getReferenceStatus } from "./formula-info"

const cell = (s: string | undefined) => (s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim()

/**
 * The text of docs/integration/reference-gaps.md: every calculator whose reference status is "review-needed", grouped by
 * category. Generated, never hand-edited, and no reference is changed to "fix" a gap. A test keeps the file in sync.
 */
export function buildReferenceGapsMarkdown(calculators: CalculatorDefinition[]): string {
  const categories = Array.from(new Set(calculators.map((c) => c.category)))
  const lines: string[] = [
    "# Reference gaps",
    "",
    "Generated from `getCalculatorReferences()`. Do not edit by hand: run `pnpm integration:snapshots` after a reference changes.",
    "A calculator is listed as `review-needed` when any of its references has that status. Nothing here was changed to close a gap;",
    "this is a worklist for whoever owns the clinical content.",
    "",
    "## Status counts by category",
    "",
    "| Category | Calculators | current | supporting | review-needed |",
    "|---|---|---|---|---|",
  ]
  const gaps: { category: string; items: CalculatorDefinition[] }[] = []
  for (const category of categories) {
    const inCategory = calculators.filter((c) => c.category === category)
    const counts = { current: 0, supporting: 0, "review-needed": 0 }
    for (const c of inCategory) {
      const status = getReferenceStatus(c)
      if (status) counts[status]++
    }
    lines.push(`| ${CALCULATOR_CATEGORY_LABELS[category]} | ${inCategory.length} | ${counts.current} | ${counts.supporting} | ${counts["review-needed"]} |`)
    const items = inCategory.filter((c) => getReferenceStatus(c) === "review-needed")
    if (items.length) gaps.push({ category: CALCULATOR_CATEGORY_LABELS[category], items })
  }
  lines.push("", "## Calculators whose reference is `review-needed`", "")
  if (gaps.length === 0) {
    lines.push("_None. No calculator currently has a reference with status `review-needed`._", "")
  } else {
    for (const { category, items } of gaps) {
      lines.push(`### ${category} (${items.length})`, "", "| Calculator | Reference | Version | Last verified | Note |", "|---|---|---|---|---|")
      for (const c of items) {
        for (const r of getCalculatorReferences(c).filter((x) => x.status === "review-needed")) {
          lines.push(`| \`${c.id}\` | ${cell(r.source)} | ${cell(r.version)} | ${cell(r.lastVerified)} | ${cell(r.note)} |`)
        }
      }
      lines.push("")
    }
  }
  return lines.join("\n")
}
