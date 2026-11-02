// clinexia-upgrade:phase2 — "you may also want" hints shown with a result. Rules are plain code so they can be tested.
// A hint that links to another tool appears only when that tool actually exists in this build (for example only
// after it has been approved), so the app never points users at something it cannot open.
import { getCalculatorById } from "@/lib/calculators/registry"

export interface Suggestion {
  id: string
  text: string
  href?: string
  linkLabel?: string
}

type Lookup = (id: string) => { id: string; category: string; name: string } | undefined

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""))
  return Number.isFinite(n) ? n : null
}

export function getSuggestions(calculatorId: string, inputs: Record<string, string | number> | null, lookup: Lookup = getCalculatorById as Lookup): Suggestion[] {
  const out: Suggestion[] = []
  if (calculatorId === "ldl-friedewald" && inputs) {
    const tg = num(inputs.tg)
    const unit = String(inputs.unit ?? "mg/dL")
    const limit = unit === "mmol/L" ? 4.5 : 400
    const sampson = lookup("ldl-sampson")
    if (tg !== null && tg > limit && sampson) {
      out.push({
        id: "friedewald-to-sampson",
        text: "Triglycerides are above the Friedewald limit. A direct LDL measurement is preferred. If one is not available, the Sampson (NIH) equation can estimate LDL when triglycerides are up to 800 mg/dL (9.0 mmol/L).",
        href: `/calculators/${sampson.category}/${sampson.id}`,
        linkLabel: "Open the Sampson LDL calculator",
      })
    }
  }
  return out
}
