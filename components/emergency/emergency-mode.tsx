"use client"
// clinexia-upgrade:phase6 — Emergency Mode: one screen, high contrast, age group + weight in, doses out.
// Self-contained colours (not tied to the app theme) so it looks the same in light and dark mode and in both apps.
// Nothing is stored: weight and age group live in this component's state only and vanish on exit.

import { useEffect, useMemo, useState } from "react"
import { AGE_GROUP_LABEL, buildDashboard, type AgeGroup, type DoseLine, type Tone } from "@/lib/emergency/dosing"
import { DOSE_DATA_VERSION, EMERGENCY_SOURCES, WEIGHT_LIMITS } from "@/lib/emergency/dose-data"
import { parseStrictNumber } from "@/lib/clinical/input-validation"
import { isReleased, previewEnabled } from "@/lib/clinical/review"
import { WeightEstimator, type EstimateChoice } from "@/components/emergency/weight-estimator" // clinexia-upgrade:phase9 estimate

const TONE: Record<Tone, string> = {
  red: "border-red-500 bg-red-950/60",
  violet: "border-violet-400 bg-violet-950/60",
  blue: "border-sky-400 bg-sky-950/60",
  amber: "border-amber-400 bg-amber-950/60",
}
const GROUPS: AgeGroup[] = ["neonate", "pediatric", "adult"]

function Card({ line }: { line: DoseLine }) {
  return (
    <article className={`rounded-xl border-l-8 p-4 ${TONE[line.tone]}`} aria-label={line.drug}>
      <h3 className="text-base font-bold text-zinc-100">{line.drug}</h3>
      <p className="mt-1 text-4xl font-black leading-tight text-white">{line.headline}</p>
      {line.detail ? <p className="mt-1 text-lg font-semibold text-zinc-100">{line.detail}</p> : null}
      <p className="mt-2 text-sm text-zinc-200"><b>Route:</b> {line.route}</p>
      <p className="text-sm text-zinc-200"><b>Repeat:</b> {line.repeat}</p>
      {line.notes.map((n) => <p key={n} className="mt-1 text-sm text-zinc-300">{n}</p>)}
    </article>
  )
}

export function EmergencyMode({ onExit }: { onExit: () => void }) {
  const released = isReleased("emergency-doses")
  const [group, setGroup] = useState<AgeGroup | null>(null)
  const [text, setText] = useState("")
  const [estimate, setEstimate] = useState<EstimateChoice | null>(null) // clinexia-upgrade:phase9 state

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onExit() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onExit])

  const weight = text.trim() === "" ? null : parseStrictNumber(text)
  const dashboard = useMemo(() => {
    if (!group) return null
    if (text.trim() !== "" && weight === null) return { ok: false as const, error: "Weight must be a number." }
    return buildDashboard(group, weight)
  }, [group, text, weight])

  const pick = (g: AgeGroup) => { setGroup(g); setText(g === "adult" ? "" : String(WEIGHT_LIMITS[g].start)) }
  const lim = group ? WEIGHT_LIMITS[group] : null
  const bump = (d: number) => {
    if (!lim) return
    const base = weight ?? lim.start
    setText(String(Math.round((base + d) * 10) / 10))
  }
  const sections = dashboard?.ok ? Array.from(new Set(dashboard.lines.map((l) => l.section))) : []

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black text-white" role="dialog" aria-modal="true" aria-label="Emergency Mode">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-2 border-red-600 bg-black px-4 py-3">
        <h1 className="text-xl font-black tracking-wide text-red-400">EMERGENCY MODE</h1>
        <button type="button" onClick={onExit} className="min-h-[48px] rounded-lg border-2 border-white px-5 text-base font-bold text-white">Exit</button>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-4">
        {previewEnabled() ? <p role="alert" className="rounded-lg bg-red-700 p-3 text-center text-sm font-black text-white">PREVIEW BUILD: doses are pending clinical review. Not for clinical use.</p> : null}

        {!released ? (
          <p role="alert" className="rounded-lg border border-zinc-600 p-4 text-lg">Emergency dosing is not available in this version. It is shown only after clinical review.</p>
        ) : (
          <>
            <section aria-label="Age group">
              <p className="mb-2 text-sm font-bold uppercase text-zinc-400">Age group</p>
              <div className="grid grid-cols-3 gap-2">
                {GROUPS.map((g) => (
                  <button key={g} type="button" aria-pressed={group === g} onClick={() => pick(g)} className={`min-h-[64px] rounded-xl border-2 text-lg font-black ${group === g ? "border-white bg-white text-black" : "border-zinc-500 bg-zinc-900 text-white"}`}>{AGE_GROUP_LABEL[g]}</button>
                ))}
              </div>
            </section>

            {group && lim ? (
              <section aria-label="Weight">
                <label htmlFor="em-weight" className="mb-2 block text-sm font-bold uppercase text-zinc-400">Weight (kg){group === "adult" ? ", optional" : ""}</label>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Decrease weight" onClick={() => bump(-lim.step)} className="min-h-[56px] min-w-[56px] rounded-xl border-2 border-zinc-500 bg-zinc-900 text-3xl font-black">−</button>
                  <input id="em-weight" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[56px] w-full rounded-xl border-2 border-zinc-500 bg-zinc-900 px-3 text-center text-4xl font-black text-white" aria-describedby="em-weight-help" />
                  <button type="button" aria-label="Increase weight" onClick={() => bump(lim.step)} className="min-h-[56px] min-w-[56px] rounded-xl border-2 border-zinc-500 bg-zinc-900 text-3xl font-black">+</button>
                </div>
                <input type="range" aria-label="Weight slider" min={lim.sliderMin} max={lim.sliderMax} step={lim.step} value={weight !== null && weight >= lim.sliderMin && weight <= lim.sliderMax ? weight : lim.start} onChange={(e) => setText(e.target.value)} className="mt-3 h-8 w-full accent-white" />
                <p id="em-weight-help" className="mt-1 text-sm text-zinc-400">Type any weight from {lim.min} to {lim.max} kg. Use a measured or length-based weight where you can. This app does not estimate weight.</p>
              </section>
            ) : <p className="text-lg text-zinc-300">Choose an age group to begin.</p>}

            {group === "pediatric" && isReleased("emergency-weight-estimation") ? <WeightEstimator onUse={(c) => { setText(String(c.kg)); setEstimate(c) }} /> : null}
            {dashboard && !dashboard.ok ? <p role="alert" className="rounded-lg border-2 border-amber-400 p-4 text-lg font-bold text-amber-200">{dashboard.error}</p> : null}

            {dashboard?.ok ? (
              <div className="space-y-6" aria-live="polite">
                {estimate && weight === estimate.kg ? <p role="alert" className="rounded-lg border-2 border-amber-400 bg-amber-950/60 p-3 text-base font-bold text-amber-100">ESTIMATED WEIGHT: {estimate.kg} kg ({estimate.label}). The real weight may be very different. Replace it with a measured or length-based weight as soon as you can.</p> : null}
                {group !== "adult" || weight !== null ? <p className="text-xl font-black">{AGE_GROUP_LABEL[group!]}{weight !== null ? `, ${weight} kg` : ""}</p> : <p className="text-xl font-black">Adult (fixed doses)</p>}
                {sections.map((s) => (
                  <section key={s} aria-label={s} className="space-y-3">
                    <h2 className="text-lg font-black uppercase tracking-wide text-zinc-300">{s}</h2>
                    {dashboard.lines.filter((l) => l.section === s).map((l) => <Card key={l.id} line={l} />)}
                  </section>
                ))}
                {dashboard.warnings.map((w) => <p key={w} className="text-sm text-zinc-300">{w}</p>)}
              </div>
            ) : null}

            <footer className="space-y-1 border-t border-zinc-700 pt-4 text-xs text-zinc-400">
              <p>Doses are from the American Heart Association 2025 guidelines. Always follow your local protocol, check the vial concentration, and have a second person check the dose. Decision support only.</p>
              <p>Dose data version {DOSE_DATA_VERSION}. Sources: {EMERGENCY_SOURCES.map((s, i) => <span key={s.url}>{i ? "; " : ""}<a href={s.url} target="_blank" rel="noreferrer noopener" className="underline">{s.title}</a></span>)}</p>
              <p>Nothing entered here is saved.</p>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
