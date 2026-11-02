<!-- clinexia-upgrade:phase0 -->
# Protected paths

The upgrade scripts hash these before and after every phase and stop if any file changed. They never write to them.

Web:
- `lib/calculators/definitions/` (calculation logic, shared by both apps)
- `lib/calculators/coding-metadata.ts` and its test (LOINC / UCUM / FHIR)
- `lib/calculators/versions.ts`, `test-vectors.ts`, `test-vector-data.ts`, `test-vectors.test.ts`
- `lib/calculators/formula-info.ts`, `reference-gaps.ts`
- `lib/integration/`, `lib/api/`, `app/api/v1/`, `app/embed/`, `docs/integration/`, `supabase/`
- `scripts/update-integration-snapshots.mjs`, `scripts/verify-loinc.mjs`

Mobile:
- `lib/calculators/definitions/`

## Files the scripts edit that you may also touch

| File | Repo | Phase | Edit |
|---|---|---|---|
| `components/calculators/calculator-runner.tsx` | web | 1, 2 | stale-result clearing, validation call, guided/context/evidence blocks (embed mode is excluded from the new UI) |
| `components/calculator-runner.tsx` | mobile | 1, 2 | safety layer wiring, same UI blocks |
| `lib/calculators/registry.ts` | both | 4 | one import and `[...baseCalculators, ...getReleasedClinicalModules()]` before `.map(withDoseVolume)`; your `.map(withCodingMetadata)` is untouched |
| `public/service-worker.js` | web | 3 | install block, cache trim, offline fallback, version v6 |
| `lib/calculators/service-worker-routes.test.ts` | web | 3 | expected cache version v5 to v6 |
| `lib/search.ts` | web | 1 | adds synonyms to the searchable text |

Each edit is an exact-text anchor. If the anchor is not found exactly once, the script stops before changing anything.
<- Add tests for the self-test rules, the tap counter and the clinexia-upgrade:phase0 -->
