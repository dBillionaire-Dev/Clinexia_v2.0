# Formula changelog

Every calculator has a formula version in `lib/calculators/versions.ts` (semver, all start at `1.0.0`). The API and the embed
`postMessage` result carry it, so a partner can tell exactly which behaviour produced a number.

## What counts as a change, and the bump it needs

| Change | Bump |
|---|---|
| Results change for the same inputs (formula, constant, rounding, default, validation range, branch logic) | **major** (e.g. 1.0.0 to 2.0.0) |
| New optional input, new secondary output or warning, results unchanged for existing inputs | **minor** |
| Wording only (interpretation text, notes, labels) with the same numbers | **patch** |

Any change to a calculator's output, including wording, changes its test-vector hash and **fails the build until the version is
bumped**. That is deliberate: partners compare versions.

## How to change a calculator on purpose

1. Make the change.
2. `pnpm test` fails with "Behaviour of these calculators changed but their version did not".
3. Bump the version in `lib/calculators/versions.ts`.
4. `pnpm integration:snapshots` (regenerates `lib/calculators/test-vector-data.ts` and `docs/integration/reference-gaps.md`).
5. Review the diff of `test-vector-data.ts`: only the calculators you meant to change should differ.
6. Add an entry below, then commit all of it together.

A calculator with no version, or a version bump with stale vectors, also fails the tests. A new calculator needs a version
(start at `1.0.0`) and vectors (step 4).

## What the test vectors are, and are not

For each calculator the tests run 2 or 3 input sets (chosen by `buildVectorInputs` in `lib/calculators/test-vectors.ts`, or by
`VECTOR_OVERRIDES` where the generic choice does not work) with "today" fixed to 1 June 2026 and en-US number formatting, and compare a
hash of the full results. The expected values were produced by running the calculators as they were on the day the baseline was
taken. They detect **change**. They are not proof of correctness: nobody has clinically reviewed these particular input sets.
For high-risk (dosing, oncology) calculators a clinical reviewer should add hand-picked cases with known-correct answers.

## Log

### 1.0.0 - baseline (all calculators)

Baseline versions recorded for every calculator in the registry; test vectors generated from current behaviour. No formula,
rounding or default was changed to produce this baseline.
