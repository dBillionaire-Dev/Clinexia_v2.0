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

- **Every LOINC code** in `lib/calculators/coding-metadata.ts` (written without access to loinc.org). All pass the LOINC mod-10 check digit (tested), which only catches typos. Run `node --experimental-strip-types scripts/verify-loinc.mjs <Loinc.csv>` and read the printed names. Codes used: 2160-0 creatinine (mass), 29463-7 body weight, 8302-2 body height, 3094-0 urea nitrogen, 2345-7 glucose, 17861-6 calcium, 1751-7 albumin, 2951-2 sodium, 2075-0 chloride, 1963-8 bicarbonate, 2093-3 total cholesterol, 2085-9 HDL, 2571-8 triglycerides, 718-7 hemoglobin, 4544-3 hematocrit, 789-8 RBC, 6690-2 WBC, 5902-2 prothrombin time, 8480-6 systolic BP, 8462-4 diastolic BP, 8867-4 heart rate; results: 98979-8 eGFR (believed CKD-EPI 2021, which is the formula shown), 33914-3 eGFR (believed MDRD), 39156-5 BMI, 8277-6 BSA, 33037-3 anion gap, 43396-1 non-HDL cholesterol, 8478-0 mean arterial pressure.
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
