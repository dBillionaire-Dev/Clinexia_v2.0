// clinexia-upgrade:phase6 — turns a weight and an age group into dose lines. Pure functions, no browser access.
// Rules: no result without a valid weight (never a default); a cap or minimum is always said out loud;
// nothing here estimates a weight; nothing is stored.

import { ADULT, NEONATE, PEDIATRIC, WEIGHT_LIMITS } from "./dose-data"

export type AgeGroup = "neonate" | "pediatric" | "adult"
export const AGE_GROUP_LABEL: Record<AgeGroup, string> = { neonate: "Neonate", pediatric: "Pediatric", adult: "Adult" }
export type Section = "Cardiac arrest" | "Bradycardia with a pulse" | "Defibrillation"
export type Tone = "red" | "violet" | "blue" | "amber"

export interface DoseLine {
  id: string
  section: Section
  drug: string
  tone: Tone
  /** The number to read first, for example "0.2 mg". */
  headline: string
  /** Volume or second line, for example "2 mL of 0.1 mg/mL". */
  detail?: string
  route: string
  repeat: string
  notes: string[]
  sourceIds: number[]
}

export type Dashboard = { ok: true; lines: DoseLine[]; warnings: string[] } | { ok: false; error: string }

const r = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp
/** 0.2 -> "0.2", 1 -> "1", 0.060000001 -> "0.06". */
export const fmt = (n: number, dp = 3) => String(r(n, dp))

export function checkWeight(group: AgeGroup, weightKg: number | null): { ok: true; weight: number } | { ok: false; error: string } {
  const lim = WEIGHT_LIMITS[group]
  if (weightKg === null || !Number.isFinite(weightKg)) return { ok: false, error: "Enter the patient's weight in kg." }
  if (weightKg < lim.min || weightKg > lim.max) return { ok: false, error: `A weight of ${fmt(weightKg, 2)} kg is outside the ${AGE_GROUP_LABEL[group].toLowerCase()} range (${lim.min} to ${lim.max} kg). Check the weight or the age group.` }
  return { ok: true, weight: weightKg }
}

function pediatricLines(w: number): DoseLine[] {
  const P = PEDIATRIC
  const epiRaw = P.epinephrine.mgPerKg * w
  const epi = Math.min(epiRaw, P.epinephrine.maxMg)
  const epiCapped = epiRaw > P.epinephrine.maxMg
  const amioRaw = P.amiodarone.mgPerKg * w
  const amioFirst = Math.min(amioRaw, P.amiodarone.maxFirstMg)
  const amioLater = Math.min(amioRaw, P.amiodarone.maxLaterMg)
  const atroRaw = P.atropine.mgPerKg * w
  const atro = Math.min(Math.max(atroRaw, P.atropine.minMg), P.atropine.maxSingleMg)
  const defib = P.defibrillation
  return [
    { id: "ped-epi", section: "Cardiac arrest", drug: "Epinephrine", tone: "red", headline: `${fmt(epi)} mg`, detail: `${fmt(epi / P.epinephrine.mgPerMl, 2)} mL of 0.1 mg/mL (1 mg per 10 mL)`, route: "IV / IO", repeat: P.epinephrine.repeat, notes: [`${P.epinephrine.mgPerKg} mg/kg, maximum ${P.epinephrine.maxMg} mg.`, ...(epiCapped ? [`Capped at the ${P.epinephrine.maxMg} mg maximum (weight-based dose would be ${fmt(epiRaw)} mg).`] : [])], sourceIds: [...P.epinephrine.sourceIds] },
    { id: "ped-amio", section: "Cardiac arrest", drug: "Amiodarone", tone: "violet", headline: `${fmt(amioFirst)} mg`, detail: `Repeat doses: ${fmt(amioLater)} mg`, route: "IV / IO bolus", repeat: `May repeat up to ${P.amiodarone.maxDoses} doses in total`, notes: ["For shock-refractory VF or pulseless VT.", `${P.amiodarone.mgPerKg} mg/kg; first dose maximum ${P.amiodarone.maxFirstMg} mg, later doses maximum ${P.amiodarone.maxLaterMg} mg.`, ...(amioRaw > P.amiodarone.maxFirstMg ? [`Capped at the ${P.amiodarone.maxFirstMg} mg maximum.`] : []), "Check the vial concentration before drawing up."], sourceIds: [...P.amiodarone.sourceIds] },
    { id: "ped-lido", section: "Cardiac arrest", drug: "Lidocaine (alternative to amiodarone)", tone: "violet", headline: `${fmt(P.lidocaine.mgPerKg * w)} mg`, route: "IV / IO", repeat: "See local protocol", notes: [`${P.lidocaine.mgPerKg} mg/kg. Use either amiodarone or lidocaine.`, "Check the vial concentration before drawing up."], sourceIds: [...P.lidocaine.sourceIds] },
    { id: "ped-defib", section: "Defibrillation", drug: "Shock energy", tone: "amber", headline: `${fmt(defib.firstJPerKg * w, 1)} J first`, detail: `${fmt(defib.secondJPerKg * w, 1)} J second; then at least ${fmt(defib.laterMinJPerKg * w, 1)} J`, route: "Defibrillator", repeat: `Maximum ${defib.maxJPerKg} J/kg (${fmt(defib.maxJPerKg * w, 0)} J) or the adult dose`, notes: [`First ${defib.firstJPerKg} J/kg, second ${defib.secondJPerKg} J/kg, later at least ${defib.laterMinJPerKg} J/kg.`], sourceIds: [...defib.sourceIds] },
    { id: "ped-atro", section: "Bradycardia with a pulse", drug: "Atropine", tone: "blue", headline: `${fmt(atro)} mg`, route: "IV / IO", repeat: P.atropine.repeatText, notes: ["Not a cardiac arrest drug. For bradycardia with a pulse from increased vagal tone or primary AV block.", `${P.atropine.mgPerKg} mg/kg, minimum ${P.atropine.minMg} mg, maximum single dose ${P.atropine.maxSingleMg} mg.`, ...(atroRaw < P.atropine.minMg ? [`Raised to the ${P.atropine.minMg} mg minimum (weight-based dose would be ${fmt(atroRaw)} mg).`] : []), ...(atroRaw > P.atropine.maxSingleMg ? [`Capped at the ${P.atropine.maxSingleMg} mg maximum.`] : []), "Check the vial concentration before drawing up."], sourceIds: [...P.atropine.sourceIds] },
  ]
}

function neonateLines(w: number): DoseLine[] {
  const iv = NEONATE.epinephrineIv, et = NEONATE.epinephrineEt
  const lo = iv.lowMgPerKg * w, hi = iv.highMgPerKg * w, start = NEONATE.startMgPerKg * w
  return [
    { id: "neo-epi-iv", section: "Cardiac arrest", drug: "Epinephrine (IV or IO)", tone: "red", headline: `${fmt(lo)} to ${fmt(hi)} mg`, detail: `${fmt(lo / iv.mgPerMl, 2)} to ${fmt(hi / iv.mgPerMl, 2)} mL of 0.1 mg/mL (1 mg per 10 mL). Starting dose ${fmt(start)} mg = ${fmt(start / iv.mgPerMl, 2)} mL`, route: "Umbilical venous catheter or IO, then flush", repeat: iv.repeat, notes: [`${iv.lowMgPerKg} to ${iv.highMgPerKg} mg/kg. Intravascular is preferred.`, "Use the 0.1 mg/mL concentration only. Never give 1 mg/mL to a neonate."], sourceIds: [...iv.sourceIds] },
    { id: "neo-epi-et", section: "Cardiac arrest", drug: "Epinephrine (endotracheal, only while access is obtained)", tone: "red", headline: `${fmt(et.lowMgPerKg * w)} to ${fmt(et.highMgPerKg * w)} mg`, detail: `${fmt((et.lowMgPerKg * w) / et.mgPerMl, 2)} to ${fmt((et.highMgPerKg * w) / et.mgPerMl, 2)} mL of 0.1 mg/mL`, route: "Endotracheal tube", repeat: "Switch to intravascular as soon as access is available", notes: [`${et.lowMgPerKg} to ${et.highMgPerKg} mg/kg. Higher than the intravascular dose.`], sourceIds: [...et.sourceIds] },
  ]
}

function adultLines(w: number | null): DoseLine[] {
  const A = ADULT
  const lines: DoseLine[] = [
    { id: "adult-epi", section: "Cardiac arrest", drug: "Epinephrine", tone: "red", headline: `${A.epinephrine.mg} mg`, route: "IV / IO", repeat: A.epinephrine.repeat, notes: ["Fixed dose, not weight-based. Check the vial concentration before drawing up."], sourceIds: [...A.epinephrine.sourceIds] },
    { id: "adult-amio", section: "Cardiac arrest", drug: "Amiodarone", tone: "violet", headline: `${A.amiodarone.firstMg} mg first`, detail: `then ${A.amiodarone.secondMg} mg`, route: "IV / IO bolus", repeat: "Second dose if VF or pulseless VT persists", notes: ["For refractory VF or pulseless VT. Lidocaine is an alternative."], sourceIds: [...A.amiodarone.sourceIds] },
    { id: "adult-atro", section: "Bradycardia with a pulse", drug: "Atropine", tone: "blue", headline: `${A.atropine.mg} mg`, route: "IV", repeat: `${A.atropine.repeat}; maximum total ${A.atropine.maxTotalMg} mg`, notes: ["Not a cardiac arrest drug. First-line for symptomatic bradycardia with a pulse."], sourceIds: [...A.atropine.sourceIds] },
  ]
  if (w !== null) {
    const L = A.lidocaine
    lines.splice(2, 0, { id: "adult-lido", section: "Cardiac arrest", drug: "Lidocaine (alternative to amiodarone)", tone: "violet", headline: `${fmt(L.firstLowMgPerKg * w)} to ${fmt(L.firstHighMgPerKg * w)} mg first`, detail: `then ${fmt(L.secondLowMgPerKg * w)} to ${fmt(L.secondHighMgPerKg * w)} mg`, route: "IV / IO", repeat: "Second dose if VF or pulseless VT persists", notes: [`First ${L.firstLowMgPerKg} to ${L.firstHighMgPerKg} mg/kg; second ${L.secondLowMgPerKg} to ${L.secondHighMgPerKg} mg/kg.`], sourceIds: [...L.sourceIds] })
  }
  return lines
}

export function buildDashboard(group: AgeGroup, weightKg: number | null): Dashboard {
  if (group === "adult" && weightKg === null) return { ok: true, lines: adultLines(null), warnings: ["Enter a weight to see weight-based lidocaine doses."] }
  const w = checkWeight(group, weightKg)
  if (!w.ok) return w
  const lines = group === "pediatric" ? pediatricLines(w.weight) : group === "neonate" ? neonateLines(w.weight) : adultLines(w.weight)
  const warnings = [
    group === "neonate" ? "In neonatal resuscitation epinephrine is the only medication in the guideline. Amiodarone and atropine are not part of it." : "",
    "Use a measured or length-based weight where you can. This app does not estimate weight.",
  ].filter(Boolean)
  return { ok: true, lines, warnings }
}
