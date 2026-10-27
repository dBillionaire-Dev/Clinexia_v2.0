# Units and clinical coding (Phase 2)

Two things make Clinexia usable from other systems: it understands the units other systems send, and it says which
LOINC / UCUM / FHIR element each input and result corresponds to.

## 1. Unit normalisation (`packages/core/src/integration/normalise.ts`)

`normaliseInputs(definition, rawInputs)` accepts, per input, either a plain value or `{ "value": 88, "unit": "umol/L" }`
and returns `{ inputs, conversions, errors }`:

* `inputs`: what `definition.calculate()` expects, in the calculator's own units, as strings (the same form the web form passes).
* `conversions`: one entry per converted input, `{ id, from: { value, unit }, to: { value, unit } }`.
* `errors`: `{ id, code, message }`. Messages never contain the values you sent.

All conversions go through the existing `lib/conversions` engine (data tables, `convert()`, and the molar masses in
`molar-mass.ts`). The only addition is inch and foot, which are not in the public conversion table; they are added to a local
copy used here, so the conversion tool itself is unchanged.

| Input kind | Accepted units (besides the calculator's own) | Notes |
|---|---|---|
| Weight (declared kg, g) | kg, g, lb | `[lb_av]` also accepted |
| Height (declared cm) | cm, m, mm, in, ft | `[in_i]`, `[ft_i]` also accepted |
| Temperature | C, F, K | no registered calculator takes a temperature today |
| Creatinine, glucose, calcium, total / HDL cholesterol, triglycerides | mg/dL, g/dL, g/L, mg/L, umol/L, mmol/L | mass to molar uses the engine's molecular weights (creatinine 113.12, glucose 180.0, calcium 40.08, cholesterol 386.65, triglycerides 885.4) |
| Albumin and other mass concentrations | mg/dL, g/dL, g/L, mg/L | mass to molar is refused (no molar mass defined) |
| BUN | mg/dL, g/dL, g/L, mg/L | mmol/L is refused: urea nitrogen is not urea |
| Anything else (drug doses, counts, times) | only its own unit | other units are refused |

Rules:

* An **unknown or incompatible unit is an error**, never a guess (`unit_unknown`, `unit_mismatch`, `unit_unsupported`).
* **Required inputs are never defaulted.** A missing `sex` is an error, not `male`.
* Optional inputs left out come back as `""`, as the web form does.
* Min and max are checked **after** conversion.
* Inputs that already carry a unit select (BMI's `weightUnit` / `heightUnit`): send `{value, unit}` and the value is converted to
  the calculator's unit and the select is set to match; or send a plain value plus the select yourself. Sending both a unit
  and the select is an error (`unit_conflict`) so a value is never converted twice.
* Inputs with no fixed unit (the LDL Friedewald lipid values share one unit select) take plain values only.
* Unit spellings are case-insensitive, `u` or `µ` for micro, and UCUM spellings work (`umol/L`, `[lb_av]`, `[in_i]`, `Cel`, `a`).

Conversion factors come from the engine's molecular weights, so a result can differ from the textbook factor in the fourth
digit (88 µmol/L creatinine converts to 0.99546 mg/dL here; the 88.4 rule of thumb gives 0.99548). The existing
"Creatinine Unit Conversion" calculator uses 88.4 and was left alone.

Deep links use the same converter: `?creatinine=88&creatinine_unit=umol/L` prefills 0.99546 mg/dL.

## 2. Coding metadata (`packages/core/src/calculators/coding-metadata.ts`)

`InputDefinition` and `CalculationResult` gained optional `loinc`, `ucum` and `fhir` fields (`fhir` is
`{ resource: "Patient" | "Observation", path?, loinc? }`). The values live in one table and are merged into the registry, so
**no calculator definition or formula file was edited** and `calculate()` is the same function as before.

Covered: creatinine clearance (Cockcroft-Gault), eGFR (CKD-EPI, MDRD), BUN:creatinine ratio, BMI, BSA, ideal and adjusted body
weight, anion gap (plain and albumin-corrected), corrected calcium, corrected sodium, LDL (Friedewald), non-HDL cholesterol,
estimated osmolality, red cell indices, absolute cell count, INR, mean arterial pressure, QTc.

* Age and sex map to `Patient.birthDate` (age is derived) and `Patient.gender`, not to an Observation.
* Result coding is read with `getResultCoding(calculatorId)`; calculators do not attach it to their own results.
* Where the right LOINC code was not known, none is given (UCUM only) instead of a guess. QT interval is one such case.

### LOINC codes are UNVERIFIED

The codes were written without access to loinc.org. They all pass the LOINC check digit (a unit test enforces it), which
catches typos but not wrong meanings. Verify them before anyone depends on them:

```
node --experimental-strip-types scripts/verify-loinc.mjs path/to/Loinc.csv
```

(`Loinc.csv` is in the free "LOINC Table File (CSV)" download from loinc.org.) The script prints each code with its official name
and where it is used; read the list and fix any mismatch in `coding-metadata.ts`. Then record the outcome in
`docs/integration/FINDINGS.md`.

UCUM strings were written from the UCUM specification and were not machine validated either.
