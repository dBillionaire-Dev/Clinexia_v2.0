import { calculators } from "@/lib/calculators/registry"
import type { CalculatorDefinition, InputDefinition } from "@/lib/calculators/types"
import { scopeForCalculator } from "../scopes"
import { MAX_BATCH } from "./kit"

/**
 * OpenAPI 3.1 document GENERATED from the registry, so it cannot drift from the calculators. Only calculators that a default
 * key may run are listed (everything except dosing and oncology). The dosing and oncology tools exist behind the
 * calculate:dosing scope and are deliberately not enumerated in the public document.
 */

const refResponse = (name: string) => ({ $ref: `#/components/responses/${name}` })

function inputSchema(input: InputDefinition, all: InputDefinition[]) {
  const desc = [input.label, input.unit ? `Unit: ${input.unit}.` : "", input.ucum ? `UCUM: ${input.ucum}.` : "", input.loinc ? `LOINC: ${input.loinc} (unverified).` : ""].filter(Boolean).join(" ")
  if (input.kind === "select") return { type: "string", enum: (input.options ?? []).map((o) => o.value), description: desc }
  if (input.kind === "date") return { type: "string", format: "date", description: desc }
  const plain: Record<string, unknown> = { type: "number" }
  if (input.min !== undefined) plain.minimum = input.min
  if (input.max !== undefined) plain.maximum = input.max
  return {
    description: input.unit ? `${desc} A plain number is read in ${input.unit}; send {"value","unit"} to use another supported unit.` : desc,
    oneOf: input.unit ? [plain, { $ref: "#/components/schemas/ValueWithUnit" }] : [plain],
  }
}

/** A required unit select (e.g. weightUnit) is filled automatically when its number is sent, so it is not listed as required. */
function requiredIds(inputs: InputDefinition[]): string[] {
  return inputs
    .filter((i) => !i.optional)
    .filter((i) => !(i.kind === "select" && i.id.endsWith("Unit") && inputs.some((n) => n.kind === "number" && !!n.unit && `${n.id}Unit` === i.id)))
    .map((i) => i.id)
}

export function openApiCalculators(): CalculatorDefinition[] {
  return calculators.filter((c) => scopeForCalculator(c) === "calculate:general")
}

export function generateOpenApi() {
  const paths: Record<string, unknown> = {}
  const schemas: Record<string, unknown> = {}
  const general = openApiCalculators()

  for (const def of general) {
    const properties: Record<string, unknown> = {}
    for (const i of def.inputs) properties[i.id] = inputSchema(i, def.inputs)
    schemas[`Inputs_${def.id}`] = { type: "object", additionalProperties: false, properties, required: requiredIds(def.inputs) }
    paths[`/calculators/${def.id}/calculate`] = {
      post: {
        operationId: `calculate_${def.id.replace(/[^a-zA-Z0-9]/g, "_")}`,
        summary: def.name,
        description: def.description,
        tags: [def.category],
        security: [{ bearerAuth: [] }],
        "x-required-scope": "calculate:general",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["inputs"], properties: { inputs: { $ref: `#/components/schemas/Inputs_${def.id}` } } } } },
        },
        responses: {
          "200": { description: "Calculation result", content: { "application/json": { schema: { $ref: "#/components/schemas/CalculationResponse" } } } },
          "401": refResponse("Unauthorized"), "403": refResponse("Forbidden"), "422": refResponse("ValidationFailed"), "429": refResponse("RateLimited"),
        },
      },
    }
  }

  paths["/calculators"] = {
    get: {
      operationId: "listCalculators", summary: "Catalog of the calculators this key may use", tags: ["catalog"], security: [{ bearerAuth: [] }], "x-required-scope": "read:catalog",
      parameters: [{ name: "category", in: "query", required: false, schema: { type: "string" } }],
      responses: { "200": { description: "Catalog" }, "401": refResponse("Unauthorized"), "403": refResponse("Forbidden"), "429": refResponse("RateLimited") },
    },
  }
  paths["/calculators/{id}"] = {
    get: {
      operationId: "getCalculator", summary: "One calculator definition", tags: ["catalog"], security: [{ bearerAuth: [] }], "x-required-scope": "read:catalog",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", enum: general.map((c) => c.id) } }],
      responses: { "200": { description: "Definition" }, "401": refResponse("Unauthorized"), "403": refResponse("Forbidden"), "404": { description: "Unknown calculator id" }, "429": refResponse("RateLimited") },
    },
  }
  paths["/calculators/batch"] = {
    post: {
      operationId: "calculateBatch", summary: `Up to ${MAX_BATCH} calculations in one request`, tags: ["calculate"], security: [{ bearerAuth: [] }], "x-required-scope": "calculate:general",
      description: "Each item is answered separately in `results` with its own status (200, 403, 404 or 422). The request itself counts once toward the rate limit.",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["calculations"], properties: { calculations: { type: "array", minItems: 1, maxItems: MAX_BATCH, items: { type: "object", required: ["id", "inputs"], properties: { id: { type: "string" }, inputs: { type: "object" } } } } } } } } },
      responses: { "200": { description: "Per-item results" }, "401": refResponse("Unauthorized"), "422": refResponse("ValidationFailed"), "429": refResponse("RateLimited") },
    },
  }
  paths["/conversions"] = {
    get: { operationId: "listConversions", summary: "Unit categories, units (with UCUM codes) and analytes", tags: ["convert"], security: [{ bearerAuth: [] }], "x-required-scope": "convert", responses: { "200": { description: "Conversions" }, "401": refResponse("Unauthorized"), "403": refResponse("Forbidden") } },
  }
  paths["/conversions/convert"] = {
    post: {
      operationId: "convert", summary: "Convert a value between units, or a concentration between mass and molar units for an analyte", tags: ["convert"], security: [{ bearerAuth: [] }], "x-required-scope": "convert",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["value", "from", "to"], properties: { category: { type: "string" }, analyte: { type: "string" }, value: { type: "number" }, from: { type: "string" }, to: { type: "string" } } } } } },
      responses: { "200": { description: "Converted value" }, "401": refResponse("Unauthorized"), "403": refResponse("Forbidden"), "422": refResponse("ValidationFailed") },
    },
  }
  paths["/health"] = { get: { operationId: "health", summary: "Service status and build id (no key needed)", tags: ["meta"], security: [], responses: { "200": { description: "OK" } } } }
  paths["/openapi.json"] = { get: { operationId: "openapi", summary: "This document (no key needed)", tags: ["meta"], security: [], responses: { "200": { description: "OpenAPI 3.1 document" } } } }

  const errorBody = { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, fields: { type: "array", items: { type: "object" } } } }, requestId: { type: "string" } } }
  return {
    openapi: "3.1.0",
    info: {
      title: "Clinexia API",
      version: "v1",
      description:
        "Clinical calculators and unit conversions. A calculation and reference aid for qualified clinicians: results must be verified independently; this is not a diagnostic device. " +
        "Send no identifiers: the API needs only the numbers a formula uses, and it does not log, store or analyse inputs or results. " +
        "Drug-dosing and oncology calculators are not listed here; they require an API key that has been explicitly granted the calculate:dosing scope.",
    },
    servers: [{ url: "/api/v1" }],
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "cx_live_<key>" } },
      schemas: {
        ValueWithUnit: { type: "object", required: ["value", "unit"], additionalProperties: false, properties: { value: { type: "number" }, unit: { type: "string", description: "Unit symbol or UCUM code, e.g. umol/L, lb, [in_i]." } } },
        CalculationResponse: {
          type: "object",
          properties: {
            id: { type: "string" }, version: { type: "string", description: "Formula version (semver)" }, result: { type: "object" },
            conversions: { type: "array", items: { type: "object" } }, references: { type: "array", items: { type: "object" } },
            referenceStatus: { type: ["string", "null"], enum: ["current", "supporting", "review-needed", null] },
            disclaimer: { type: "string" }, intendedUse: { type: "string" }, requestId: { type: "string" },
          },
        },
        Error: errorBody,
        ...schemas,
      },
      responses: {
        Unauthorized: { description: "Missing, invalid or revoked API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        Forbidden: { description: "The key lacks the scope this endpoint or calculator needs", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        ValidationFailed: { description: "Field-level validation errors in error.fields", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        RateLimited: { description: "Too many requests; see the Retry-After header", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      },
    },
  }
}
