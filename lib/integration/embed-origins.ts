/**
 * Which origins may frame /embed (CSP frame-ancestors) and exchange postMessages with it.
 *
 * Sources, merged:
 *   1. env EMBED_ALLOWED_ORIGINS (comma-separated, e.g. "https://emr.hospital.org,https://lis.lab.org")
 *   2. Supabase table embed_partners(origin text primary key, org_id uuid, created_at), read server-side, cached ~60 s
 * With neither configured the list is empty and /embed is framable by 'self' only.
 *
 * Nothing partner-specific is hard-coded. Any failure reading the table falls back to the env list (never to "allow all").
 */

/** Returns a bare origin ("https://host[:port]") or null. Plain http is accepted only for localhost / 127.0.0.1. */
export function normaliseOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = raw.trim()
  if (!text || text === "*" || text === "null" || /[\s;,'"]/.test(text)) return null
  let u: URL
  try {
    u = new URL(text)
  } catch {
    return null
  }
  if (u.username || u.password) return null
  if (u.pathname !== "/" || u.search || u.hash) return null
  if (u.protocol === "https:") return u.origin
  if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return u.origin
  return null
}

export function parseOriginList(csv: string | null | undefined): string[] {
  const out: string[] = []
  for (const part of (csv ?? "").split(",")) {
    const o = normaliseOrigin(part)
    if (o && !out.includes(o)) out.push(o)
  }
  return out
}

export function isAllowedOrigin(origin: string | null | undefined, allowed: readonly string[]): boolean {
  const o = normaliseOrigin(origin)
  return o !== null && allowed.includes(o)
}

/** The Content-Security-Policy value for /embed responses. */
export function buildFrameAncestors(origins: readonly string[]): string {
  const safe = origins.map((o) => normaliseOrigin(o)).filter((o): o is string => o !== null)
  return `frame-ancestors 'self'${safe.length ? " " + Array.from(new Set(safe)).join(" ") : ""}`
}

type Env = Record<string, string | undefined>

export interface OriginResolverDeps {
  env?: Env
  /** Returns partner origins from the database. Defaults to a Supabase REST read. */
  fetchPartners?: () => Promise<string[]>
  ttlMs?: number
  now?: () => number
}

async function fetchPartnersFromSupabase(env: Env): Promise<string[]> {
  const url = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/embed_partners?select=origin`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(1500),
  })
  if (!res.ok) throw new Error(`embed_partners read failed (${res.status})`)
  const rows = (await res.json()) as Array<{ origin?: unknown }>
  return rows.map((r) => (typeof r.origin === "string" ? normaliseOrigin(r.origin) : null)).filter((o): o is string => o !== null)
}

export function createOriginResolver(deps: OriginResolverDeps = {}) {
  const ttlMs = deps.ttlMs ?? 60_000
  const now = deps.now ?? Date.now
  let cached: { at: number; origins: string[] } | null = null

  return {
    async get(): Promise<string[]> {
      const t = now()
      if (cached && t - cached.at < ttlMs) return cached.origins
      const env = deps.env ?? process.env
      const fromEnv = parseOriginList(env.EMBED_ALLOWED_ORIGINS)
      let fromDb: string[] = []
      try {
        fromDb = await (deps.fetchPartners ?? (() => fetchPartnersFromSupabase(env)))()
      } catch {
        fromDb = [] // fail closed to the env list; never log the error body
      }
      const origins = Array.from(new Set([...fromEnv, ...fromDb]))
      cached = { at: t, origins }
      return origins
    },
    clear() {
      cached = null
    },
  }
}

const shared = createOriginResolver()
/** Allowed embedding origins (env + embed_partners), cached for about a minute. Server-side only. */
export const getEmbedOrigins = () => shared.get()
