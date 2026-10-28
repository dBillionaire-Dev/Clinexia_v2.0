# LIS / HL7 reference adapters

Adds **calculated results** to an HL7 v2 `ORU^R01` result message: anion gap (and albumin-corrected anion gap), albumin-corrected
calcium, Friedewald LDL, red cell indices (MCV, MCH, MCHC) and eGFR (CKD-EPI), using Clinexia's calculators.

> ## These are reference examples, not production software
> * **The laboratory must validate them against its own methods, code system, interfaces and SOPs before any result reaches a patient record.**
> * **Clinexia does not replace LIS validation.** A calculated value is only as right as the results, units, demographics and method assumptions it came from.
> * A calculation and reference aid for qualified clinicians and laboratory staff (DRAFT wording, pending legal and regulatory review). Not a diagnostic device.
> * Nothing here was run against a real LIS, a real Mirth Connect server or real patient data. The samples are synthetic.
> * Every LOINC code mentioned is **UNVERIFIED** (see `docs/integration/FINDINGS.md`).

## What is here

| Path | What |
|---|---|
| `shared/clinexia-lis.js` | The whole logic: HL7 parsing, finding the inputs, the safety rules, building the new message. Plain ES5, so it also runs in Mirth Connect. |
| `node/` | **Example A.** `adapter.mjs` (calls the shared logic with `@clinexia/core`, no network), `core-backend.mjs`, `cli.mjs`. |
| `mirth/` | **Example B.** A Mirth Connect transformer step and an API backend (calls the Clinexia API). Same shared logic. |
| `samples/` | Synthetic HL7 messages, one per behaviour. |
| `test/` | Unit tests with expected values worked out by hand (they run with the repository's `pnpm test`). |

The two examples differ only in where the arithmetic happens. The Node one runs `@clinexia/core` locally (nothing leaves your machine).
The Mirth one calls the Clinexia API with an API key and sends only numbers (the results, and for eGFR the age in years and sex): no names, no record numbers, no birth date.

## Try it (Node)

```bash
pnpm core:build                                   # once: builds @clinexia/core
node integrations/lis/node/cli.mjs integrations/lis/samples/oru-chemistry.hl7
```

It prints the new message (segments on separate lines for reading) and, to stderr, **counts and skip reasons only**, never values or identifiers.
Options: `--out FILE` (write with real HL7 `CR` separators), `--compare` (also report differences against values the analyser already sent), `--status F` (OBX-11, default `P`).

In code:

```js
import * as core from "@clinexia/core"
import { addCalculatedResults } from "./node/adapter.mjs"
const { oru, report } = addCalculatedResults(core, messageText, { resultStatus: "P", compare: false })
// oru: the new ORU^R01 text, or null when there was nothing to add.  report: what was calculated, skipped, and why.
```

## What the output message looks like

A **new** ORU^R01 that attaches to the same patient and order, containing only the calculated results:

```
MSH|^~\&|CLINEXIA_CALC||ANALYSER|LAB|20261026102000||ORU^R01^ORU_R01|CLX20261026102000|P|2.5.1
PID|...                      (copied unchanged)
ORC|...  OBR|...             (copied unchanged, so the results file under the same placer/filler order)
OBX|1|NM|CLX-AG^Anion gap (calculated)^L^33037-3^Anion gap (calculated)^LN||12|mmol/L^^UCUM|||||P|||20261026093000|CLINEXIA^Clinexia calculated results^L||CALCULATED^Calculated value, not measured^L
NTE|1|L|Calculated by Clinexia (anion-gap formula 1.0.0) from 2951-2=140 mmol/L (OBX-1); ... Not an analyser result: verify per laboratory SOP.
```

| Field | Value | Why |
|---|---|---|
| OBX-3 | a **local** code `CLX-...` (`^L`); the LOINC code, where one is known, only as the **alternate** identifier | Your LIS decides the code. Do not use the alternate LOINC codes until they are verified. |
| OBX-6 | UCUM unit | |
| OBX-11 | `P` (preliminary) by default | Conservative: the value stays preliminary until your LIS or SOP releases it. Change with `resultStatus`. |
| OBX-14 | the observation time of the inputs | |
| OBX-15 | `CLINEXIA^...^L` | says who produced it |
| OBX-17 | `CALCULATED^Calculated value, not measured^L` | the flag that marks it as calculated |
| NTE | which calculator, which **formula version**, which input results | audit trail; includes "Not an analyser result" |

The original message is never modified. Reference ranges (OBX-7) and abnormal flags (OBX-8) are left empty: Clinexia does not decide them.

## What it calculates, from which results

Inputs are found by their LOINC code (OBX-3.1 with coding system `LN`, or the alternate identifier OBX-3.4 / 3.6). If your LIS uses local codes, map them with
`localCodeMap: { "CHOL": "2093-3", ... }`.

| Calculated | Inputs (LOINC, unverified) | Output codes |
|---|---|---|
| Anion gap; albumin-corrected anion gap | Na 2951-2, Cl 2075-0, HCO3 1963-8; albumin 1751-7 (optional, for the corrected value) | `CLX-AG`, `CLX-AGALB` |
| Albumin-corrected calcium | calcium 17861-6, albumin 1751-7 | `CLX-CCA` |
| LDL, Friedewald | total cholesterol 2093-3, HDL 2085-9, triglycerides 2571-8 | `CLX-LDL` |
| MCV, MCH, MCHC | hemoglobin 718-7, hematocrit 4544-3, RBC 789-8 | `CLX-MCV`, `CLX-MCH`, `CLX-MCHC` |
| eGFR (CKD-EPI) | creatinine 2160-0, plus age and sex from the PID segment | `CLX-EGFR` |

For eGFR, age is whole years **at the time of the observation** (not today), from PID-7 and the OBX-14 / OBR-7 time; sex is PID-8 `M` or `F` only. Anything else means no eGFR.

## Unit handling

* The unit is read from **OBX-6** and passed to the same unit converter the API uses. A result in the unit a calculator expects is used as is; a different but
  convertible unit is converted (creatinine umol/L to mg/dL, hemoglobin g/L to g/dL, and so on).
* LIS spellings of the same quantity are mapped first: `10*12/L`, `10^12/L`, `T/L`, `10^6/uL` for red cells; `L/L` for hematocrit (multiplied by 100 to percent).
* **No unit, an unknown unit, or an incompatible unit means no calculation** for that calculator. Nothing is guessed or assumed.
* Friedewald LDL needs total cholesterol, HDL and triglycerides in the **same** unit (mg/dL or mmol/L); the unit is kept, and the output is in it.
* The calculated value carries the unit of its calculator (UCUM): mmol/L, mg/dL, fL, pg, g/dL, mL/min/{1.73_m2}.

## When it refuses to calculate (and says why)

Each of these skips that one calculator and records a reason; the rest of the message is still processed.

| Reason | Meaning |
|---|---|
| `missing_input:<input>` | A required result is not in the **same order** (results from different orders are never combined). |
| `status_not_final:<input>` | The result's OBX-11 is not `F` or `C` (change with `acceptStatuses`). |
| `non_numeric:<input>` | The value is not a plain number (`<0.5`, `>1000`, text). |
| `value_type_not_numeric:<input>` | OBX-2 is not `NM`. |
| `missing_unit:<input>` | OBX-6 is empty. |
| `multiple_values:<input>` | Two different values for the same result in one order (a repeat with the identical value is fine). |
| `different_times` | The inputs were observed at different times (OBX-14). |
| `mixed_units`, `unit_not_supported:<u>` | Friedewald inputs in different units, or a unit other than mg/dL or mmol/L. |
| `invalid_input:<input>/<code>` | The calculator rejected it (unknown unit, out of range, and so on). |
| `sex_not_m_or_f`, `age_not_determinable`, `no_demographics` | eGFR cannot be worked out from the PID segment. |
| `already_reported:<code>` | See below. |
| `http_<status>`, `network_error`, `backend_error` | The calculation service failed. |

## Do not double-calculate what the analyser already reports

If the message already contains a result with the code of an output (for example the anion gap, LOINC `33037-3`, or MCV `787-2`, or one of our own `CLX-` codes), **that output is not calculated or emitted**; the rest of the same panel still is
(for example MCH and MCHC when only MCV was reported). The analyser's value wins. The list of "already reported" codes per output is in the catalogue at the top of `shared/clinexia-lis.js`; add your LIS's own codes with `localCodeMap`.

The adapter also never processes its own output: a message whose sending application is `CLINEXIA_CALC` is refused, so a mis-routed channel cannot loop. **Route the calculated message to the LIS or EMR only.**

## Reconciling differences

Run with `compare: true` (CLI `--compare`) to calculate even the outputs the analyser reported, **without emitting them**, and get `report.reconciliation`: for each, the analyser value, the Clinexia value, the difference, and whether the units match.

* Differences of about the last printed digit are rounding (the analyser may round at a different step).
* Anything larger points at a **method difference**: a different formula or constants (for example another eGFR equation or a different albumin reference), a different unit or specimen, or a different input result. That is a laboratory decision to resolve, not something to fix by overwriting either value.
* Use it during validation, comparing a few hundred real results in parallel with your current method before anything is switched on.

## Mirth Connect setup (Example B)

1. **Code Template Library:** create one and add `shared/clinexia-lis.js`, then `mirth/clinexia-api-backend.js`. Make the library available to the channel.
2. **Settings > Configuration Map:** `CLINEXIA_API_BASE` (for example `https://clinexia.example.org`) and `CLINEXIA_API_KEY` (an API key with the `calculate:general` scope, created by an organisation owner or admin; never commit it).
3. **Channel:** inbound data type HL7 v2.x. Add the contents of `mirth/transformer-step.js` as a JavaScript step in the Source (or a Destination) transformer.
4. **Destination to the LIS or EMR** with the template `${calculatedOru}` and the filter `channelMap.get('calculatedOru') != null`. Do not send it back into this channel.

The step logs nothing, and the channel map holds only counts (`calcSummary`). Failures of the API (key, network, rate limit) skip the calculation; they do not fail the channel.
What was verified: the Mirth files run in a sandbox that imitates Mirth and Java, against a fake API, and produce exactly the same calculated messages as the Node example. What was **not** verified: a real Mirth engine (Rhino), its
`JSON` object, `HttpURLConnection` from Rhino, or your channel's inbound settings.

## What the laboratory has to validate (a starting list)

- [ ] The input mapping: every LOINC or local code, unit and specimen type that feeds each calculator, against your own test catalogue.
- [ ] The formulas: each calculator's formula and constants are acceptable for your population and methods (the formula version is in every note).
- [ ] The units and rounding of every calculated value against your manual or LIS-native calculation, on real historical results (use `compare`).
- [ ] The result status, code system (local code, LOINC), reference ranges, abnormal flags and display on the receiving system.
- [ ] That the receiving system accepts a separate result message that attaches to an existing order, and how corrections and re-runs are handled.
- [ ] What happens when the analyser later reports the same value, a result is corrected, or the sample is re-run.
- [ ] Downtime procedures, monitoring and who owns the interface.
- [ ] Records: this example, its version, the formula versions and the validation evidence under your quality system.

## Limits of these examples

No MLLP transport and no ACK handling (the examples read and write message text: let Mirth or your engine do the transport); one message at a time (no batch FHS/BHS framing); numeric (`NM`) results only;
HL7 2.3 to 2.8 style segments (not tested on all variants); default ASCII (no character-set handling); corrections (`OBX-11 = C`) are used as inputs but a later correction of an input does not retract an earlier calculated value.
