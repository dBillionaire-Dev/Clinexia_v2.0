# No PHI by design

**Rule:** the public API, the embed view, the SMART launcher, the CDS Hooks service and the LIS adapters must not log, persist, or send to analytics any input value or result.
This page says exactly what each flow does with data, where the code enforces it, which test would fail if someone broke it, and, just as important, **where values can still reach a server**.

> "PHI" here means anything about a person that a formula input or result could reveal. The formulas need numbers (age, weight, creatinine, ...), never names,
> record numbers or dates of birth. **Send none of those.** Age and sex are still personal data in some jurisdictions even without a name.

## Summary

| Flow | Values sent to Clinexia servers? | Logged by our code? | Stored by our code? | Analytics? | Enforced by |
|---|---|---|---|---|---|
| **Public API** (`/api/v1`) | yes, in the POST body (never the URL), processed in memory and dropped | no | no (only per-key **counts**) | no | `lib/api/api-no-phi.test.ts`, `lib/api/v1/api.test.ts` |
| **Embed view** (`/embed`) | not if you use `#fragment` or postMessage; **yes, in the URL if you use `?query`** | no | no (no history, no usage list, no favourites; service worker skips it) | no | `lib/integration/embed-no-phi.test.ts` |
| **Deep link on a normal page** | same as embed: `#fragment` no, `?query` yes | no | the normal page keeps its usual local history after a calculation | the normal page sends a usage event (calculator id, no values) as it always did | `lib/integration/embed-no-phi.test.ts` (the embed side only) |
| **SMART launcher** (`/smart`) | **no**: the record is read in the browser | no | no (a calculator id and an embed flag in `sessionStorage`; the OAuth session is cleared) | no | `lib/smart/smart-no-phi.test.ts` |
| **CDS Hooks service** | the EHR sends prefetched numbers; processed in memory and dropped | no | no | no | `lib/cds/service.test.ts`, `app/api/cds-services/routes.test.ts` |
| **LIS adapter, Node** | no (calculates locally) | no (the CLI prints counts and reasons only) | no | no | `integrations/lis/test/lis.test.ts` |
| **LIS adapter, Mirth** | numbers, plus age and sex for eGFR, to the API | no | no | no | `integrations/lis/test/mirth.test.ts` |
| **`@clinexia/core`** | no (no network) | no | no | no | `packages/core/src/core-boundary.test.ts` |

## What IS recorded by these features

Nothing about a patient. The only things the integration features write are:

| Where | What | Code |
|---|---|---|
| `api_keys` table | key name, a short display prefix, the **SHA-256 hash** of the key (never the key), scopes, who created it, timestamps | `supabase/api-keys.sql`, `lib/api/key-store.ts` |
| `api_usage_daily` table | per key per day: number of calls and number of errors | `supabase/api-keys.sql` (`api_record_usage`), `lib/api/v1/kit.ts` |
| organisation audit log | "API key created / revoked", the key id and scopes | `lib/api/keys-admin.ts` |
| `embed_partners` table | allowed origins (scheme, host, port) | `supabase/embed-partners.sql` |

Request ids (`X-Request-Id`) are returned to the caller and not stored.

## How each flow is kept clean

### Public API
* `lib/api/v1/kit.ts` is the one pipeline: authenticate, rate limit, run the handler, answer. An exception becomes a generic 500 with no message or stack; error messages never contain the values sent.
* Metering writes counts only (`recordUsage(keyId, isError)`).
* **Tests:** `lib/api/api-no-phi.test.ts` (1) crawls everything reachable from the API and fails if it reaches analytics, history, feedback or UI code or mentions `calculation_events`, (2) fails if any API source contains a `console` call, (3) sends real requests full of identifiable-looking values and fails on any console output or network call.
  `lib/api/v1/api.test.ts` checks that metering holds only `calls` and `errors`, that 422 responses never echo values, and that a handler exception leaks nothing.

### Embed view
* `components/calculators/calculator-runner.tsx` skips usage tracking and history in embed mode (saving to history would also report to analytics).
* `components/site-chrome.tsx` removes the analytics sync, update watcher and every banner from `/embed` and `/smart`; `public/service-worker.js` never caches them.
* `lib/integration/embed-bridge.ts` posts to one allowlisted parent origin, never to `*`.
* **Tests:** `lib/integration/embed-no-phi.test.ts` fails if the embed route or helpers import analytics, history or usage code, if the runner stops guarding history behind `!embed`, if the chrome that syncs analytics is rendered on `/embed`, or if the service worker stops skipping `/embed`.

### SMART launcher
* Everything runs in the browser against the EHR's FHIR server. Values reach the calculator in the URL **fragment**, which browsers never send to a server; the calculator reads it once and removes it from the address bar (`components/calculators/calculator-runner.tsx`, `lib/smart/provenance.ts`).
* `lib/smart/session.ts` is the only place Clinexia code touches browser storage, and it stores only a calculator id and an embed flag. The OAuth library keeps its tokens and the patient id in `sessionStorage` while signing in; `clearFhirSession` removes them as soon as the review is built (`app/smart/callback/page.tsx`).
* **Tests:** `lib/smart/smart-no-phi.test.ts` fails on any `console`, `fetch`, beacon, `localStorage`, cookie or analytics import in the SMART and CDS code, on `sessionStorage` anywhere but `lib/smart/session.ts`, if the session is not cleared before the review is shown, or if record values ever go in a query string.

### CDS Hooks service
* `lib/cds/service.ts` reads the request, builds cards and returns; nothing else. `app/api/cds-services/[id]/route.ts` never logs the body and error responses never repeat it. Cards never repeat the patient id, name, practitioner or observation ids.
* **Tests:** `lib/cds/service.test.ts` (identifiers never appear in cards) and `app/api/cds-services/routes.test.ts` (no console output and no network call for a request full of identifiers).

### LIS adapters
* `integrations/lis/shared/clinexia-lis.js` returns a message and a report; it never logs. The CLI prints counts and skip reasons only. The Mirth backend sends only the numbers a formula needs.
* **Tests:** `integrations/lis/test/lis.test.ts` forbids `console`, `logger`, `print` and Java System output in every example source and checks the printed summary contains no values or identifiers; `integrations/lis/test/mirth.test.ts` checks the request bodies sent to the API contain no names, record numbers, birth dates or order numbers.

## Where values CAN still reach a server (read this)

1. **A `?query` string is part of the request URL.** If you prefill with `/embed/renal/creatinine-clearance?creatinine=1.2&age=54`, the web server, the CDN and the hosting provider's access logs see the whole URL. Our code does not log it, but the platform may keep it. **Use the `#fragment` form (`...#creatinine=1.2&age=54`) or a postMessage prefill instead.** The calculator reads both; only the fragment and postMessage stay in the browser.
2. **The hosting provider and any monitoring tool you attach** (access logs, log drains, error monitoring, analytics scripts) are outside what these tests can see. Review their settings and retention. Request bodies are not normally part of access logs, but confirm it for yours.
3. **The normal calculator pages** (not the embed, API or SMART flows) keep their usual behaviour: a calculation is saved to the user's own device history and a usage event (which calculator, not the values) is sent to analytics. A deep link with `calculate=1` on a normal page does the same. Use the embed view for anything about a real patient.
4. **The SMART callback URL** carries a one-time authorisation code and state. They are not clinical data, but they appear in server and CDN logs; the service worker does not cache them.
5. **The browser** can keep a URL in history, and extensions can read pages. The fragment is removed from the address bar once read; nothing can be done about extensions.
6. **The EHR, the LIS and your own systems** keep whatever they keep. The Mirth example sends age and sex (not date of birth) to the API; decide whether that is acceptable, or use the local Node example.
7. **An integrator who logs requests or responses** on their side puts the values in their own logs.

## What these tests do and do not prove

They are structural (what the code imports and contains) and runtime checks in-process (a request with identifiable-looking values produces no console output and no network call). They cannot prove what a deployed platform, a proxy, a browser extension or a partner's system records. Before going live, check a real deployment: open the network tab while using each flow, look at the hosting logs after a test call with an obviously fake value, and review the log and monitoring settings.
