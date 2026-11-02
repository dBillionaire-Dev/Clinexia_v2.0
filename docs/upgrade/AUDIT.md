<!-- clinexia-upgrade:phase0 -->
# Clinexia audit (web v2.0 and mobile v3.0)

Audit date: 2026-10-26. Method: read both repos, ran the existing typecheck/tests/build, probed the real calculator registry,
and verified clinical sources on the web. Nothing here is a clinical sign-off.

## 1. Baseline (before any change)

| Check | Web | Mobile |
|---|---|---|
| `typecheck` | clean | clean |
| `test` | 73 files, 1,183 tests pass | 35 files, 722 tests pass |
| production build | passes (`next build --webpack`) | not run |

Note on the web build: with Turbopack the build needs to download Google Fonts (`next/font/google`). Offline CI or a locked-down network fails here
(it failed in the audit environment). Not a code defect, but it is a build-reliability risk (finding F13).

## 2. What already works and must be preserved

- A real clinical-audit and validation culture: formula versions, test vectors, reference-gap tracking, bounds checking, dosing safety warnings (web).
- Analytics send only tool id, name and category: **no clinical values** leave the device. Keep it that way.
- Result history is local. Mobile history stores only the result text, not the inputs.
- Existing Cockcroft-Gault and CKD-EPI 2021 implementations **match** independent implementations of the published formulas (new test in Phase 4).
- Offline-first design, update watcher, embed/EMR bridge with origin checks.

## 3. Findings

Severity: **P0** safety/security, fix now. **P1** important. **P2** should fix. **Info** note.
Status: **Phase N** = fixed by that phase's script. **Open** = not changed. **Your call** = needs a decision from you.

| ID | Sev | Where | Finding | Status |
|---|---|---|---|---|
| F1 | P0 | mobile `components/calculator-runner.tsx` | The runner never calls `validateCalculatorInputBounds`, `getDosingSafetyWarnings` or `getCalculatorSafetyWarnings`. They exist in `lib/calculators/` but are dead code on Android, so range limits and dosing/safety warnings do not run there. | **Phase 1** |
| F2 | P1 | web + mobile runners | A result stays on screen after the user changes an input, so an old result can look current. | **Phase 1** |
| F3 | P1 | web `public/service-worker.js` | Precache stores page HTML only. The ~24 hashed JS/CSS files each page needs are not precached (confirmed in `.next` output), so a page never opened online can render offline but not become interactive. The install step also fires ~250 requests at once and silently ignores failures; the runtime cache never shrinks; an uncached offline URL is answered with the home page. | **Phase 3** |
| F4 | P1 | mobile `lib/billing/tokens.ts`, `AndroidManifest.xml` | Sign-in tokens are in WebView `localStorage` and `allowBackup="true"`, so they can be swept into Android backups. | **Phase 3** (backup exclusion). Residual risk **Open**: tokens are still readable by any script in the WebView and on rooted devices. Move them to Keystore-backed secure storage. |
| F5 | P2 | mobile `public/sw.js` | The web-build service worker cached every GET, including `/api/` calls and other origins. | **Phase 3** |
| F6 | P2 | mobile search | Substring match only, in two separate copies. Web has fuzzy and concept-aware search. | **Phase 1** |
| F7 | P2 | mobile | No "recently used", no favorites on Home. | **Phase 1** |
| F8 | P2 | both | Icon buttons are 36 to 40 px. | **Phase 1** (44 px) |
| F9 | P2 | HAS-BLED, DAPT standard form | Every question silently defaults to "No". | **Phase 2** adds Guided mode with explicit Yes/No/Unknown. The standard form is unchanged: **Your call**. |
| F10 | P2 | `cha2ds2-vasc`, `has-bled`, `dapt-score` definitions | `calculate()` treats any value other than `"yes"` as "no" (a missing or misspelled answer scores 0). The UI blocks this. The API/EMR path depends on your `normaliseInputs`. | **Your call.** Not changed, because it would alter behaviour for EMR callers who omit negative findings. Recommended: reject missing/unknown values in `normaliseInputs`. |
| F11 | P2 | both runners | A select value was never checked against its options (stale links, embeds, old state). | **Phase 2** |
| F12 | P2 | web `lib/history/db.ts` | History stores the entered clinical values with no expiry and no setting to turn it off. | **Open**. Recommended: "save inputs in history" switch and auto-delete after N days. |
| F13 | Info | web build | Needs network for Google Fonts. Consider `next/font/local`. | **Open** |
| F14 | Info | architecture | The calculator layer is duplicated in two repos. Mobile is a lagging copy: it has no formula versions, test vectors or coding metadata. Every clinical fix must be made twice. | **Open**. The phase scripts patch both. Recommended: one shared package. |
| F15 | P1 | evidence | Risk scores showed only generic text and category-level references: no result type, intended population, band source or limitations. | **Phase 2** (CHA2DS2-VASc, HAS-BLED). Other tools: **Open**. |
| F16 | Info | clinical content | Published SOFA tables leave boundary values unassigned (bilirubin 12.0, creatinine 5.0). Sepsis guidance changed: the **2026** Surviving Sepsis Campaign guideline replaces 2021. | **Phase 4** documents and handles both; needs clinician confirmation. |

## 4. Protected from edits

Your EMR/FHIR/API/embed work and formula-version files are listed in `docs/upgrade/PROTECTED_PATHS.md`. Every script hashes them before and after and stops if any changed.
Scripts touch two files that you may also be editing, using small anchored edits that fail safely if the text differs:
`lib/calculators/registry.ts` (Phase 4, one import and one array expression) and `components/calculators/calculator-runner.tsx` (web, Phases 1 and 2).
If you have local changes in those, run with `--dry-run` first.

## 5. Not built, and why

| Item from the brief | Reason |
|---|---|
| Emergency mode, dose-by-weight / paediatric dosing sheets | High-risk. Needs named sources and a clinical reviewer per drug. Not safe to generate unreviewed. |
| Patient-friendly explanations | Needs reviewed wording per tool; the Phase 2 evidence panel and review gate are the foundation. |
| Account-scoped favorites/sync, share-as-PDF | Needs a backend/privacy decision. |
| Pricing, willingness-to-pay figures | Not invented. See Phase 5 for how to measure them. |
| Android build/instrumented tests | The Android toolchain was not available in the environment that produced the scripts. XML was checked for well-formedness only. |

## 6. Testing limits

Vitest runs in a plain Node environment here: UI components (guided mode, patient panel, collections, offline notice) are covered by
typecheck and production build, not by automated render tests. Use the manual matrices in `docs/upgrade/OFFLINE_TEST_MATRIX.md`.
Adding a DOM test setup (jsdom + Testing Library) is the best next investment.
<- Add tests for the self-test rules, the tap counter and the clinexia-upgrade:phase0 -->
