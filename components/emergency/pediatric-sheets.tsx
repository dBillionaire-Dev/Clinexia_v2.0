"use client"
// clinexia-upgrade:phase10 — more pediatric emergency doses, one collapsible sheet each. Only approved sheets appear.
import { SHEET_SOURCES, SHEETS_DATA_VERSION } from "@/lib/pediatric/sheets-data"
import { buildSheet, releasedSheets, type SheetLine } from "@/lib/pediatric/sheets"
import type { Tone } from "@/lib/emergency/dosing"

const TONE: Record<Tone, string> = { red: "border-red-500 bg-red-950/60", violet: "border-violet-400 bg-violet-950/60", blue: "border-sky-400 bg-sky-950/60", amber: "border-amber-400 bg-amber-950/60" }

function LineCard({ line }: { line: SheetLine }) {
  return (
    <article className={`rounded-xl border-l-8 p-4 ${TONE[line.tone]}`} aria-label={line.drug}>
      <h4 className="text-base font-bold text-zinc-100">{line.drug}</h4>
      <p className="mt-1 text-3xl font-black leading-tight text-white">{line.headline}</p>
      {line.detail ? <p className="mt-1 text-lg font-semibold text-zinc-100">{line.detail}</p> : null}
      <p className="mt-2 text-sm text-zinc-200"><b>Route:</b> {line.route}</p>
      <p className="text-sm text-zinc-200"><b>Repeat:</b> {line.repeat}</p>
      {line.notes.map((n) => <p key={n} className="mt-1 text-sm text-zinc-300">{n}</p>)}
    </article>
  )
}

export function PediatricSheets({ weightKg }: { weightKg: number }) {
  const sheets = releasedSheets()
  if (sheets.length === 0) return null
  return (
    <section aria-label="More pediatric emergency doses" className="space-y-3">
      <h2 className="text-lg font-black uppercase tracking-wide text-zinc-300">More pediatric emergency doses</h2>
      {sheets.map((s) => {
        const r = buildSheet(s.id, weightKg)
        return (
          <details key={s.id} className="rounded-xl border-2 border-zinc-600 bg-zinc-900 p-3">
            <summary className="cursor-pointer text-xl font-black text-white">{s.title}</summary>
            <div className="mt-3 space-y-3">
              <p className="text-sm text-zinc-300">{s.intro}</p>
              {r.ok ? r.lines.map((l) => <LineCard key={l.id} line={l} />) : <p role="alert" className="text-amber-200">{r.error}</p>}
              {r.ok ? <p className="text-xs text-zinc-400">Sources: {Array.from(new Set(r.lines.flatMap((l) => l.sourceIds))).sort().map((i, n) => <span key={i}>{n ? "; " : ""}<a href={SHEET_SOURCES[i].url} target="_blank" rel="noreferrer noopener" className="underline">{SHEET_SOURCES[i].title}</a></span>)}. Data version {SHEETS_DATA_VERSION}.</p> : null}
            </div>
          </details>
        )
      })}
    </section>
  )
}
