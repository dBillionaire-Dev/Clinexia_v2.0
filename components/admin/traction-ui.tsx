import Link from "next/link"
import type { ReactNode } from "react"

export const num = (v: number | null | undefined) => (v === null || v === undefined ? "–" : new Intl.NumberFormat("en-US").format(v))
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${(v * 100).toFixed(1)}%`)

export function Card({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm print:break-inside-avoid">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function AdminNav({ current }: { current: "overview" | "report" | "revenue" | "feedback" }) {
  const item = (href: string, label: string, key: string) => (
    <Link href={href} className={`rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted ${current === key ? "bg-muted" : "bg-background"}`}>
      {label}
    </Link>
  )
  return (
    <nav className="mb-6 flex flex-wrap gap-2 print:hidden">
      <Link href="/admin" className="rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">← Console</Link>
      {item("/admin/traction", "Traction metrics", "overview")}
      {item("/admin/traction/report", "Buyer report", "report")}
      {item("/admin/traction/revenue", "Revenue", "revenue")}
      {item("/admin/feedback", "Feedback", "feedback")}
      {item("/admin/campaigns", "Campaigns", "campaigns")}
      {item("/admin/accounts", "Accounts management", "accounts")}
      {item("/admin/setup", "Setup check", "setup")}
    </nav>
  )
}

export function ExportLink({ table, from, to }: { table: string; from?: string; to?: string }) {
  const q = new URLSearchParams({ table, ...(from ? { from } : {}), ...(to ? { to } : {}) })
  return (
    <a href={`/api/admin/traction/export?${q}`} className="text-xs font-medium text-blue-600 hover:underline print:hidden" download>
      Export CSV
    </a>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8 print:break-inside-avoid">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function SimpleTable({ columns, rows }: { columns: { key: string; label: string; align?: "right"; format?: (v: any) => string }[]; rows: Record<string, any>[] }) {
  if (!rows.length) return <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">No data in this range yet.</p>
  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>{columns.map((c) => <th key={c.key} className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map((c) => (
                <td key={c.key} className={`max-w-[28rem] truncate px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""}`} title={String(row[c.key] ?? "")}>
                  {c.format ? c.format(row[c.key]) : String(row[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
