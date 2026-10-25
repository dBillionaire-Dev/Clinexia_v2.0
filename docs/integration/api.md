# Clinexia public API v1

Server-to-server access to Clinexia's calculators and unit conversions. Base path: `/api/v1`. The machine-readable description is
`GET /api/v1/openapi.json` (OpenAPI 3.1, generated from the calculators, so it cannot drift). A short human page is at `/developers`.

> **Intended use (DRAFT, pending legal and regulatory review).** A calculation and reference aid for qualified clinicians. Every
> result must be verified independently. Not a diagnostic device and not a substitute for clinical judgement.
>
> **No patient data.** Send only the numbers a formula needs, never names, record numbers or dates of birth. The API does not log,
> store or analyse inputs or results. It counts calls and errors per API key (to apply limits) and nothing else.
> See `no-phi-by-design.md`.

## Authentication

`Authorization: Bearer cx_live_...` is the only accepted credential. Cookies and query-string keys are ignored (the request gets
401). Keys are for servers; do not put one in a web page or a mobile app. Browser CORS is closed for `/api/v1`.

An organisation **owner or admin** creates and revokes keys on the organisation page. The full key is shown **once**; only its
SHA-256 hash is stored, so a lost key cannot be recovered, only replaced. An organisation can hold at most 10 active keys.

## Scopes

| Scope | Allows |
|---|---|
| `read:catalog` | `GET /calculators`, `GET /calculators/{id}` |
| `calculate:general` | calculate (single and batch) for every calculator **except** drug dosing and oncology |
| `calculate:dosing` | calculate for drug-dosing and oncology calculators. **Never granted by default.** Only an organisation owner can grant it, explicitly, when creating a key |
| `convert` | `GET /conversions`, `POST /conversions/convert` |

New keys get `read:catalog`, `calculate:general` and `convert`.

Category to scope mapping (a calculator's category decides):

| Category | Calculators | Scope needed |
|---|---|---|
| Drug Dosing (`dosing`) | 57 | `calculate:dosing` |
| Oncology (`oncology`) | 15 | `calculate:dosing` (all oncology tools are treated as dosing, conservatively) |
| General, Renal, Clinical Chemistry, Hematology, Laboratory Solutions, Spectrophotometry, Microbiology, Cardiovascular, Stem Cell & Transplant | 90 | `calculate:general` |

The catalog only lists calculators the key may run. Asking for a dosing calculator without the scope is `403 scope_required`.

## Rate limits

Per key, `API_RATE_LIMIT_PER_MINUTE` calls per rolling minute (default 60, held per server instance). Every response carries
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (Unix seconds). Over the limit: `429` with `Retry-After`
(seconds). A batch request counts as one call.

All responses carry `Cache-Control: no-store` and `X-Request-Id` (also in the body as `requestId`; quote it in support requests).

## Endpoints

| Method and path | Scope | Notes |
|---|---|---|
| `GET /health` | none | `{status, service, apiVersion, buildId, timestamp}` |
| `GET /openapi.json` | none | OpenAPI 3.1 |
| `GET /calculators[?category=renal]` | `read:catalog` | catalog: id, name, category, subcategory, description, inputs (id, label, kind, unit, min, max, options, optional, loinc, ucum, fhir), outputs, formula, version, referenceStatus |
| `GET /calculators/{id}` | `read:catalog` | one definition |
| `POST /calculators/{id}/calculate` | `calculate:*` | body `{"inputs": {...}}` |
| `POST /calculators/batch` | `calculate:*` | body `{"calculations":[{"id","inputs"}, ...]}`, 1 to 25 items |
| `GET /conversions` | `convert` | categories, units (with UCUM codes), analytes |
| `POST /conversions/convert` | `convert` | `{category, value, from, to}` or `{analyte, value, from, to}` |

### Calculate

Each input is a plain number (read in the calculator's own unit, shown in the catalog) or `{"value": 88, "unit": "umol/L"}`.
Required inputs are never defaulted: a missing `sex` is a `422`, not "male".

The same request with creatinine in two ways. 88 µmol/L is converted to 0.995456 mg/dL with the existing conversion engine, and
the answer is identical to sending that mg/dL value yourself:

```bash
# creatinine in umol/L
curl -sS -X POST "$CLINEXIA/api/v1/calculators/creatinine-clearance/calculate" \
  -H "Authorization: Bearer $CLINEXIA_KEY" -H "Content-Type: application/json" \
  -d '{"inputs":{"age":54,"weight":70,"sex":"male","creatinine":{"value":88,"unit":"umol/L"}}}'

# the same creatinine in mg/dL (the converted value)
curl -sS -X POST "$CLINEXIA/api/v1/calculators/creatinine-clearance/calculate" \
  -H "Authorization: Bearer $CLINEXIA_KEY" -H "Content-Type: application/json" \
  -d '{"inputs":{"age":54,"weight":70,"sex":"male","creatinine":0.995456}}'
```

Both return `"display": "84 mL/min"`. Response (abridged; `result` is the calculator's own result object):

```json
{
  "id": "creatinine-clearance",
  "version": "1.0.0",
  "result": { "value": 84, "unit": "mL/min", "display": "84 mL/min", "...": "..." },
  "conversions": [
    { "id": "creatinine", "from": { "value": 88, "unit": "umol/L" }, "to": { "value": 0.995456, "unit": "mg/dL" } }
  ],
  "references": [ { "source": "...", "version": "...", "lastVerified": "...", "status": "current" } ],
  "referenceStatus": "current",
  "disclaimer": "...",
  "intendedUse": "...",
  "requestId": "req_..."
}
```

`version` is the calculator's formula version (see `CHANGELOG.md`): when it changes, the behaviour changed.

Supported units for `{value, unit}`: see `units-and-coding.md`. An unknown or incompatible unit is an error, never a guess. Units
accept the common spelling or the UCUM code (`umol/L`, `[lb_av]`, `[in_i]`).

### Batch

```bash
curl -sS -X POST "$CLINEXIA/api/v1/calculators/batch" -H "Authorization: Bearer $CLINEXIA_KEY" -H "Content-Type: application/json" \
  -d '{"calculations":[{"id":"bmi","inputs":{"weight":70,"height":170}},{"id":"egfr-ckd-epi","inputs":{"age":54,"sex":"male","creatinine":1.1}}]}'
```

The response is `{count, results:[...], requestId}`. Each result has its own `status` (200, 403, 404 or 422) and either the
calculate shape or an `error`. The HTTP status is 200 when the batch itself was well formed.

### Conversions

```bash
curl -sS -X POST "$CLINEXIA/api/v1/conversions/convert" -H "Authorization: Bearer $CLINEXIA_KEY" -H "Content-Type: application/json" \
  -d '{"category":"pressure","value":120,"from":"mm[Hg]","to":"kPa"}'

curl -sS -X POST "$CLINEXIA/api/v1/conversions/convert" -H "Authorization: Bearer $CLINEXIA_KEY" -H "Content-Type: application/json" \
  -d '{"analyte":"creatinine","value":88.4,"from":"umol/L","to":"mg/dL"}'
```

Analyte conversions use the molecular weights returned by `GET /conversions` (creatinine 113.12 g/mol, so 88.4 µmol/L is
about 1.000 mg/dL). They can differ from the rounded textbook factors in the fourth digit.

## Errors

Every error is `{"error": {"code", "message", "fields"?}, "requestId"}`. Messages never contain the values you sent, and no
response contains a stack trace.

| HTTP | `error.code` | Meaning |
|---|---|---|
| 400 | `invalid_json` | Body is not valid JSON |
| 401 | `invalid_api_key` | Missing, malformed, unknown or revoked key |
| 403 | `scope_required` | The key lacks the scope (e.g. `calculate:dosing`); `error.scope` names it |
| 404 | `calculator_not_found` | No calculator with that id |
| 413 | `payload_too_large` | Body over 100 000 bytes |
| 422 | `validation_failed` | `error.fields` lists `{id, code, message}` per input: `required`, `invalid_number`, `out_of_range`, `invalid_option`, `invalid_date`, `invalid_type`, `unknown_input`, `unit_unknown`, `unit_mismatch`, `unit_unsupported`, `unit_conflict`, `calculation_error` |
| 422 | `invalid_body`, `batch_too_large` | Wrong body shape; more than 25 batch items |
| 429 | `rate_limited` | See `Retry-After` |
| 500 | `internal_error` | Our side. Quote `requestId` |
| 503 | `service_unavailable` | Key store unavailable; retry after the `Retry-After` seconds |

## Versioning policy (proposed, pending your decision)

* The path carries the API version (`/api/v1`). Within v1, changes are additive only: new endpoints, new optional fields, new
  calculators. Existing fields, error codes and meanings do not change.
* A change that cannot be additive goes into `/api/v2`, and v1 keeps working for a published notice period (to be decided).
* Calculator behaviour is versioned separately: every calculator has a formula `version` (semver) and a changelog. A new formula
  version does not change the API version; read `version` in each response if you need to know.
* UCUM and LOINC codes in the catalog are metadata. LOINC codes are currently **unverified** (see `FINDINGS.md`).

## Operating notes

* Run `supabase/api-keys.sql` once in the Supabase SQL editor before creating keys.
* Rate-limit state is per server instance. For a hard global limit, put a shared store behind `lib/api/rate-limit.ts`.
* Metering table `api_usage_daily` holds `calls` and `errors` per key per UTC day, nothing else.
