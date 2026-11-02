// clinexia-upgrade:phase10 — turns a weight into pediatric emergency sheet lines. Pure functions.
// Same rules as the resuscitation dashboard: no result without a valid weight, every cap or limit is stated, nothing is stored.
import { checkWeight, fmt, type Tone } from "../emergency/dosing"
import { isReleased } from "../clinical/review"
import { ANAPHYLAXIS, SEIZURE, SHOCK_FLUIDS, TACHYCARDIA } from "./sheets-data"

export interface SheetLine {
  id: string
  drug: string
  tone: Tone
  headline: string
  detail?: string
  route: string
  repeat: string
  notes: string[]
  sourceIds: number[]
}
export type SheetId = "tachycardia" | "shock-fluids" | "anaphylaxis" | "seizure"
export const SHEETS: Array<{ id: SheetId; title: string; intro: string }> = [
  { id: "tachycardia", title: "Tachycardia with a pulse", intro: "For a child with a fast heart rhythm and a pulse. Identify and treat the cause. Doses below are for the rhythm treatments in the AHA pediatric tachycardia algorithm. Get expert advice before extra drugs." },
  { id: "shock-fluids", title: "Shock: fluid boluses", intro: "Isotonic crystalloid in 10 or 20 mL/kg aliquots. Reassess after every bolus for improvement and for signs of fluid overload. Vasoactive infusion rates are not included here: follow your protocol." },
  { id: "anaphylaxis", title: "Anaphylaxis: intramuscular epinephrine", intro: "Intramuscular epinephrine is first-line. Give it without delay at the first signs. This is the 1 mg/mL strength, not the cardiac-arrest strength." },
  { id: "seizure", title: "Seizure lasting 5 minutes or more", intro: "After first-aid stabilization, a benzodiazepine is the first drug. Give ONE of the options below. Check glucose. Treat what you find." },
]

const q = (n: number) => Math.round(n * 1e6) / 1e6 // removes floating-point noise before a cap is compared

export type SheetResult = { ok: true; lines: SheetLine[] } | { ok: false; error: string }

function tachycardia(w: number): SheetLine[] {
  const A = TACHYCARDIA.adenosine, C = TACHYCARDIA.cardioversion, M = TACHYCARDIA.amiodarone, P = TACHYCARDIA.procainamide
  const a1 = Math.min(q(A.firstMgPerKg * w), A.firstMaxMg), a2 = Math.min(q(A.secondMgPerKg * w), A.secondMaxMg)
  return [
    { id: "tach-adenosine", drug: "Adenosine", tone: "violet", headline: `${fmt(a1)} mg first`, detail: `then ${fmt(a2)} mg if the first dose does not work`, route: "IV / IO, rapid bolus then flush", repeat: "One repeat at the higher dose", notes: [`First ${A.firstMgPerKg} mg/kg (maximum ${A.firstMaxMg} mg). Second ${A.secondMgPerKg} mg/kg (maximum ${A.secondMaxMg} mg).`, "Only for a regular rhythm with uniform (monomorphic) complexes.", ...(q(A.firstMgPerKg * w) > A.firstMaxMg ? [`First dose capped at ${A.firstMaxMg} mg.`] : []), ...(q(A.secondMgPerKg * w) > A.secondMaxMg ? [`Second dose capped at ${A.secondMaxMg} mg.`] : [])], sourceIds: [...A.sourceIds] },
    { id: "tach-cardioversion", drug: "Synchronized cardioversion", tone: "amber", headline: `${fmt(C.firstLowJPerKg * w, 1)} to ${fmt(C.firstHighJPerKg * w, 1)} J`, detail: `if not effective: ${fmt(C.secondJPerKg * w, 1)} J`, route: "Defibrillator in SYNC mode", repeat: "Increase to the second energy if the first fails", notes: [`${C.firstLowJPerKg} to ${C.firstHighJPerKg} J/kg first, then ${C.secondJPerKg} J/kg.`, "Sedate if needed, but do not delay cardioversion."], sourceIds: [...C.sourceIds] },
    { id: "tach-amiodarone", drug: "Amiodarone (second-line)", tone: "violet", headline: `${fmt(M.mgPerKg * w)} mg`, detail: `over ${M.minutesLow} to ${M.minutesHigh} minutes`, route: "IV / IO infusion", repeat: "See your protocol", notes: [`${M.mgPerKg} mg/kg. Do not routinely give with procainamide.`, "The source gives no maximum dose: check your formulary limit before giving to a large child."], sourceIds: [...M.sourceIds] },
    { id: "tach-procainamide", drug: "Procainamide (second-line)", tone: "violet", headline: `${fmt(P.mgPerKg * w)} mg`, detail: `over ${P.minutesLow} to ${P.minutesHigh} minutes`, route: "IV / IO infusion", repeat: "See your protocol", notes: [`${P.mgPerKg} mg/kg. Do not routinely give with amiodarone.`, "The source gives no maximum dose: check your formulary limit before giving to a large child."], sourceIds: [...P.sourceIds] },
  ]
}

function shockFluids(w: number): SheetLine[] {
  const F = SHOCK_FLUIDS, [lo, hi] = F.boluses
  return [{ id: "fluid-bolus", drug: "Isotonic crystalloid bolus", tone: "blue", headline: `${fmt(lo * w, 0)} to ${fmt(hi * w, 0)} mL`, detail: `${lo} mL/kg = ${fmt(lo * w, 0)} mL, ${hi} mL/kg = ${fmt(hi * w, 0)} mL`, route: "IV / IO, rapid", repeat: "Reassess after EVERY bolus before the next", notes: [`Up to ${F.maxTotalMlPerKg} mL/kg (${fmt(F.maxTotalMlPerKg * w, 0)} mL) in total if shock persists. Where intensive care is not available: up to ${F.limitedResourceMaxMlPerKg} mL/kg (${fmt(F.limitedResourceMaxMlPerKg * w, 0)} mL) in 10 to 20 mL/kg aliquots.`, "A balanced (buffered) crystalloid is preferred over 0.9% saline. Stop if signs of fluid overload appear."], sourceIds: [...F.sourceIds] }]
}

function anaphylaxis(w: number): SheetLine[] {
  const A = ANAPHYLAXIS, raw = q(A.mgPerKg * w), dose = Math.min(raw, A.maxMgChild)
  return [{ id: "ana-epi", drug: "Epinephrine 1 mg/mL (1:1000)", tone: "red", headline: `${fmt(dose, 3)} mg`, detail: `${fmt(dose / A.mgPerMl, 3)} mL of 1 mg/mL`, route: "IM, mid-outer thigh", repeat: `Every ${A.repeatMinLow} to ${A.repeatMinHigh} minutes if needed`, notes: [`${A.mgPerKg} mg/kg. Maximum ${A.maxMgChild} mg for children (${A.maxMgAdult} mg for adults).`, ...(raw > A.maxMgChild ? [`Capped at the ${A.maxMgChild} mg maximum (weight-based dose would be ${fmt(raw, 3)} mg).`] : []), "Use the 1 mg/mL strength. Do NOT use the 0.1 mg/mL cardiac-arrest strength for an IM dose."], sourceIds: [...A.sourceIds] }]
}

function seizure(w: number): SheetLine[] {
  const S = SEIZURE
  const lor = Math.min(q(S.lorazepamIv.mgPerKg * w), S.lorazepamIv.maxMg)
  const dzLo = Math.min(q(S.diazepamIv.lowMgPerKg * w), S.diazepamIv.maxMg), dzHi = Math.min(q(S.diazepamIv.highMgPerKg * w), S.diazepamIv.maxMg)
  const rLo = Math.min(q(S.diazepamRectal.lowMgPerKg * w), S.diazepamRectal.maxMg), rHi = Math.min(q(S.diazepamRectal.highMgPerKg * w), S.diazepamRectal.maxMg)
  const mid: SheetLine = w < S.midazolamIm.minKg
    ? { id: "sz-midazolam", drug: "Midazolam IM", tone: "violet", headline: "No fixed IM dose", detail: `The guideline gives IM midazolam only from ${S.midazolamIm.minKg} kg`, route: "IM", repeat: "-", notes: ["Use IV lorazepam or IV diazepam, or your hospital protocol."], sourceIds: [...S.midazolamIm.sourceIds] }
    : { id: "sz-midazolam", drug: "Midazolam IM", tone: "violet", headline: `${w <= S.midazolamIm.upToKgInclusive ? S.midazolamIm.mgSmall : S.midazolamIm.mgLarge} mg`, detail: "single fixed dose by weight band", route: "IM", repeat: "Single dose", notes: [`${S.midazolamIm.mgSmall} mg for ${S.midazolamIm.minKg} to ${S.midazolamIm.upToKgInclusive} kg; ${S.midazolamIm.mgLarge} mg above ${S.midazolamIm.upToKgInclusive} kg. Useful when there is no IV access.`], sourceIds: [...S.midazolamIm.sourceIds] }
  return [
    { id: "sz-lorazepam", drug: "Lorazepam", tone: "violet", headline: `${fmt(lor)} mg`, route: "IV", repeat: "May repeat once", notes: [`${S.lorazepamIv.mgPerKg} mg/kg, maximum ${S.lorazepamIv.maxMg} mg per dose.`, ...(q(S.lorazepamIv.mgPerKg * w) > S.lorazepamIv.maxMg ? [`Capped at the ${S.lorazepamIv.maxMg} mg maximum.`] : []), "Watch breathing and blood pressure."], sourceIds: [...S.lorazepamIv.sourceIds] },
    { id: "sz-diazepam-iv", drug: "Diazepam", tone: "violet", headline: `${fmt(dzLo)} to ${fmt(dzHi)} mg`, route: "IV", repeat: "May repeat once", notes: [`${S.diazepamIv.lowMgPerKg} to ${S.diazepamIv.highMgPerKg} mg/kg, maximum ${S.diazepamIv.maxMg} mg per dose.`, ...(q(S.diazepamIv.highMgPerKg * w) > S.diazepamIv.maxMg ? [`Capped at the ${S.diazepamIv.maxMg} mg maximum.`] : []), "Watch breathing and blood pressure."], sourceIds: [...S.diazepamIv.sourceIds] },
    mid,
    { id: "sz-diazepam-rectal", drug: "Diazepam (rectal, no IV or IM option)", tone: "violet", headline: `${fmt(rLo)} to ${fmt(rHi)} mg`, route: "Rectal", repeat: "Single dose", notes: [`${S.diazepamRectal.lowMgPerKg} to ${S.diazepamRectal.highMgPerKg} mg/kg, maximum ${S.diazepamRectal.maxMg} mg.`], sourceIds: [...S.diazepamRectal.sourceIds] },
  ]
}

export function buildSheet(id: SheetId, weightKg: number | null): SheetResult {
  const w = checkWeight("pediatric", weightKg)
  if (!w.ok) return w
  const lines = id === "tachycardia" ? tachycardia(w.weight) : id === "shock-fluids" ? shockFluids(w.weight) : id === "anaphylaxis" ? anaphylaxis(w.weight) : seizure(w.weight)
  return { ok: true, lines }
}

/** Only the sheets a clinician has approved (or all, in a preview build). */
export function releasedSheets() {
  return SHEETS.filter((s) => isReleased(`pediatric-sheets:${s.id}`))
}
