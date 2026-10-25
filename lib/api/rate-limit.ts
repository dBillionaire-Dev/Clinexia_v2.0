/**
 * Per-key request limiter: at most N calls per rolling minute (env API_RATE_LIMIT_PER_MINUTE, default 60).
 * Held in memory and keyed by the key's id only. Serverless instances do not share memory, so this is a speed bump per
 * instance, not a global guarantee; for a hard limit put a shared store (e.g. Redis) behind the same interface.
 */
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 60
const WINDOW_MS = 60_000

export function configuredLimit(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.API_RATE_LIMIT_PER_MINUTE)
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : DEFAULT_RATE_LIMIT_PER_MINUTE
}

export interface RateDecision {
  allowed: boolean
  limit: number
  remaining: number
  /** Unix time (seconds) when the window frees up. */
  resetAt: number
  /** Seconds to wait before retrying (only meaningful when not allowed). */
  retryAfter: number
}

export interface RateLimiter {
  check(keyId: string): RateDecision
}

export function createRateLimiter(opts: { limit?: () => number; now?: () => number } = {}): RateLimiter {
  const hits = new Map<string, number[]>()
  const now = opts.now ?? Date.now
  const limitOf = opts.limit ?? (() => configuredLimit())
  return {
    check(keyId) {
      const t = now()
      const limit = limitOf()
      const recent = (hits.get(keyId) ?? []).filter((x) => t - x < WINDOW_MS)
      const allowed = recent.length < limit
      if (allowed) recent.push(t)
      hits.set(keyId, recent)
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((x) => t - x >= WINDOW_MS)) hits.delete(k)
      const oldest = recent[0] ?? t
      const resetAt = Math.ceil((oldest + WINDOW_MS) / 1000)
      return { allowed, limit, remaining: Math.max(0, limit - recent.length), resetAt, retryAfter: allowed ? 0 : Math.max(1, resetAt - Math.floor(t / 1000)) }
    },
  }
}
