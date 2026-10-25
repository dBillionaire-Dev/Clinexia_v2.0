import type { Metadata } from "next"
import Link from "next/link"
import { INTENDED_USE_LINE } from "@/lib/integration/constants"

export const metadata: Metadata = {
  title: "Developers: Clinexia API",
  description: "Use Clinexia's clinical calculators and unit conversions from your own software: API, embeddable calculators and deep links.",
  alternates: { canonical: "/developers" },
}

const scopes: [string, string][] = [
  ["read:catalog", "List and describe calculators."],
  ["calculate:general", "Run every calculator except drug dosing and oncology. Included by default."],
  ["calculate:dosing", "Run drug-dosing and oncology calculators. Never included by default; an organisation owner must grant it explicitly."],
  ["convert", "Unit conversions."],
]

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Clinexia for developers</h1>
      <p className="mt-2 text-muted-foreground">Use the calculators and unit conversions from an EMR, lab system or your own software.</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">API v1</h2>
        <p className="leading-7">
          The machine-readable description is the <a className="underline" href="/api/v1/openapi.json">OpenAPI 3.1 document</a>, generated from the calculators themselves so it
          always matches them. Health check: <a className="underline" href="/api/v1/health">/api/v1/health</a>.
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted p-3 text-xs">{`curl -X POST https://<clinexia-host>/api/v1/calculators/creatinine-clearance/calculate \\
  -H "Authorization: Bearer cx_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"inputs":{"age":54,"weight":70,"sex":"male","creatinine":{"value":88,"unit":"umol/L"}}}'`}</pre>
        <p className="leading-7">API keys are created by an organisation owner or admin on the organisation page. They are for servers: never put one in a web page or an app.</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Scopes</h2>
        <ul className="space-y-1 text-sm">
          {scopes.map(([s, d]) => (<li key={s}><code className="rounded bg-muted px-1">{s}</code> {d}</li>))}
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Intended use</h2>
        <p className="leading-7">{INTENDED_USE_LINE}</p>
        <p className="text-sm text-muted-foreground">Draft wording, pending legal and regulatory review.</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">No patient data</h2>
        <p className="leading-7">
          Send only the numbers a formula needs: never names, record numbers or dates of birth. The API does not log, store or analyse the inputs or results you send. It counts
          calls and errors per key so limits can be applied, and nothing else.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Other ways to integrate</h2>
        <p className="leading-7">Prefilled links and an embeddable calculator need no key: see the embedding guide in the repository (<code>docs/integration/embed.md</code>), or <Link className="underline" href="/calculators">browse the calculators</Link>.</p>
      </section>
    </div>
  )
}
