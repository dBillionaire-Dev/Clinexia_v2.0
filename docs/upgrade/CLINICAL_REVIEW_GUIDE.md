<!-- clinexia-upgrade:phase2 -->
# Clinical review guide

Clinexia shows two kinds of clinical content that need a qualified person's sign-off before users see them:

1. **Interpretation bands**: text such as "at or above the guideline level" next to a score.
2. **New clinical tools** (qSOFA, SOFA, PECARN, added in Phase 4).

Both are controlled by `lib/clinical/review.ts`. Everything starts as `{ status: "pending" }` and is **hidden**.
This is deliberate. No automated test can tell you a clinical statement is right.

## What the reviewer checks

For each item in `lib/clinical/evidence.ts` (and each tool under `lib/clinical/modules/`):

- [ ] Every source opens (`node scripts/verify-evidence-links.mjs`) and actually says what the app attributes to it.
- [ ] The guideline named is the current one for your users' region. If a newer guideline exists, update the source and `contentVersion`.
- [ ] Thresholds and bands match the source exactly, including boundaries (>=, >, <=).
- [ ] The intended population and "not intended for" lists are correct and complete.
- [ ] The wording does not read as a diagnosis or a treatment order.
- [ ] Limitations are accurate and sufficient.
- [ ] For tools that have it: where a published table leaves a boundary value unassigned (SOFA bilirubin 12.0, creatinine 5.0 and so on) the choice made in code is acceptable. It is stated in the tool's limitations.

## Decisions the reviewer should make explicitly

- **HAS-BLED**: the commonly quoted "score of 3 or more = high risk" cut-point is **not** in the app because it was not verified against a listed source when this was written. Add it only with a source.
- **CHA2DS2-VASc**: the app shows the 2023 ACC/AHA/ACCP/HRS thresholds (2 or more in men, 3 or more in women). The 2024 ESC guideline uses CHA2DS2-VA (no sex point). Decide whether your users follow ESC, ACC/AHA or both.
- **qSOFA**: the 2026 Surviving Sepsis Campaign guideline recommends against using it as a single screening tool. The tool says so on every result. Decide whether to release it at all.

## Releasing an item

1. In `lib/clinical/review.ts` replace the pending record, for example:

```ts
"has-bled:bands": {
  status: "approved",
  reviewer: "Full Name",
  credentials: "MD, Cardiology",
  reviewedAt: "2026-11-02",
  scope: "Band text and sources in evidence.ts at contentVersion 2026-10-25.1",
},
```

2. Run `pnpm test`. A test fails if an approved record has no reviewer, credentials or a valid date.
3. Whenever the reviewed text changes, bump `contentVersion` and get a new sign-off. Do not edit approved text silently.

## Trying unreviewed content internally

Build with `NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES=1`. Preview content is labelled "PREVIEW: pending clinical review. Not for clinical use." Never ship a preview build to users.

## Releasing a new tool (Phase 4)

The new calculator tools (qSOFA, SOFA, PECARN, Sampson LDL, blood volume) live inside the calculator library, in
`<calculator library>/clinical-modules/` (`packages/core/src/calculators/clinical-modules/` in a monorepo layout).
The library cannot read environment variables, so these tools have their **own** register: `clinical-modules/review.ts`.
Approve a tool there exactly as shown above (reviewer, credentials, date, scope). There is no preview switch for these.

Because an approved tool becomes part of the registry, your integration layer applies to it. Before or right after approving, in the web repo add:
1. its entry in `FORMULA_VERSIONS`,
2. its test vectors, and the regenerated reference-gaps document (`pnpm integration:snapshots`),
3. coding metadata if EMR clients should see it.

Run `pnpm test`: the existing tests list exactly what is missing. These are your files; the upgrade scripts never edit them.
The matching "About this result" text (sources, limits) is in `lib/clinical/evidence.ts`; the reviewer should read it too.

## Where each approval lives

| What | File |
|---|---|
| Interpretation bands (CHA2DS2-VASc, HAS-BLED) and Emergency Mode doses | `lib/clinical/review.ts` |
| New calculator tools | `<calculator library>/clinical-modules/review.ts` |
