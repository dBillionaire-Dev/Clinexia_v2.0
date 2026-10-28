# Moving the mobile app to @clinexia/core

The Capacitor mobile app lives in another repository that this work could not see, so everything below is written from the web
repository's side. **Nothing here has been run against the mobile repo.** Check each step against it.

## Why

Today the mobile app carries its own copy of the calculators. Two copies drift: a fixed formula or a changed default reaches one
and not the other. `@clinexia/core` is the single source (`packages/core` in the web repo). The mobile app should depend on it
instead of copying files.

## Step 0: measure the drift first (nothing changes)

From the web repo root, point the script at the mobile repo's folder that corresponds to `lib/calculators` (the one that contains
`registry.ts`, `types.ts` and `definitions/`), and optionally the one for `lib/conversions`:

```bash
node scripts/check-formula-drift.mjs ../clinexia-mobile/src/lib/calculators --conversions ../clinexia-mobile/src/lib/conversions
# or:  pnpm drift:check ../clinexia-mobile/src/lib/calculators
```

It lists every file that is identical, differs (with the first differing line), exists only in the web repo, or only in the mobile
copy. Useful flags: `--ignore-imports` (ignore single-line import/export-from lines when the mobile copy uses different import
paths) and `--json`. Exit code 0 means no drift, 1 means drift found.

Read every DIFFERS entry before migrating. A difference is not automatically a bug in the mobile copy: the web version may be
the one that is wrong. Any suspected formula error goes into `docs/integration/FINDINGS.md`, not into a silent edit of either side.

Files that exist only in the mobile copy are either mobile-specific code that must stay in the app, or calculators missing from the
web. Decide each case.

## Step 1: get the package into the mobile repo

The package is not published. Pick one while it stays private:

* **Tarball (simplest):** in the web repo run `pnpm core:build`, then `cd packages/core && pnpm pack`. In the mobile repo:
  `pnpm add ../clinexia-v2.0/packages/core/clinexia-core-0.1.0.tgz`.
* **Workspace / monorepo:** move both apps into one pnpm workspace and depend on `"@clinexia/core": "workspace:*"`. Cleanest, biggest change.
* **Private registry:** publish to GitHub Packages or a private npm registry once the licence decision is made (see `packages/core/README.md`).

Pin an exact version in the mobile app. Calculator behaviour must only change when someone updates that pin on purpose.

## Step 2: replace the copy

1. Replace every import of the mobile copy with the package:
   `import { calculators, getCalculatorById } from "@clinexia/core"`. The public entry is `src/index.ts`; it exports the registry,
   types, versions, references, coding metadata, conversions and `normaliseInputs`.
2. Delete the mobile `calculators` (and `conversions`) folder.
3. The package is plain ES modules with a CommonJS build and type declarations. Vite, webpack and the Capacitor tooling bundle it
   without configuration. It needs no polyfills: no `fs`, no network, no storage.
4. Keep mobile-only code (UI, offline storage, history) in the app; it should call the package, never copy it.

## Step 3: prove the behaviour is the same

The package ships the web repo's test vectors: for every calculator, the inputs and the exact recorded results. Run them in the
mobile app's test runner against the mobile build:

```ts
import { calculators } from "@clinexia/core"
import { TEST_VECTORS, describeOutcome, runVectorCase } from "@clinexia/core/vectors"

for (const def of calculators) {
  for (const c of TEST_VECTORS[def.id].cases) {
    expect(describeOutcome(runVectorCase(def, c.inputs))).toBe(c.display)
  }
}
```

This fails if anything in the mobile app changes a result (for example a wrapper that rounds, or a different Node/WebView number
formatting). To also run it against a copy you have NOT migrated yet, import that copy's registry instead of `@clinexia/core`'s
`calculators`: the vectors do not care where the definitions come from.

## Step 4: keep it from drifting again

* Add a CI step in the mobile repo that runs the vector test above.
* Update the pinned `@clinexia/core` version deliberately. Read `docs/integration/CHANGELOG.md` for what each formula version change means.
* Never edit calculator source in the mobile repo. Change it in the web repo (`packages/core/src`), bump the formula version, regenerate
  the vectors (`pnpm integration:snapshots`), release a new package version, update the mobile pin.

## Things to check in the mobile repo (not verifiable from here)

* Whether it imports the calculators through a path alias that needs to be changed.
* Whether any calculator was edited in the mobile copy on purpose (the drift report shows it).
* How the app calls the web API today (`lib/billing/cors.ts` lists the allowed mobile origins) and whether it should call the
  public API or use the package locally; the package works offline, the API does not.
* Android and iOS WebView support for the JavaScript syntax the package emits (it targets ES2020).
