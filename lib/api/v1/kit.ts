import type { ApiKeyRecord, ApiKeyStore } from "../key-store"
import type { RateLimiter } from "../rate-limit"
import { hasScope, type ApiScope } from "../scopes"
import { hashApiKey, parseBearerKey, verifyApiKey } from "../keys"

/**
 * Request pipeline shared by every authenticated /api/v1 endpoint:
 *   Bearer key -> 401 | per-key rate limit -> 429 | handler -> result | any exception -> a plain 500
 * and, on every response, Cache-Control: no-store, X-Request-Id and X-RateLimit-*.
 *
 * NO PHI: nothing in this file (or the handlers) logs, stores or forwards inputs or results. The only thing recorded is a
 * per-key count of calls and errors (recordUsage).
 */

export interface ApiDeps {
  store: ApiKeyStore
  limiter: RateLimiter
  buildId?: string
}

export interface ApiContext {
  request: Request
  key: ApiKeyRecord
  requestId: string
  params: Record<string, string>
}

export interface ApiResult {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

export const ok = (body: Record<string, unknown>, status = 200): ApiResult => ({ status, body })
export const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { error: { code, message, ...extra } },
})

/** Returns a 403 result when the key lacks the scope, else null. */
export const requireScope = (key: ApiKeyRecord, scope: ApiScope): ApiResult | null =>
  hasScope(key.scopes, scope) ? null : fail(403, "scope_required", `This API key does not have the "${scope}" scope.`, { scope })

export const newRequestId = () => `req_${crypto.randomUUID()}`

function respond(result: ApiResult, requestId: string, extra: Record<string, string> = {}): Response {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Request-Id": requestId, ...extra, ...(result.headers ?? {}) })
  return new Response(JSON.stringify({ ...result.body, requestId }), { status: result.status, headers })
}

/** A response for endpoints that need no key (health, OpenAPI). */
export function publicResponse(result: ApiResult): Response {
  return respond(result, newRequestId())
}

export async function runApi(
  request: Request,
  deps: ApiDeps,
  handler: (ctx: ApiContext) => Promise<ApiResult> | ApiResult,
  params: Record<string, string> = {},
): Promise<Response> {
  const requestId = newRequestId()

  // 1. authenticate (Authorization: Bearer only; cookies and query strings are never looked at)
  const presented = parseBearerKey(request.headers.get("authorization"))
  let key: ApiKeyRecord | null = null
  if (presented) {
    try {
      const found = await deps.store.findByHash(hashApiKey(presented))
      if (found && !found.revokedAt && verifyApiKey(presented, found.keyHash)) key = found
    } catch {
      return respond(fail(503, "service_unavailable", "The service is temporarily unavailable. Try again shortly."), requestId, { "Retry-After": "5" })
    }
  }
  if (!key) {
    return respond(fail(401, "invalid_api_key", "A valid API key is required: Authorization: Bearer cx_live_..."), requestId, { "WWW-Authenticate": 'Bearer realm="Clinexia API"' })
  }

  // 2. rate limit
  const rate = deps.limiter.check(key.id)
  const rateHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(rate.resetAt),
  }
  let result: ApiResult
  if (!rate.allowed) {
    result = fail(429, "rate_limited", "Too many requests. Slow down and retry after the delay in Retry-After.")
    rateHeaders["Retry-After"] = String(rate.retryAfter)
  } else {
    // 3. handler; any exception becomes a generic 500 (no message, no stack, nothing about the input)
    try {
      result = await handler({ request, key, requestId, params })
    } catch {
      result = fail(500, "internal_error", "Something went wrong on our side.")
    }
  }

  // 4. metering: counts only
  try {
    await deps.store.recordUsage(key.id, result.status >= 400)
  } catch {
    /* metering must never break a request */
  }
  return respond(result, requestId, rateHeaders)
}

export const MAX_BODY_BYTES = 100_000
/** Most calculations accepted in one POST /calculators/batch. */
export const MAX_BATCH = 25

/** Reads a JSON object body, or returns the error result to send. */
export async function readJsonBody(request: Request): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; result: ApiResult }> {
  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, result: fail(400, "invalid_json", "The request body could not be read.") }
  }
  if (text.length > MAX_BODY_BYTES) return { ok: false, result: fail(413, "payload_too_large", `The request body must be under ${MAX_BODY_BYTES} bytes.`) }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, result: fail(400, "invalid_json", "The request body must be valid JSON.") }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, result: fail(422, "invalid_body", "The request body must be a JSON object.") }
  return { ok: true, body: parsed as Record<string, unknown> }
}
