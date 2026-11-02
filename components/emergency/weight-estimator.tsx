"use client"
// clinexia-upgrade:phase9 — "Don't know the weight? Estimate it from age". Shown only after approval.
// Nothing is applied automatically: the user must press "Use this weight".
import { useMemo, useState } from "react"
import { ESTIMATE_SOURCES, estimateWeights } from "@/lib/emergency/weight-estimate"

export interface EstimateChoice { kg: number; label: string }

export function WeightEstimator({ onUse }: { onUse: (choice: EstimateChoice) => void }) {
  const [years, setYears] = useState("")
  const [months, setMonths] = useState("0")
  const parsed = useMemo(() => {
    if (years.trim() === "" || !/^\d+$/.test(years.trim()) || !/^\d+$/.test(months.trim() || "0")) return null
    return estimateWeights(Number(years), Number(months || "0"))
  }, [years, months])

  return (
    <details className="rounded-xl border-2 border-amber-500 bg-amber-950/30 p-4">
      <summary className="cursor-pointer text-lg font-black text-amber-200">Weight not known? Estimate it from age</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-amber-100">Last resort. A measured weight or a length-based tape is safer.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm font-bold text-zinc-300">Years
            <input inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} className="mt-1 min-h-[56px] w-full rounded-xl border-2 border-zinc-500 bg-zinc-900 px-3 text-center text-3xl font-black text-white" />
          </label>
          <label className="block text-sm font-bold text-zinc-300">Months (0 to 11)
            <input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} className="mt-1 min-h-[56px] w-full rounded-xl border-2 border-zinc-500 bg-zinc-900 px-3 text-center text-3xl font-black text-white" />
          </label>
        </div>

        {parsed && !parsed.ok ? <p role="alert" className="rounded-lg border-2 border-amber-400 p-3 text-base font-bold text-amber-200">{parsed.error}</p> : null}

        {parsed?.ok ? (
          <div className="space-y-3">
            {parsed.estimates.map((e) => (
              <div key={e.id + e.label} className="rounded-xl border-2 border-zinc-600 bg-zinc-900 p-3">
                <p className="text-sm text-zinc-300">{e.label}: {e.formula}</p>
                <p className="text-4xl font-black text-white">{e.kg} kg</p>
                <button type="button" onClick={() => onUse({ kg: e.kg, label: `${e.label}, age ${parsed.completedYears > 0 ? `${parsed.completedYears} y` : `${parsed.totalMonths} mo`}` })} className="mt-2 min-h-[48px] rounded-lg border-2 border-white px-4 text-base font-bold text-white">Use {e.kg} kg as an ESTIMATE</button>
              </div>
            ))}
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">{parsed.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            <p className="text-xs text-zinc-400">Sources: {ESTIMATE_SOURCES.map((s, i) => <span key={s.url}>{i ? "; " : ""}<a href={s.url} target="_blank" rel="noreferrer noopener" className="underline">{s.title}</a></span>)}</p>
          </div>
        ) : null}
      </div>
    </details>
  )
}
