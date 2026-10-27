import type { NoticeLine } from "@/lib/smart/provenance"

/** Shown above the form when values were filled in from the patient's record (SMART on FHIR): the date of each result and a warning when it is old. */
export function SmartPrefillNotice({ lines }: { lines: NoticeLine[] }) {
  const anyStale = lines.some((l) => l.stale)
  return (
    <div role="status" className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2" data-smart-prefill>
      <p className="font-medium">Filled in from the patient's record</p>
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={l.inputId} className={l.stale ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
            <span className="font-medium text-foreground">{l.label}</span>
            {l.from === "patient"
              ? ": from the patient record"
              : `: result dated ${l.observedAt} (${l.ageDays === 0 ? "today" : `${l.ageDays} day${l.ageDays === 1 ? "" : "s"} ago`})`}
            {l.stale ? ` ⚠ older than ${l.staleAfterDays} days: check it is still current` : ""}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {anyStale ? "Some results are old. " : ""}Check every value against the record before relying on the result. Nothing from the record was sent to Clinexia.
      </p>
    </div>
  )
}
