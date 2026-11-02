<!-- clinexia-upgrade:phase8 -->
# How to approve clinical content

Everything clinical that these upgrades added is **hidden until someone qualified approves it**. Approval is a recorded decision: who, their credentials, the date and what they reviewed. Nothing is approved by default, and the tests fail if an approval is missing a name, credentials or a valid date.

## The one-command way

From the repository root:

```bash
node scripts/approve-clinical.mjs list

node scripts/approve-clinical.mjs approve has-bled:bands \
  --reviewer "Dr Full Name" --credentials "MD, Cardiology" --date 2026-11-02 \
  --scope "Band wording and sources in lib/clinical/evidence.ts, contentVersion 2026-10-25.1"

node scripts/approve-clinical.mjs revoke has-bled:bands     # hides it again
```

The command only edits the register file. The reviewer named must really have reviewed the item: the script cannot check that.

## What each key controls

| Key | Shows | Register file |
|---|---|---|
| `cha2ds2-vasc:bands`, `has-bled:bands` | Risk-category wording next to the score | `lib/clinical/review.ts` |
| `emergency-doses` | Emergency Mode button and resuscitation doses | `lib/clinical/review.ts` |
| `emergency-weight-estimation` | The "estimate weight from age" helper in Emergency Mode | `lib/clinical/review.ts` |
| `pediatric-sheets:<sheet>` | One pediatric emergency dosing sheet each | `lib/clinical/review.ts` |
| `patient:<tool id>` | The plain-language explanation for one tool | `lib/clinical/review.ts` |
| `qsofa`, `sofa`, `pecarn-head-injury-under-2`, `pecarn-head-injury-2-to-17`, `ldl-sampson`, `blood-volume-nadler-lemmens` | The calculator itself | `<calculator library>/clinical-modules/review.ts` |

## What the reviewer should look at

- **Risk bands and calculator tools:** the sources listed in `lib/clinical/evidence.ts`, the thresholds and boundaries, the intended population, the limitations. Run `node scripts/verify-evidence-links.mjs` first.
- **Emergency doses and pediatric sheets:** every number in `lib/emergency/dose-data.ts` and `lib/pediatric/sheets-data.ts` against the source named beside it, and against your hospital formulary.
- **Weight estimation:** the formulas, their age limits and the warnings. A weight estimate is a dosing input: check how wrong it can be for your patients.
- **Patient explanations:** the wording in `lib/clinical/patient-explanations.ts`. The tests check reading level and forbidden phrases, but a clinician must confirm the meaning is right and safe for your patients and your language.

## After approving a calculator tool

An approved tool joins the calculator registry, so your own integration tests apply. They will ask for its entry in `FORMULA_VERSIONS`, its test vectors and the reference-gaps document (`pnpm integration:snapshots`). That is intended.

## Trying content before approval (internal only)

Build with `NEXT_PUBLIC_CLINEXIA_PREVIEW_MODULES=1` to see bands, Emergency Mode, estimation, sheets and patient text. Preview content is labelled as pending review where it matters. Never ship a preview build to users. New calculator tools in `clinical-modules` have no preview switch because the calculator library cannot read environment variables.
