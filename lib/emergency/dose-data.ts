// clinexia-upgrade:phase6 — emergency dose constants. THIS FILE IS WHAT A CLINICAL REVIEWER SIGNS OFF.
//
// Every number below was read from the AHA 2025 algorithms or guideline text named in EMERGENCY_SOURCES (index in
// comments). Do not change a number without re-reading the source and bumping DOSE_DATA_VERSION.
// Items the sources do not state (for example vial concentrations for amiodarone and atropine) are deliberately
// absent: the app shows mg only, and tells the user to check the vial.

export const DOSE_DATA_VERSION = "2026-10-26.1"

export interface EmergencySource {
  title: string
  citation: string
  url: string
}

export const EMERGENCY_SOURCES: EmergencySource[] = [
  { title: "AHA 2025 Pediatric Cardiac Arrest Algorithm", citation: "American Heart Association. Pediatric Cardiac Arrest Algorithm, 2025 Guidelines for CPR and ECC.", url: "https://cpr.heart.org/-/media/CPR-Files/CPR-Guidelines-Files/2025-Algorithms/Algorithm-PALS-CA-250123.pdf?sc_lang=en" }, // 0
  { title: "AHA 2025 Pediatric Bradycardia With a Pulse Algorithm", citation: "American Heart Association. Pediatric Bradycardia With a Pulse Algorithm, 2025 Guidelines for CPR and ECC.", url: "https://cpr.heart.org/-/media/CPR-Files/CPR-Guidelines-Files/2025-Algorithms/Algorithm-PALS-Bradycardia-250121.pdf?sc_lang=en" }, // 1
  { title: "AHA 2025 Adult Cardiac Arrest Circular Algorithm", citation: "American Heart Association. Adult Cardiac Arrest Circular Algorithm, 2025 Guidelines for CPR and ECC.", url: "https://cpr.heart.org/-/media/CPR-Files/CPR-Guidelines-Files/2025-Algorithms/Algorithm-ACLS-CA-Circular-250620.pdf?sc_lang=en" }, // 2
  { title: "2025 AHA Part 9: Adult Advanced Life Support", citation: "Wigginton JG, et al. Circulation. 2025;152(suppl 2):S538-S577.", url: "https://doi.org/10.1161/CIR.0000000000001376" }, // 3
  { title: "2025 AHA/AAP Part 5: Neonatal Resuscitation", citation: "American Heart Association and American Academy of Pediatrics. 2025 Guidelines for CPR and ECC, Part 5: Neonatal Resuscitation.", url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/neonatal-resuscitation" }, // 4
]

/** Pediatric: sources 0 (arrest) and 1 (bradycardia). */
export const PEDIATRIC = {
  epinephrine: { mgPerKg: 0.01, maxMg: 1, mgPerMl: 0.1, repeat: "Every 3 to 5 minutes", sourceIds: [0] }, // 0.01 mg/kg of 0.1 mg/mL, max 1 mg
  amiodarone: { mgPerKg: 5, maxFirstMg: 300, maxLaterMg: 150, maxDoses: 3, sourceIds: [0] }, // 5 mg/kg (max 300), up to 3 doses (max 150 mg subsequent)
  lidocaine: { mgPerKg: 1, sourceIds: [0] }, // alternative to amiodarone
  atropine: { mgPerKg: 0.02, minMg: 0.1, maxSingleMg: 0.5, repeatText: "May repeat once", sourceIds: [1] }, // bradycardia only
  defibrillation: { firstJPerKg: 2, secondJPerKg: 4, laterMinJPerKg: 4, maxJPerKg: 10, sourceIds: [0] }, // "maximum 10 J/kg or adult dose"
} as const

/** Adult: sources 2 and 3. Fixed doses; lidocaine alone is weight-based. */
export const ADULT = {
  epinephrine: { mg: 1, repeat: "Every 3 to 5 minutes", sourceIds: [2, 3] },
  amiodarone: { firstMg: 300, secondMg: 150, sourceIds: [2] },
  lidocaine: { firstLowMgPerKg: 1, firstHighMgPerKg: 1.5, secondLowMgPerKg: 0.5, secondHighMgPerKg: 0.75, sourceIds: [2] },
  // Bradycardia: dose as printed on the AHA 2025 adult bradycardia algorithm card; confirm against the official PDF at review.
  atropine: { mg: 1, repeat: "Every 3 to 5 minutes", maxTotalMg: 3, sourceIds: [3] },
} as const

/** Neonate: source 4. Epinephrine is the only resuscitation medication in the neonatal guideline. */
export const NEONATE = {
  epinephrineIv: { lowMgPerKg: 0.01, highMgPerKg: 0.03, mgPerMl: 0.1, repeat: "Every 3 to 5 minutes if heart rate stays below 60/min", sourceIds: [4] },
  // The Neonatal Resuscitation Program starts at 0.02 mg/kg inside the guideline range. Reviewer: confirm this wording.
  startMgPerKg: 0.02,
  epinephrineEt: { lowMgPerKg: 0.05, highMgPerKg: 0.1, mgPerMl: 0.1, sourceIds: [4] },
} as const

export const WEIGHT_LIMITS = {
  neonate: { min: 0.3, max: 10, sliderMin: 0.5, sliderMax: 6, step: 0.1, start: 3.5 },
  pediatric: { min: 2, max: 150, sliderMin: 3, sliderMax: 80, step: 0.5, start: 20 },
  adult: { min: 30, max: 400, sliderMin: 40, sliderMax: 150, step: 1, start: 70 },
} as const
