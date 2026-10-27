# @clinexia/core

Clinexia's clinical calculators, unit conversions, unit normalisation and formula versions as a plain TypeScript library.
**No UI, no network, no storage.** It has no dependency on Next.js, React, Supabase, Node or the browser, and a test
(`src/core-boundary.test.ts`) fails if that ever changes. The same code runs in the web app, on a server, in an integration
engine and inside the mobile app.

> **Intended use (DRAFT, pending legal and regulatory review).** A calculation and reference aid for qualified clinicians. Verify
> every result independently. Not a diagnostic device. The library never sends, stores or logs inputs or results.

Status: version `0.1.0`, `"private": true`. **Not published.** See "Before publishing".

## What is inside

| Area | Where | Public entry exports |
|---|---|---|
| ~160 calculators (definitions, helpers, validation, safety checks) | `src/calculators/` | `calculators`, `getCalculatorById`, `searchCalculators`, types, `validateCalculatorInputBounds`, `getDosingSafetyWarnings`, `getCalculatorSafetyWarnings` |
| Formula versions | `src/calculators/versions.ts` | `FORMULA_VERSIONS`, `getFormulaVersion` |
| References and their status | `src/calculators/dosing-references.ts`, `formula-info.ts` | `getCalculatorReferences`, `getReferenceStatus`, `getFormulaInfo` |
| LOINC / UCUM / FHIR coding metadata (LOINC codes are UNVERIFIED) | `src/calculators/coding-metadata.ts` | `INPUT_CODING`, `getResultCoding`, `withCodingMetadata` |
| Unit conversions | `src/conversions/` | `conversionCategories`, `convert`, `getConversionCategory`, `analytes`, `mgdLToMmolL`, ... |
| Unit normalisation and deep-link prefill parsing | `src/integration/` | `normaliseInputs`, `resolveUnit`, `canonicalUnit`, `convertAnalyteUnits`, `parsePrefill`, `prefillUnitResolver` |
| Test vectors (second entry point) | `src/calculators/test-vectors.ts` | `@clinexia/core/vectors`: `TEST_VECTORS`, `runVectorCase`, `describeOutcome` |

The public API is `src/index.ts`. Deep imports are not supported outside the Clinexia repository.

## Use

```ts
import { getCalculatorById, normaliseInputs, getFormulaVersion } from "@clinexia/core"

const def = getCalculatorById("creatinine-clearance")!
const n = normaliseInputs(def, { age: 54, weight: 70, sex: "male", creatinine: { value: 88, unit: "umol/L" } })
if (n.errors.length) throw new Error(n.errors.map((e) => `${e.id}: ${e.message}`).join("; "))
const result = def.calculate(n.inputs)       // { value: 84, unit: "mL/min", display: "84 mL/min", ... }
const version = getFormulaVersion(def.id)    // "1.0.0"
```

`normaliseInputs` accepts plain numbers or `{ value, unit }`, converts through the conversion engine, checks ranges and
options, never defaults a required input, and refuses an unknown unit instead of guessing.

## Build

```
node packages/core/scripts/build.mjs        # or, from the repo root: pnpm core:build
```

Uses the TypeScript compiler from the repository only (no extra dependencies) and writes `dist/esm`, `dist/cjs` and
`dist/types`. `dist/` is git-ignored. To try the package in another project without publishing: run the build, then
`pnpm pack` in `packages/core` and install the tarball.

## In this repository

The web app imports the old paths (`@/lib/calculators/...`, `@/lib/conversions/...`); each is a one-line re-export of this package
(`lib/core-shims.test.ts` proves every one is the same object). Edit calculators **here**, in `packages/core/src`. The formula
versioning rules and the test-vector workflow are in `docs/integration/CHANGELOG.md`.

## Before publishing (decisions needed)

* **Licence.** `package.json` says `UNLICENSED`. Choose one; `prepublishOnly` refuses while it is a placeholder.
* Remove `"private": true` only when you decide to publish. `prepublishOnly` refuses while it is set.
* Decide the registry and scope (public npm, GitHub Packages, or a private registry).
* Medical-software positioning (intended use, regulatory review) must be settled before outside parties depend on it.
