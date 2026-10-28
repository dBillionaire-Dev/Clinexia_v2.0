# Intended use and limitations

> **DRAFT. Not approved. For legal and regulatory review.**
> This is a starting text written by the engineering side, not legal advice. Whether Clinexia is regulated as medical device software, and under which rules,
> depends on the claims made, the markets sold into and the people using it. Have it reviewed by a qualified person before any partner, hospital or laboratory relies on it,
> and before it is quoted in contracts, registrations or marketing.

## The short line shown in the product

The embedded calculator, the developer page and the API responses carry this line (it is one constant in `lib/integration/constants.ts`):

> Calculation and reference aid for qualified clinicians. Verify every result independently. Not a diagnostic device and not a substitute for clinical judgement.

## Intended use (draft)

Clinexia provides clinical calculators and unit conversions that apply published formulas to numbers supplied by the user or by a connected system, and shows the result,
the formula version and its references. It is intended to **support** qualified healthcare professionals and laboratory staff, who remain responsible for checking the inputs,
the result and its suitability for the patient in front of them.

## Intended users

Qualified clinicians, pharmacists, nurses and laboratory professionals; software that presents results to them for checking.

## Intended environments

Clinical and laboratory work, teaching and reference. Through an integration, inside an EMR, a laboratory information system or another clinical application operated by a healthcare organisation.

## What it is not

* **Not a diagnostic device.** It does not diagnose, screen, monitor or predict, and does not recommend a treatment.
* **Not a substitute for clinical judgement**, local protocols, the product label or a pharmacist's check.
* **Not an emergency tool.** Do not use it where a delay to look something up could harm a patient.
* **Not a medical record, a laboratory information system or a validated analyser.** It stores no patient data and does not replace validation of a laboratory's own methods.
* **Not a source of results to file automatically.** A calculated value written back into a record should be reviewed (by the clinician or under the laboratory's SOP) first.

## Limitations the user should know

* A result is only as good as its inputs: the right patient, the right unit, a current measurement, a method the formula was derived for.
* Each formula has its own population, range and assumptions. The input limits built into each calculator and the notes on each calculator page apply.
* Calculators show a **reference status** (`current`, `supporting`, `review-needed`). `supporting` means the reference supports the method; it is not a statement that the method is the newest. `docs/integration/reference-gaps.md` lists what needs review.
* **Drug-dosing and oncology calculators are higher risk.** They are available to API users only by an explicit grant, and never through the SMART launcher or the LIS adapters. They produce a calculation to be checked against the product label and local protocol, never an order.
* Unit conversions use stated molecular weights and may differ from rounded textbook factors in the last digits.
* Formula versions change over time (`CHANGELOG.md`). A number produced by one version may differ from another's.
* Values read from a patient record (SMART) can be old. The age of each is shown and flagged when beyond a configurable limit; the clinician decides whether it is still current.
* Calculated laboratory values added by an adapter are marked as calculated and preliminary by default, and must be validated by the laboratory.

## What an integrator must do

1. Show the intended-use line and the disclaimer wherever a result is shown to a person (the embed view does this automatically).
2. Show the **formula version** and, where values come from a record, **where each input came from and how old it is**. Never hide a warning the calculator returns.
3. Make a clinician (or the laboratory's release step) check calculated values before they enter a record or drive care. Do not auto-act on a result.
4. **Send no identifiers.** Names, record numbers and dates of birth are never needed by a formula (`no-phi-by-design.md`).
5. Keep API keys on servers only; keep dosing access to the minimum number of keys that need it.
6. Pin the formula version you validated against, read the changelog before upgrading, and re-validate when it changes.
7. Validate the integration in your own environment against your own methods. These documents and the examples are not a validation.

## Open points for the reviewer

* Is the product, in each integration, medical device software in the intended markets, and if so which class and which route?
* Wording of this statement, of the disclaimer, and of terms of use and privacy text for the API, the SMART launcher and the CDS service.
* Whether dosing and oncology calculators should be offered to third parties at all, and under what agreement.
* Whether the intended-use line must appear in API responses and card text exactly as it does now.
* Record-keeping and post-market duties if the product is regulated (complaints, change control for formula versions, incident reporting).
