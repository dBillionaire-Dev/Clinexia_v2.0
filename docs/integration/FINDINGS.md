# Integration findings

_Kept up to date by every phase. Anything not verified is listed under UNVERIFIED; nothing here claims a thing works unless it was run._

## Phase 0 baseline

- Date: 2026-10-24
- Install / typecheck / test / build: install: pass; typecheck: pass; test: pass; build: pass; 
- Test summary line: Tests  980 passed (980)
- Backup files (`*.bak*`) were removed in their own commit and `*.bak*` is now in `.gitignore`.

## Flagged files

- `supabase/analytics (2).sql` looks like an accidental duplicate of `supabase/analytics.sql` (space and "(2)" in the name, usually left by a browser download).
  **It was not deleted.** A person should diff it against `analytics.sql` and `analytics-fix-2026-10.sql` and decide whether it is needed.

## UNVERIFIED items

_None yet._

## Suspected formula issues (not fixed)

_None yet._

## Reference gaps summary

_Filled in by Phase 3._

## Decisions needed

_Filled in by Phases 1-8._

## Phase 1 (prefill deep links and embed mode)

### UNVERIFIED (reasoned, not confirmed in a browser or a deployed build)

- `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin` (production only) should not stop `/embed` being framed: COOP governs top-level windows and CORP governs subresource loads, and the embed loads its own assets from its own origin. Reasoned from the specifications. Confirm with the manual checklist in `docs/integration/embed.md` after the first deployment.
- `next.config.mjs` now excludes `/embed` from the global header rule with the source pattern `/((?!embed/|embed$).*)`. The unit test checks the pattern as a regular expression; whether the Next.js version in use accepts it was verified only by `pnpm build` passing on the machine that ran the script.
- The `ready` message type and `calculate: true` in the parent-to-child message are additions beyond the original brief, kept because the parent cannot know when the embed can receive a prefill.
- Embed view with `?theme=` can flash the system theme for a moment before the forced theme applies (theme is enforced through next-themes after hydration; an inline script sets the class earlier).

### Behaviour worth knowing

- History saving in the normal calculator calls analytics (`useHistory.record` -> `trackCalculation`). The embed view therefore skips history, usage tracking and favourites entirely. A structural test (`lib/integration/embed-no-phi.test.ts`) guards this; it cannot prove runtime behaviour, so use the network-tab check in `embed.md`.
- A deep link with `calculate=1` on the NORMAL calculator page behaves like a user pressing Calculate: it saves to local history and reports a usage event, as any calculation there does.
- The service worker no longer caches `/embed/*` navigations, nor `/calculators/*` or `/conversions/*` navigations that carry a query string (the cache key is the full URL, and prefill values can be patient data). The plain pages are cached as before.
- `/embed` still goes through the premium gate (a no-op unless locking is on). Dosing and oncology calculators can be embedded; only the API (Phase 4) gates dosing by key scope.
- Deep-link unit params (`creatinine_unit=umol/L`) are accepted only when equal to the input's own unit until Phase 2 plugs in the conversion-backed resolver.
- No render test for the embed route: `vitest.config.ts` only runs `*.test.ts` in a node environment, and the calculator runner depends on browser-only hooks. Structural tests plus the manual checklist cover it instead.

### Decisions needed

- Should dosing / oncology calculators be embeddable by partners at all, or only after a per-partner opt-in?
- Partner onboarding for `embed_partners` (who adds origins, how they are verified). Run `supabase/embed-partners.sql` once in the Supabase SQL editor.

## Phase 2 (clinical coding metadata and unit normalisation)

### UNVERIFIED

- **Every LOINC code** in `packages/core/src/calculators/coding-metadata.ts` (written without access to loinc.org). All pass the LOINC mod-10 check digit (tested), which only catches typos. Run `node --experimental-strip-types scripts/verify-loinc.mjs <Loinc.csv>` and read the printed names. Codes used: 2160-0 creatinine (mass), 29463-7 body weight, 8302-2 body height, 3094-0 urea nitrogen, 2345-7 glucose, 17861-6 calcium, 1751-7 albumin, 2951-2 sodium, 2075-0 chloride, 1963-8 bicarbonate, 2093-3 total cholesterol, 2085-9 HDL, 2571-8 triglycerides, 718-7 hemoglobin, 4544-3 hematocrit, 789-8 RBC, 6690-2 WBC, 5902-2 prothrombin time, 8480-6 systolic BP, 8462-4 diastolic BP, 8867-4 heart rate; results: 98979-8 eGFR (believed CKD-EPI 2021, which is the formula shown), 33914-3 eGFR (believed MDRD), 39156-5 BMI, 8277-6 BSA, 33037-3 anion gap, 43396-1 non-HDL cholesterol, 8478-0 mean arterial pressure.
- The brief suggested 2160-0, 14682-9, 29463-7 and 8302-2; they were also not checked here. 14682-9 (creatinine, moles/volume) is not used because the calculators take mg/dL.
- **No code is given** (UCUM only) where it could not be recalled with confidence: QT interval, Cockcroft-Gault CrCl, estimated osmolality, red cell indices outputs, INR (the input is PT).
- UCUM strings (`10*9/L`, `mm[Hg]`, `/min`, `a`, `mL/min/{1.73_m2}`, `mosm/kg`) follow the UCUM specification but were not machine-validated. Validate with a UCUM library before publishing.
- Molecular weights used for mass/molar conversion come from `lib/conversions/molar-mass.ts` (not independently checked).

### Behaviour worth knowing

- Conversion factors come from the engine's molecular weights, so results can differ from textbook factors in the 4th digit: 88 µmol/L creatinine is 0.99546 mg/dL here (the 88.4 rule gives 0.99548); 5.5 mmol/L glucose is exactly 99 mg/dL (MW 180.0; the usual 18.016 factor gives 99.09). The existing "Creatinine Unit Conversion" calculator uses 88.4 and was not touched.
- Inch and foot are not in the public conversion table. They are added to a local copy for the normaliser only (exact by definition); the conversion tool is unchanged.
- Required inputs are never defaulted (a missing `sex` is an error), unlike the web form which pre-selects "male".
- Mass to molar is refused for BUN (urea nitrogen is not urea) and albumin (no molar mass defined). Drug-dose inputs (mg etc.) and inputs with no fixed unit accept only plain values.
- The LDL Friedewald lipid values share one unit select, so they take plain values plus that select; per-value units are refused.
- No registered calculator takes a temperature; temperature conversion is implemented and tested on a synthetic definition.
- `normaliseInputs` is not yet used by any endpoint; Phase 4 (API) and Phase 6 (SMART) call it. Today only deep links use it (`?creatinine=88&creatinine_unit=umol/L`).
- Coding metadata is applied by the registry from one table; no definition file or formula changed. Dosing and oncology calculators have none (tested).

### Decisions needed

- Which factors are authoritative for lab interoperability: the engine's molecular weights or the conventional rounded factors (88.4, 18.016, 0.2495 ...)? A lab may expect the conventional ones.
- Should mEq/L be accepted for sodium, potassium, chloride and bicarbonate (1 mEq = 1 mmol for these)? Not supported today.
- Should inch and foot be added to the public conversion tool?

## Phase 3 (formula versions, test vectors, reference gaps)

### Findings

- **No calculator currently has a `review-needed` reference** (all 162 are `current` or `supporting`), so `docs/integration/reference-gaps.md` lists none. If you expected gaps, the statuses in `dosing-references.ts` / `everyday-references.ts` are what to look at; nothing was edited. Note that every Clinical Chemistry, Hematology, Laboratory Solutions, Spectrophotometry, Microbiology, Cardiovascular, Stem Cell and Oncology calculator is `supporting` (none is `current`).
- Two calculators needed hand-chosen test INPUTS because the generic choice fails or is meaningless: `gestational-age` (either LMP or due date, not both), `who-pediatric-ors-ongoing-loss` (whole stool count), `lean-body-mass` (flipping its unit selects gives invalid combinations). Results are never hand-written.
- Date-based calculators read "today" from local time; the vectors fix today to 1 June 2026 at local noon and force en-US number formatting (two calculators use `toLocaleString`). The generated data was checked to be byte-identical when generated under five time zones and a German locale.

### UNVERIFIED

- The shipped baseline was generated on a different machine and Node version from yours. It is expected to match; if `pnpm test` reports a mismatch, confirm you changed no calculator and run `pnpm integration:snapshots`.
- The test vectors detect CHANGE only. No clinician has reviewed these input sets or confirmed the expected outputs; they are a snapshot of behaviour on the baseline date.

### Decisions needed

- The semver policy in `docs/integration/CHANGELOG.md` (major = results change, minor = additive, patch = wording only). Wording-only edits also fail the build until bumped: confirm that is what you want.
- Who owns clinical review of the vectors and adds known-answer cases for dosing and oncology calculators (57 + 15).
- Whether `supporting`-only calculators (most of chemistry, haematology, etc.) should be promoted to `current` once someone verifies the sources.

## Phase 4 (public API v1)

### UNVERIFIED

- Nothing in this phase was run against a real Supabase project, a real Next.js build or a real browser. The handlers, key store contract, scopes, rate limiter, OpenAPI document and the no-PHI guards are tested in-process; the Supabase REST calls (`lib/api/key-store.ts`, `api_record_usage` RPC) and `supabase/api-keys.sql` have only been written to the same patterns as the existing billing code. Run the SQL, create a key, and try the curl examples in `docs/integration/api.md` against a deployment before relying on any of it.
- The per-key rate limiter is in memory per server instance (serverless instances do not share it). It is a speed bump, not a global guarantee.
- UCUM codes in `GET /conversions` (for example `mm[Hg]`, `[lb_av]`, `Cel`) follow the UCUM specification but were not validated by a library.
- The catalog's `outputs` field only carries the primary result's UCUM/LOINC (calculators do not declare their outputs). LOINC codes remain UNVERIFIED (Phase 2).

### Behaviour worth knowing

- **Dosing and oncology (72 calculators) need the `calculate:dosing` scope.** All 15 oncology tools are treated as dosing, including the supportive-care and cycle-progress ones. Default keys cannot run them (403), the catalog hides them from default keys, and the OpenAPI document does not enumerate them. Only an organisation owner can grant the scope, and only explicitly.
- A calculator that throws on a valid-looking combination (for example gestational age with both LMP and due date) is returned as `422 calculation_error` with the calculator's own message. A genuine bug inside a calculator would look the same.
- A batch counts as ONE call toward the rate limit, and its items are answered separately (200, 403, 404 or 422 each).
- Required inputs are never defaulted by the API (the web form pre-selects some).
- Only the Authorization header is accepted; cookies and query-string keys are refused. No CORS is configured for `/api/v1` and `lib/billing/cors.ts` was not touched.
- `key_hash` is looked up by its SHA-256 hash and then compared again in constant time. Unauthenticated calls are not metered.
- Key management sits behind the existing billing guard, so it returns 404 when billing is switched off. It uses the existing organisation membership and audit log.
- The NO-PHI tests: a static crawl of everything reachable from `lib/api` and `app/api/v1` (no analytics, history, feedback or UI module; no `calculation_events`/`trackCalculation`), a check that the API sources contain no `console` calls, and a runtime test that a request with identifiable-looking values produces no console output and no network call. The organisation-side key route uses the existing billing stores and is outside that crawl.
- The privacy policy page (`app/privacy/page.tsx`) was NOT changed. It says nothing about API keys or per-key call counts. Legal wording is needed before you offer the API.

### Decisions needed

- **Pricing and plans for API access.** Today any organisation owner or admin can create up to 10 keys; there is no plan check, no paid tier and no quota beyond the rate limit.
- **Browser-origin keys (CORS).** Skipped: `/api/v1` is server-to-server only. Decide whether any partner needs browser calls; if so it needs a `browser_allowed` flag per key and an origin allowlist.
- **Who may grant `calculate:dosing`.** Default here: the organisation owner only. Confirm, and decide whether granting it needs a manual Clinexia review per organisation.
- **Whether the supportive-care and cycle-progress oncology tools may move to `calculate:general`.**
- **Versioning and deprecation notice period** (proposed text in `api.md`).
- **Rate limit for production** and whether to add a shared store (Redis) for a global limit.
- **Privacy policy and terms wording** for API use (key metering, no-PHI instruction to partners, acceptable use).

## Phase 5 (shared core package)

### What changed

- `lib/calculators/**`, `lib/conversions/**` and the pure integration modules (`normalise`, `units`, `prefill`) now live in `packages/core/src` (`@clinexia/core`), together with their tests. Nothing in them was edited except import paths (`@/lib/...` to relative) and the three places in the moved tests that reached into the repository by path or into app code (see below).
- **Approach chosen: thin shims at the old paths, not rewriting every import.** Each old file (`lib/calculators/registry.ts` and so on, 47 of them) is now one line, `export * from "@clinexia/core/..."`. Reason: it changes no import in the 100+ app files, so there is nothing to get wrong, the diff is mechanical, and `lib/core-shims.test.ts` can prove every shim is the very same object as the package's export. The cost is one extra hop and old paths that look like app code. Update imports to `@clinexia/core` gradually, then delete shims.
- **How the app finds the package: a source alias, not a build.** `tsconfig.json` paths and `vitest.config.ts` map `@clinexia/core` to `packages/core/src`, so the web app, tests and Vercel need no build step for the package. `pnpm core:build` builds the distributable (ESM, CJS, types) with the repo's own TypeScript and no new dependencies.
- The core has **zero dependencies**, and `packages/core/src/core-boundary.test.ts` fails if any file there imports a package, `node:`, the `@/` alias or touches a browser global, or if `package.json` gains any dependency.
- Test movements: `versions.test.ts` lost one assertion (formula version used by the embed postMessage); it was re-added as `formulaVersionFor` in `lib/integration/embed-bridge.test.ts`. The generated test data and reference-gaps paths in the moved tests are now resolved from the test file's own location instead of the process working directory. `lib/calculators/service-worker-routes.test.ts` stays where it was (it tests the app's service worker).
- The phase scripts keep their backups in `.clinexia-backup/` inside the repo, and Phase 5's backup contains copies of the moved tests. `tsconfig.json` and `vitest.config.ts` now exclude `.clinexia-backup` so those copies are never run or type-checked. (Delete `.clinexia-backup/` once you are happy with the phases.)
- `scripts/check-formula-drift.mjs` (with a test) and `docs/integration/mobile-migration.md` explain how the mobile repo should consume the package and how to measure its drift.

### UNVERIFIED

- **`pnpm install` and the lockfile.** Adding `packages/core` to the workspace (`packages: ["packages/*"]` in `pnpm-workspace.yaml`) adds a project to `pnpm-lock.yaml`. The script runs `pnpm install --no-frozen-lockfile` and commits the updated lockfile. CI and Vercel use a frozen lockfile, so push the lockfile with this phase. I could not run pnpm here, so the lockfile change is untested.
- **The real `next build` and `vitest`.** The tests were run in a stand-in runner; per file, every result is identical before and after the move (apart from the new tests and the one assertion moved). The Next.js build resolving the `@clinexia/core` alias through `tsconfig.json` paths was not run here.
- **The core build** (`pnpm core:build`) was run here with TypeScript 6 only: ESM and CJS output both load in Node and run a calculation. Your repo pins `typescript ^5`; the script picks `--ignoreDeprecations` from the compiler's major version (5.0 or 6.0) and stops with a message on TypeScript 7. The 5.x path was not run.
- The mobile repository was not visible. `mobile-migration.md` is written from the web side and every step must be checked against that repo.
- The `@clinexia/core/vectors` entry runs vectors that assume the formula version in this repo; it does not compare versions.

### Decisions needed

- **Licence for the npm package.** Placeholder `UNLICENSED`; `prepublishOnly` refuses until it is set. Also decide the registry (public npm, GitHub Packages, private) and whether to publish at all.
- Whether to delete the shims once imports are migrated, or keep them.
- How the mobile app should get the package while it is private (tarball, shared workspace, private registry).

## Phase 6 (SMART on FHIR launcher and CDS Hooks stub)

### UNVERIFIED (nothing here was run against a real EHR, a real FHIR server, the real `fhirclient` package, or a browser)

- **The `fhirclient` integration.** It is a new dependency (`fhirclient ^2.5.0`, which the script installs and writes to the lockfile). The code follows the library's v2 API from memory: `FHIR.oauth2.authorize({ clientId, scope, redirectUri, pkceMode: "required", iss, launch })` for an EHR launch and `fhirServiceUrl` for a standalone one, and `FHIR.oauth2.ready()` in the callback. The option objects are cast (`as never`) because the installed version's typings were not checked, which also means a wrong option name would be ignored at runtime rather than caught by the compiler. `pkceMode` and `fhirServiceUrl` should exist in 2.5; confirm. Whether the library works inside Next's client bundle without extra configuration is also untested.
- **Clearing the OAuth session.** `clearFhirSession` removes `SMART_KEY` and the state it points to from `sessionStorage`; that is the library's documented layout from memory. If it differs the session simply stays until the tab closes.
- **Observation searches.** `Observation?patient=<id>&code=http://loinc.org|<code>&_sort=-date&_count=10` is standard FHIR, but servers differ (some want a category parameter). Failed searches leave those inputs to the clinician.
- **Every LOINC code used** is the unverified one from Phase 2.
- **Vendor requirements** (Epic, Oracle Health, Meditech) in `docs/integration/smart-on-fhir.md` are checklists only and all UNVERIFIED. The SMART App Launcher sandbox steps are also from memory.
- **Iframes.** Third-party storage partitioning and cookie rules inside an EHR's iframe or embedded browser may break the sign-in; not tested.
- The proxy-based tests (`lib/smart/smart-proxy.test.ts`, `app/api/cds-services/routes.test.ts` runs without Next) follow the Phase 1 pattern; the one that imports `next/server` was not run here.

### Behaviour worth knowing

- Values from the record reach the calculator in the **URL fragment**, which is never sent to a server. This replaces "redirect with prefill params": query-string values would have reached Clinexia's servers and logs. The calculator page reads the fragment once, fills the form and removes it from the address bar. Provenance (`src_<input>` = date or `patient`) travels the same way.
- `/smart` is **framable by the same allowlist as /embed**, because EHRs often open SMART apps in an iframe. The shared rule is `isFramablePath` (proxy, `next.config.mjs`, site chrome). The service worker skips `/smart/*`.
- Standalone launch uses `launch/patient` instead of `launch` (required by SMART App Launch); otherwise the scopes are exactly the ones you specified.
- An empty `NEXT_PUBLIC_SMART_ALLOWED_ISS` refuses every launch. Nothing about any FHIR server or partner is hard-coded.
- Only calculators with FHIR-coded inputs and outside dosing and oncology can be launched; an unknown `calc` falls back to `egfr-ckd-epi`.
- Gender other than exactly male or female, a partial birth date, a result without a date, a preliminary result and an unconvertible unit are all skipped, never guessed. Two different values at the same instant are a conflict and nothing is filled in.
- `fhirclient` keeps the access token and the patient id in `sessionStorage` while the sign-in runs; Clinexia code clears them as soon as the review is built.
- The CDS Hooks service **does not verify the EHR's JWT**. It is off by default; `CDS_HOOKS_SHARED_SECRET` is an optional stopgap. It only computes from what the caller sends and stores nothing.
- Cards link to the calculator with the values in the fragment; the EHR already holds those values.

### Decisions needed

- **Freshness limit for everything other than creatinine and height.** 90 days is a placeholder (weight, blood pressure and other labs age differently).
- Which EHRs to register with first, who owns each registration and each hospital's activation, and the production client ids.
- Who verifies the CDS Hooks JWT (needs each EHR's issuer and JWKS) before the service is ever switched on.
- Whether `launch/patient` standalone launch should be offered at all, or EHR launch only.
- Privacy policy, terms and intended-use wording for reading a patient record (all pending legal review).
- Whether `/smart` should be framable by the same allowlist as `/embed` or by a separate one.

## Phase 7 (LIS / HL7 reference adapters)

### UNVERIFIED

- **Mirth Connect.** The Mirth files (`integrations/lis/mirth/`) were run only in a Node sandbox that imitates the few Mirth and Java objects they use (`connectorMessage`, `configurationMap`, `channelMap`, `java.net.URL`, `java.lang.String`, `java.util.Scanner`), against a fake API. Whether a real Mirth engine (Rhino) runs them was not tested: the ES5 style is enforced by a test, but the `JSON` object, `HttpURLConnection` from Rhino, code template libraries and the HL7 raw-data accessor are from memory. Mirth's inbound data type must deliver ER7 text with `CR` separators.
- **Every LOINC code** (inputs, the alternate identifiers on calculated results, and the "already reported" codes `33037-3`, `13457-7`, `787-2`, `785-6`, `786-4`, `98979-8`, `62238-1`, `33914-3`) is unverified (Phase 2). Calculated results use a LOCAL code (`CLX-...`) as the primary identifier for exactly this reason.
- **Receiving systems.** Whether a given LIS or EMR accepts a separate ORU^R01 that attaches to an existing order by copying PID/ORC/OBR, and how it treats OBX-15, OBX-17, an empty OBX-7 and the NTE segment, was not tested.
- **Unit equivalences used by the adapter** (not in the conversion engine): `10^6/uL` equals `10^12/L` (the same number), and `L/L` hematocrit times 100 is percent. Both are exact but are adapter policy, not core behaviour.
- The independent eGFR check in the tests uses the published CKD-EPI 2021 equation written out in the test; the calculator agrees with it to rounding (67 mL/min/1.73 m2 for the sample), which is also what its Phase 2 coding assumed. This is a check of the arithmetic only.
- Nothing was run against a real LIS, real HL7 traffic, MLLP, or real patient data. The samples are synthetic.

### Behaviour worth knowing

- One shared ES5 file holds all the logic; the Node example plugs in `@clinexia/core` (no network) and the Mirth example plugs in the Clinexia API. The Mirth test proves both produce identical messages.
- The output is a **new message with only the calculated results** under copied PID/ORC/OBR; the original is never modified. Each calculated OBX is flagged with OBX-17 `CALCULATED`, has a local code, is `P` (preliminary) by default, and is followed by a note that names the calculator, the formula version and the input results.
- Safety rules: same order only, final or corrected results only, numeric values only, a unit must be present, repeats with identical values are fine but different values are never picked or averaged, inputs observed at different times are never combined, and an unknown unit is never guessed. eGFR age is taken at the observation date from PID-7.
- An output already reported by the analyser or LIS (or already carrying our `CLX-` code) is never calculated or emitted; `compare` reports differences for reconciliation without emitting.
- The adapter refuses its own output (sending application `CLINEXIA_CALC`), to prevent channel loops.
- Nothing logs: tests forbid `console`, `logger`, `print` and Java System output in every example source, and the CLI prints only counts and skip reasons. The API call from Mirth sends only numbers, age and sex (no names, identifiers or birth dates); a test checks the request bodies.
- No reference ranges or abnormal flags are produced for calculated results (OBX-7 and OBX-8 stay empty).
- The calculator's own safety warnings, if any, are appended to the note.

### Decisions needed

- **Result status of calculated values.** Default `P` (preliminary) so nothing is released without the laboratory's own step; many sites will want `F`. Who decides, and under which SOP?
- **Code system for calculated results**: your own local codes, or verified LOINC codes. Needs the laboratory's test catalogue.
- **Local calculation or the API.** The Node example calculates locally; the Mirth example sends numbers (and age and sex) to the Clinexia API. Which is acceptable to the laboratory's data policy?
- **Reconciliation policy** when the analyser and Clinexia disagree (which value is reported, who investigates, tolerance).
- **Reference ranges and flags** for calculated values: who supplies them.
- **Validation ownership and evidence** (laboratory director, quality system), and whether this reference code is ever to be used as a basis for production.
- The "already reported" code lists and `localCodeMap` per laboratory.
