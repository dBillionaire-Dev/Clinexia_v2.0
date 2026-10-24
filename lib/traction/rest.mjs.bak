// Minimal Supabase REST helper (same service-role access the existing analytics routes use).
const PAGE = 1000

export function createRest({ url, key, fetchImpl = fetch }) {
  const base = url.replace(/\/$/, "") + "/rest/v1"
  const headers = (extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra })

  async function check(res, what) {
    if (!res.ok) throw new Error(`Supabase ${what} failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
    return res
  }

  return {
    /** Select every row, paging 1000 at a time. `query` is a PostgREST query string (without leading ?). */
    async selectAll(table, query = "") {
      const out = []
      for (let from = 0; ; from += PAGE) {
        const res = await check(
          await fetchImpl(`${base}/${table}?${query}`, { headers: headers({ Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" }) }),
          `select ${table}`,
        )
        const batch = await res.json()
        out.push(...batch)
        if (batch.length < PAGE) break
      }
      return out
    },
    async upsert(table, rows, onConflict, chunk = 500) {
      for (let i = 0; i < rows.length; i += chunk) {
        await check(
          await fetchImpl(`${base}/${table}?on_conflict=${onConflict}`, {
            method: "POST",
            headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
            body: JSON.stringify(rows.slice(i, i + chunk)),
          }),
          `upsert ${table}`,
        )
      }
    },
    async insert(table, row) {
      await check(
        await fetchImpl(`${base}/${table}`, { method: "POST", headers: headers({ Prefer: "return=minimal" }), body: JSON.stringify(row) }),
        `insert ${table}`,
      )
    },
    async delete(table, query) {
      await check(await fetchImpl(`${base}/${table}?${query}`, { method: "DELETE", headers: headers({ Prefer: "return=minimal" }) }), `delete ${table}`)
    },
    async rpc(name, args = {}) {
      const res = await check(await fetchImpl(`${base}/rpc/${name}`, { method: "POST", headers: headers(), body: JSON.stringify(args) }), `rpc ${name}`)
      const text = await res.text()
      return text ? JSON.parse(text) : null
    },
    async logRun(job, status, detail) {
      await this.upsert("traction_job_runs", [{ job, status, detail: detail?.slice(0, 500) ?? null, ran_at: new Date().toISOString() }], "job")
    },
  }
}

export function restFromEnv(env = process.env) {
  const url = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
  return createRest({ url, key })
}
