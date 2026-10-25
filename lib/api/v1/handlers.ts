import { calculators, getCalculatorById } from "@/lib/calculators/registry"
import { scopeForCalculator } from "../scopes"
import { MAX_BATCH, fail, newRequestId, ok, publicResponse, readJsonBody, requireScope, type ApiContext, type ApiResult } from "./kit"

export { MAX_BATCH }
import { describeCalculator, visibleTo } from "./catalog"
import { runCalculation } from "./calculate"
import { convertBody, listConversions } from "./conversions"
import { generateOpenApi } from "./openapi"

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

export function catalogHandler(ctx: ApiContext): ApiResult {
  const denied = requireScope(ctx.key, "read:catalog")
  if (denied) return denied
  const category = new URL(ctx.request.url).searchParams.get("category")
  const list = visibleTo(ctx.key.scopes, calculators).filter((c) => !category || c.category === category)
  return ok({ count: list.length, calculators: list.map(describeCalculator) })
}

export function calculatorHandler(ctx: ApiContext): ApiResult {
  const denied = requireScope(ctx.key, "read:catalog")
  if (denied) return denied
  const def = getCalculatorById(ctx.params.id ?? "")
  if (!def) return fail(404, "calculator_not_found", "No calculator has this id.")
  const scopeDenied = requireScope(ctx.key, scopeForCalculator(def))
  if (scopeDenied) return scopeDenied
  return ok({ calculator: describeCalculator(def) })
}

export async function calculateHandler(ctx: ApiContext): Promise<ApiResult> {
  const def = getCalculatorById(ctx.params.id ?? "")
  if (!def) return fail(404, "calculator_not_found", "No calculator has this id.")
  const denied = requireScope(ctx.key, scopeForCalculator(def))
  if (denied) return denied
  const body = await readJsonBody(ctx.request)
  if (!body.ok) return body.result
  if (!isObject(body.body.inputs)) return fail(422, "invalid_body", 'Send a JSON object like {"inputs": { ... }}.')
  const r = runCalculation(def, body.body.inputs)
  if (!r.ok) return fail(422, "validation_failed", "Some inputs are missing or invalid.", { fields: r.fields })
  const { ok: _ok, ...rest } = r
  return ok(rest)
}

export async function batchHandler(ctx: ApiContext): Promise<ApiResult> {
  const body = await readJsonBody(ctx.request)
  if (!body.ok) return body.result
  const items = body.body.calculations
  if (!Array.isArray(items) || items.length === 0) return fail(422, "invalid_body", 'Send {"calculations": [{"id": "...", "inputs": {...}}, ...]} with at least one item.')
  if (items.length > MAX_BATCH) return fail(422, "batch_too_large", `A batch can hold at most ${MAX_BATCH} calculations.`, { max: MAX_BATCH })

  const results = items.map((item, index) => {
    if (!isObject(item) || typeof item.id !== "string") return { index, id: null, status: 422, error: { code: "invalid_body", message: 'Each item needs a string "id" and an "inputs" object.' } }
    const def = getCalculatorById(item.id)
    if (!def) return { index, id: item.id, status: 404, error: { code: "calculator_not_found", message: "No calculator has this id." } }
    const scope = scopeForCalculator(def)
    if (!ctx.key.scopes.includes(scope)) return { index, id: item.id, status: 403, error: { code: "scope_required", message: `This API key does not have the "${scope}" scope.`, scope } }
    if (!isObject(item.inputs)) return { index, id: item.id, status: 422, error: { code: "invalid_body", message: 'Each item needs an "inputs" object.' } }
    const r = runCalculation(def, item.inputs)
    if (!r.ok) return { index, id: item.id, status: 422, error: { code: "validation_failed", message: "Some inputs are missing or invalid.", fields: r.fields } }
    const { ok: _ok, ...rest } = r
    return { index, status: 200, ...rest }
  })
  return ok({ count: results.length, results })
}

export function conversionsHandler(ctx: ApiContext): ApiResult {
  return requireScope(ctx.key, "convert") ?? listConversions()
}

export async function convertHandler(ctx: ApiContext): Promise<ApiResult> {
  const denied = requireScope(ctx.key, "convert")
  if (denied) return denied
  const body = await readJsonBody(ctx.request)
  if (!body.ok) return body.result
  return convertBody(body.body)
}

/** No key needed. */
export function healthResponse(buildId: string | undefined): Response {
  return publicResponse(ok({ status: "ok", service: "Clinexia API", apiVersion: "v1", buildId: buildId || "unknown", timestamp: new Date().toISOString() }))
}

/** No key needed: the spec is public documentation and carries no patient data. */
export function openApiResponse(): Response {
  const spec = generateOpenApi()
  return new Response(JSON.stringify(spec), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Request-Id": newRequestId() } })
}
