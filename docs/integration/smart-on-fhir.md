# SMART on FHIR launcher and CDS Hooks stub

Lets an EHR open a Clinexia calculator already filled in with the patient's age, sex and recent results, read **in the
clinician's browser** from the EHR's FHIR server. Nothing from the record is sent to Clinexia's servers.

> **Intended use (DRAFT, pending legal and regulatory review).** A calculation and reference aid for qualified clinicians. Verify
> every value and every result. Not a diagnostic device.

## How it works

1. The EHR opens `https://<host>/smart/launch?iss=<FHIR base>&launch=<token>` (EHR launch), or a person opens `/smart/launch` and picks an
   allowed FHIR server (standalone launch).
2. The page checks the FHIR server is on the allowlist, then starts the OAuth sign-in with the `fhirclient` library using
   **PKCE** (required) and no client secret.
3. The EHR sends the browser back to `/smart/callback`. The page reads the Patient and, for the chosen calculator, one Observation
   search per LOINC code (newest first).
4. A **review step** shows every value with its **observation date**, how old it is, and a warning when it is older than the freshness
   limit (30 days for creatinine, 1 year for height by default). Values that were not found, or could not be converted safely, are listed so
   the clinician enters them. Nothing is calculated automatically.
5. "Open the calculator" goes to the normal page (or the embed view) with the values in the URL **fragment** (`#...`), which browsers never
   send to a server. The calculator reads it, fills the form, removes the fragment from the address bar, and shows the date and age of each
   value next to the form. The OAuth session (tokens and the patient id kept by the library in `sessionStorage`) is cleared as soon as the
   review is built.

What is read: `Patient.birthDate` (age in whole years, only from a complete date), `Patient.gender` (only exactly male or female), and
Observations matched by the LOINC codes in the calculator's coding metadata (Phase 2; **the LOINC codes are UNVERIFIED**). Only `final`,
`amended` and `corrected` results with a number and a date are used; the most recent wins; two different values at the same instant are a
conflict and nothing is filled in. Units are converted with the same converter as the API; an unknown unit is skipped, never guessed.

Only calculators with FHIR-coded inputs that are **not** dosing or oncology tools can be launched. Pick one with `?calc=<id>` (default
`egfr-ckd-epi`), for example `creatinine-clearance`, `bmi`, `bsa`.

## Scopes (kept minimal)

| Launch | Scope |
|---|---|
| EHR launch | `launch openid fhirUser patient/Patient.read patient/Observation.read` |
| Standalone | `launch/patient openid fhirUser patient/Patient.read patient/Observation.read` |

`launch` or `launch/patient` gives the patient context; `openid fhirUser` identifies the signed-in clinician; `patient/Patient.read`
and `patient/Observation.read` are the only data the app reads. No write scopes, no `user/*` or `system/*`, no `offline_access` (no refresh
token: the app is used within one session). Standalone launches use `launch/patient` instead of `launch` as the SMART App Launch
specification requires for a launch without an EHR.

## Configuration (all in `.env.example`)

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_SMART_CLIENT_ID` | Client id registered with the EHR. Without it the launcher refuses to start. |
| `NEXT_PUBLIC_SMART_ALLOWED_ISS` | Comma-separated FHIR base URLs the app may connect to. **Empty means every launch is refused.** |
| `NEXT_PUBLIC_SMART_STALE_DAYS_CREATININE` / `_HEIGHT` / `_OTHER` | Freshness limits in days. Defaults 30 / 365 / 90 (the 90 is a placeholder, a Decision needed). |
| `EMBED_ALLOWED_ORIGINS` or the `embed_partners` table | Also governs who may FRAME `/smart` (see below). |

**Framing.** Many EHRs open SMART apps in an iframe or embedded browser. `/smart` is framable by the same allowlist as `/embed`
(`EMBED_ALLOWED_ORIGINS` plus `embed_partners`): add the EHR's origin there. Every other route stays protected.

**Caching.** The service worker never caches `/smart/*` (the callback URL carries a one-time authorisation code).

## Testing with the SMART App Launcher sandbox first

All of this is UNVERIFIED: written from memory of the public sandbox at `https://launch.smarthealthit.org`, not run.

1. Set `NEXT_PUBLIC_SMART_ALLOWED_ISS=https://launch.smarthealthit.org/v/r4/fhir` and any non-empty `NEXT_PUBLIC_SMART_CLIENT_ID` (the sandbox is
   open and, as far as is known, accepts any client id), redeploy or run locally. A local run needs `http://localhost:3000`, which the allowlist
   accepts for plain http.
2. In the launcher, choose FHIR version R4, the launch type "Provider EHR Launch", a test patient, and set the app launch URL to
   `https://<host>/smart/launch?calc=creatinine-clearance` (use `http://localhost:3000/smart/launch?...` locally).
3. Launch. Expected: the review page lists age and sex from the patient and any creatinine and weight observations, with dates; "Open the calculator"
   fills the form and shows the dates.
4. Repeat as "Standalone launch" by opening `/smart/launch` yourself.
5. Check in the browser's network tab that no request carries values to the Clinexia host.

## Registering with a real EHR (checklists only)

**Every vendor-specific item below is UNVERIFIED.** Confirm each against the vendor's current documentation before relying on it. A sample of the facts you will
be asked for is in `smart-client-registration.sample.json`.

*Common to all:*
- [ ] Decide the production host and set `NEXT_PUBLIC_SMART_CLIENT_ID` / `NEXT_PUBLIC_SMART_ALLOWED_ISS` per environment.
- [ ] Redirect URI `https://<host>/smart/callback` registered exactly.
- [ ] Launch URL `https://<host>/smart/launch?calc=<id>` registered; the EHR appends `iss` and `launch`.
- [ ] Public client with PKCE; scopes exactly as in the table above.
- [ ] Add the EHR's origin to `EMBED_ALLOWED_ORIGINS` / `embed_partners` if it frames the app.
- [ ] Legal: intended-use statement, privacy policy and terms wording (all pending), and any vendor security questionnaire.

*Epic (UNVERIFIED):*
- [ ] Register the app on Epic's developer portal; whether a non-production client id is issued immediately, and the production review process.
- [ ] Which app audience applies (clinician-facing), the FHIR version, and whether the scopes need the `.read` (v1) or `.rs` (v2) spelling.
- [ ] Observation search requirements (for example whether a category parameter is required alongside code).
- [ ] How the launch URL and redirect URIs are registered, and per-organisation activation by each hospital.

*Oracle Health (formerly Cerner) (UNVERIFIED):*
- [ ] Register the app in the vendor's code console; application type (provider), launch type, scopes, redirect URI.
- [ ] Tenant-specific FHIR base URLs (`iss`) and how each customer's tenant authorises the app.
- [ ] Whether PKCE is required or supported for public clients, and its scope spelling.

*Meditech (UNVERIFIED):*
- [ ] The registration route and sandbox for SMART apps, FHIR version, scope spelling, per-customer enablement.
- [ ] Whether the EHR launches in an iframe, an embedded browser or a new window (affects framing and session storage).

## CDS Hooks service (stub)

Behind `CDS_HOOKS_ENABLED=true` (off by default; both routes answer 404 while off).

- Base URL for the EHR: `https://<host>/api`. Discovery: `GET /api/cds-services`. Service: `POST /api/cds-services/clinexia-renal-function`.
- One hook, **`patient-view`**. The EHR prefetches the patient, creatinine and weight (templates in the discovery document) and Clinexia answers with up to
  two cards: eGFR (CKD-EPI) and creatinine clearance (Cockcroft-Gault), each only when every required input is available. An old creatinine makes a warning card.
  The card text says which values and dates it used and carries the disclaimer; its link opens the calculator with the values in the fragment.
- **Stateless and free of PHI.** The request is read, turned into cards and dropped. Nothing is logged, stored or forwarded, error responses never repeat the request, and
  the cards never repeat patient identifiers (tests enforce all of this).
- **Not production-ready.** The EHR's signed JWT is **not verified yet**. Until it is, either keep the service off, or set `CDS_HOOKS_SHARED_SECRET` (a stopgap
  bearer secret the EHR must send). Verifying the JWT needs the EHR's JWKS URL and issuer: vendor-specific (UNVERIFIED).
- Only `patient-view` is implemented; `order-select` and others are not.
