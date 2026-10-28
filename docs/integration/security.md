# Security notes for the integration features

Scope: the public API, API keys, the embed view, the SMART launcher, the CDS Hooks stub, the LIS examples and `@clinexia/core`.
**This is a design description with threat notes. It is not a penetration test or a security review, and nothing here was tested against a live deployment.**

## API keys

* Format `cx_live_` followed by 43 random URL-safe characters (256 bits from the operating system's random source). Created by an organisation **owner or admin** on the organisation page; the full key is shown **once**.
* **Only the SHA-256 hash is stored** (plus a short display prefix). A lost key cannot be recovered, only revoked and replaced. The store lookup is by hash, then the hash is compared again in constant time (`lib/api/keys.ts`).
* Accepted only as `Authorization: Bearer cx_live_...`. Cookies and query-string keys are ignored (401). A revoked key is a plain 401, indistinguishable from an unknown one.
* At most 10 active keys per organisation. Revoking is immediate (the next request fails). Creating, listing and revoking are limited to owners and admins; staff and non-members cannot (`lib/api/keys-admin.ts`).
* **Scopes** (`lib/api/scopes.ts`): `read:catalog`, `calculate:general`, `calculate:dosing`, `convert`. New keys get everything except dosing. **Only the organisation owner can grant `calculate:dosing`**, explicitly. Dosing and oncology calculators answer 403 to other keys and are not listed in the catalog or the OpenAPI document.
* Key creation and revocation are written to the organisation audit log with the key id and scopes, never the key.
* **Handling advice for key holders:** keep keys in a secret manager or server environment variables (Mirth: the configuration map), never in a web page, mobile app, repository or ticket; one key per integration so one can be revoked alone; rotate by creating the new key, switching, then revoking the old; revoke at once on any suspicion of exposure.
* The key store tables are reachable only with the service role (row level security on, no policies, `supabase/api-keys.sql`).

## Rate limiting and request limits

* Per key, `API_RATE_LIMIT_PER_MINUTE` calls per rolling minute (default 60), answered with `429` and `Retry-After`; `X-RateLimit-*` on every response (`lib/api/rate-limit.ts`).
* **The limiter lives in each server instance's memory.** Serverless instances do not share it, so it is a speed bump, not a global guarantee. For a hard limit put a shared store behind the same interface.
* Bodies over 100 000 bytes are refused (413); a batch holds at most 25 items; a batch counts as one call.
* Unauthenticated calls cost one hash and one lookup and are not rate limited per key (there is no key to limit): put an edge or platform rate limit in front for abuse.

## API behaviour

* Server to server only. **No CORS** is configured for `/api/v1` and no browser-origin keys exist (a Decision needed in `FINDINGS.md`).
* Every response carries `Cache-Control: no-store` and `X-Request-Id`; errors never contain a stack, an internal message or the values sent.
* Unknown calculator ids are 404 and scope failures are 403, so a key without the dosing scope can tell that a dosing calculator **exists**; the existence of dosing tools is not a secret.
* No endpoint fetches an address supplied by the caller. The only outbound calls are to Supabase (key lookup and usage counts), so the API has no server-side request forgery surface of its own.

## Embedding and the CSP model

* Every route keeps `frame-ancestors 'self'` (plus the landing domain) and `X-Frame-Options` from `next.config.mjs`, **except** `/embed` and `/smart`. For those two the proxy (`proxy.ts`, `lib/integration/embed-headers.ts`) sets `Content-Security-Policy: frame-ancestors 'self' <allowlist>` and removes `X-Frame-Options`, so only allowlisted origins can frame them.
* If no origin is configured, `/embed` and `/smart` can be framed by Clinexia itself only.
* **Origin allowlist** (`lib/integration/embed-origins.ts`): `EMBED_ALLOWED_ORIGINS` (comma separated) merged with the `embed_partners` table (`supabase/embed-partners.sql`), cached about a minute. Entries must be bare `https://host[:port]` (plain `http` only for `localhost` and `127.0.0.1`). **No wildcards, paths, credentials or `null`.** Invalid entries are dropped. If the database cannot be read, the environment list is used, never "allow all".
* Look-alike paths (`/embedded`, `/smarter`) are not framable. The service worker never caches `/embed/*` or `/smart/*`.
* **postMessage** (`lib/integration/embed-bridge.ts`): the parent origin is decided on the server (it must be on the allowlist, from a validated `parentOrigin` or the `Referer`); the embed posts only to that exact origin, never `*`, and accepts messages only from that origin **and** the actual parent window.
* The embed page is `noindex` and shows no site navigation, prompts or banners.
* **Cross-Origin headers.** In production the site sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`. By the specifications neither stops a page being shown in an iframe, so the embed should still load. **This is reasoned, not confirmed in a browser** (see the manual checklist in `embed.md`).
* Clickjacking on every other route is unchanged. A partner that is allowlisted can frame the embed and can therefore overlay it; allowlist only origins you trust and can contact.

## SMART on FHIR launcher

* PKCE required, a public client with no secret, minimal scopes (`launch` or `launch/patient`, `openid fhirUser`, `patient/Patient.read`, `patient/Observation.read`): no write, no `user/*`, no `offline_access` (`lib/smart/config.ts`).
* The FHIR server (`iss`) must be on `NEXT_PUBLIC_SMART_ALLOWED_ISS`; **empty means every launch is refused**. https only (http for localhost); no credentials, queries or fragments. A forged launch link cannot make the app talk to an arbitrary server.
* The calculator to open is checked against a list of non-dosing calculators with FHIR-coded inputs; anything else falls back to the default.
* Tokens live in the OAuth library's `sessionStorage` entry only while signing in and are removed when the review is built. Record values travel in the URL fragment, never a query string.
* The service worker never caches `/smart/*`; the callback URL holds a one-time code.
* **Not verified:** the exact behaviour of the library version in use, the sign-in inside an EHR's iframe or embedded browser (storage partitioning), and every vendor requirement.

## CDS Hooks stub

* **Off by default** (`CDS_HOOKS_ENABLED` must be exactly `true`); both routes answer 404 otherwise.
* **It does not verify the EHR's signed JWT.** Until it does, keep it off, or set `CDS_HOOKS_SHARED_SECRET` so calls must carry `Authorization: Bearer <secret>` (compared in constant time). Verification needs each EHR's issuer and key-set URL (vendor specific).
* Stateless: nothing is stored, logged or forwarded; the body is capped at 200 000 bytes.

## LIS examples

* The Mirth backend sends the numbers a formula needs, over HTTPS, with a key in the configuration map, to `/api/v1/calculators/*/calculate` (the `calculate:general` scope is enough; no dosing).
* The adapter refuses messages produced by itself (no routing loops) and never calls the API for a message it cannot interpret.
* Run the example inside your own network if even numbers must not leave it; the Node example calculates locally.

## `@clinexia/core`

* No dependencies of any kind, no network, storage or logging, enforced by `packages/core/src/core-boundary.test.ts`. The package is `private` and unpublished.
* Supply chain: the one runtime dependency added by these phases is `fhirclient` (the SMART launcher only). Its install-time script (`core-js`) is explicitly not run (`pnpm-workspace.yaml`). Keep the lockfile committed and review dependency updates.

## Threat notes

| Threat | Mitigation | Residual risk |
|---|---|---|
| Key leaked in a repo, log or chat | hash-only storage, instant revoke, scopes, per-integration keys, audit log | the holder must act quickly; no automatic leak detection |
| Key theft from the database | only hashes stored | a database compromise still exposes metadata and the partner list |
| Brute-forcing keys | 256-bit keys; constant-time compare | no per-IP limit on unauthenticated calls (add one at the edge) |
| Abuse or runaway client | per-key limit, body and batch caps | the limiter is per instance |
| Clickjacking | frame protection on every route except an allowlisted `/embed` and `/smart` | an allowlisted partner could overlay it |
| Malicious launch link | `iss` allowlist, calculator allowlist, PKCE | none known; not tested against real EHRs |
| Cross-site messaging | exact origin plus window checks, never `*` | a compromised allowlisted parent can feed the calculator values |
| Values leaking through URLs | fragment and postMessage prefill; the service worker skips these routes | `?query` values reach server and CDN logs (`no-phi-by-design.md`) |
| Cross-site scripting | React escaping; the one inline script is built from a two-value enum | not reviewed beyond that |
| Cross-site request forgery on key management | the existing billing route guard and session handling (`lib/billing/route-kit.ts`), not re-audited here | depends on that guard |
| Server-side request forgery | no caller-supplied address is ever fetched; the server talks only to Supabase (keys, usage counts, the partner allowlist) | none known |
| Dosing misuse | dosing and oncology need an explicit owner-granted scope; absent from the OpenAPI document; blocked in SMART and the LIS adapters | whoever holds the scope can use it; clinical use is the integrator's responsibility |
| Unsigned CDS requests | off by default; optional shared secret | the stub accepts unauthenticated calls when enabled without a secret |
| Calculation drift | formula versions and recorded test vectors fail the build if behaviour changes unannounced | the vectors detect change, not correctness |
| Partner origin misconfigured | strict normalisation, no wildcards, environment fallback instead of allow-all | a wrongly listed origin is allowed until removed (cache about a minute) |

## Before going live (checklist)

- [ ] Run `supabase/api-keys.sql` and `supabase/embed-partners.sql`; confirm row level security is on and the tables are not readable with the public key.
- [ ] Try each flow against a real deployment: key auth and 401/403/429, dosing refusal, embed framing from an allowlisted origin and refusal from another, the SMART sandbox, `X-Request-Id` and headers.
- [ ] Review hosting and monitoring log settings (`no-phi-by-design.md`).
- [ ] Put an edge rate limit in front of `/api/v1` and decide whether a shared limiter is needed.
- [ ] Keep `CDS_HOOKS_ENABLED=false` until the JWT is verified.
- [ ] Get an independent security review before putting real patient work through it.
