# Integrating Clinexia with EMRs, labs and other software

Clinexia's calculators (about 160) and unit conversions can be used from other systems in five ways. This page says which fits whom.
Everything here is a **calculation and reference aid for qualified clinicians** (see `intended-use.md`, a DRAFT pending legal and regulatory review).
Send **numbers, never identifiers**: see `no-phi-by-design.md` for exactly what is and is not recorded.

## Which path fits which audience

| You are | You want | Use | Needs from Clinexia | Patient values leave your system? | Maturity |
|---|---|---|---|---|---|
| **Clinician** | A calculator already filled in from a link in your own notes, intranet or protocol | **Deep links with prefill** (`embed.md`): put the values in the `#fragment`, not the query string | nothing | not to Clinexia if you use `#...`; **a `?query` string is part of the request URL and can end up in hosting logs** | built and tested in-process; not tried in a browser by us |
| **Hospital / EMR team** | A calculator inside a patient chart, filled from the record | **Embed** (`embed.md`) and, for filling from the record, **SMART on FHIR** (`smart-on-fhir.md`) | your site's origin added to the allowlist; a SMART client id registered with your EHR | no: SMART reads the record in the clinician's browser and never sends it to Clinexia | embed and SMART built; **never run against a real EHR** |
| **Hospital / EMR team** | Alerts or cards in the EHR without opening a calculator | **CDS Hooks service** (`smart-on-fhir.md`, last section) | the service switched on by Clinexia | the EHR sends the prefetched numbers to the service, which answers and drops them | **stub only, off by default, does not verify the EHR's signed token yet** |
| **Laboratory** | Calculated values (anion gap, corrected calcium, LDL, red cell indices, eGFR) added to results | **LIS / HL7 adapters** (`../../integrations/lis/README.md`) | nothing for the local Node example; an API key for the Mirth example | local: no. API: numbers (and age and sex for eGFR) only | **reference examples, not production**; the lab must validate them |
| **Software vendor** | Calculators and conversions in your product, server to server | **Public API v1** (`api.md`, OpenAPI at `/api/v1/openapi.json`) | an API key from an organisation owner or admin; the dosing scope only by explicit grant | numbers only; no inputs or results are kept | built and tested in-process; **not tried against a live deployment** |
| **Software vendor** | The calculators inside your own app, offline | **`@clinexia/core`** (`../../packages/core/README.md`, `mobile-migration.md`) | the package; **not published, licence undecided** | no: it has no network, storage or logging | built; the build and tests pass in this repository |

### Quick decision

* Only want to **look something up** with values you already have → deep link, with the values after `#`.
* Want it **inside a chart** → embed; add SMART if values should come from the record.
* Want **numbers added to lab results** → the LIS adapters (run them locally if your policy forbids sending even numbers out).
* Want **machine access** → the API (server to server only; never put a key in a web page or app).
* Want it **in your own app, offline** → `@clinexia/core`.

## What is where

| Document | What it is for |
|---|---|
| `intended-use.md` | DRAFT intended-use and limitations statement, and what integrators must do. For legal and regulatory review. |
| `no-phi-by-design.md` | What is and is not logged, stored or sent in each flow, with the code and tests that enforce it. |
| `security.md` | Key handling, rate limits, the embedding and CSP model, origin allowlists, threat notes. |
| `FINDINGS.md` | Baseline, everything unverified, suspected formula issues, reference gaps, decisions needed. **Read this before relying on any of it.** |
| `embed.md` | Iframe snippets, URL parameters, the postMessage contract. |
| `api.md` | The public API: auth, scopes, endpoints, errors, versioning. |
| `units-and-coding.md` | Unit normalisation and the LOINC / UCUM / FHIR metadata. |
| `smart-on-fhir.md` | The SMART launcher, EHR registration checklists, the CDS Hooks stub. |
| `CHANGELOG.md` | How formula versions work and when they change. |
| `reference-gaps.md` | Generated list of calculators whose reference needs review. |
| `mobile-migration.md` | Moving the mobile app onto `@clinexia/core`. |

## Ground rules that hold across every path

1. **No formula, rounding or default was changed** to make any integration work. Suspected problems are listed in `FINDINGS.md` and left alone.
2. **Dosing and oncology calculators are higher risk.** The API exposes them only to keys explicitly granted the dosing scope; SMART and the LIS adapters never use them.
3. **Every calculation carries a formula version** (`CHANGELOG.md`). Read it if you need to know which behaviour produced a number.
4. **Nothing was run against a real EHR, a real LIS or a live Supabase deployment by the author of these documents.** Treat every integration as needing your own validation first.
