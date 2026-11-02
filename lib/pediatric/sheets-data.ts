// clinexia-upgrade:phase10 — pediatric emergency dosing sheets beyond resuscitation. THIS FILE IS WHAT A REVIEWER SIGNS OFF.
//
// Every number was read from the sources below (index in the comments). Where sources give no maximum, none is shown and the
// line says so. Deliberately NOT included, because no guideline-level source was verified: hypoglycemia (dextrose),
// vasoactive infusion rates (published ranges disagree), routine analgesic/antipyretic and antibiotic doses (they depend on
// the national formulary). Add those only with your own formulary and a named source.
// Do not change a number without re-reading its source and bumping SHEETS_DATA_VERSION.

export const SHEETS_DATA_VERSION = "2026-10-29.1"

export interface SheetSource { title: string; citation: string; url: string }

export const SHEET_SOURCES: SheetSource[] = [
  { title: "AHA Pediatric Tachycardia With a Pulse Algorithm", citation: "American Heart Association. Doses and details for adenosine, synchronized cardioversion, amiodarone and procainamide. (2020 edition of the algorithm; the reviewer should confirm against the current 2025 figure.)", url: "https://cpr.heart.org/-/media/CPR-Files/CPR-Guidelines-Files/Algorithms/AlgorithmPALS_Tachycardia_200618.pdf" }, // 0
  { title: "2025 AHA/AAP Part 8: Pediatric Advanced Life Support", citation: "Circulation. 2025;152(suppl 2):S479-S537. Cardioversion energies; septic shock fluid in 10 mL/kg or 20 mL/kg aliquots with reassessment after every bolus.", url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/pediatric-advanced-life-support" }, // 1
  { title: "American Red Cross PALS 2025 reference card: pediatric septic shock", citation: "Balanced crystalloid preferred over 0.9% saline; repeat to a maximum of 60 mL/kg; up to 40 mL/kg where intensive care is not available.", url: "https://guidelines.redcross.org/wp-content/uploads/2025/12/PALS-Pediatric-Septic-Shock.pdf" }, // 2
  { title: "Anaphylaxis: a 2023 practice parameter update", citation: "Ann Allergy Asthma Immunol. Epinephrine 0.01 mg/kg of 1 mg/mL IM; maximum 0.3 mg for children, 0.5 mg for adults.", url: "https://www.annallergy.org/article/S1081-1206(23)01304-2/fulltext" }, // 3
  { title: "CSACI position statement: epinephrine auto-injectors and children under 15 kg", citation: "States the 0.01 mg/kg dose and that it can be repeated every 5 to 15 minutes as clinically indicated.", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4485331/" }, // 4
  { title: "AES evidence-based guideline: treatment of convulsive status epilepticus in children and adults", citation: "Glauser T, et al. Epilepsy Curr. 2016;16(1):48-61.", url: "https://doi.org/10.5698/1535-7597-16.1.48" }, // 5
]

export const TACHYCARDIA = {
  adenosine: { firstMgPerKg: 0.1, firstMaxMg: 6, secondMgPerKg: 0.2, secondMaxMg: 12, sourceIds: [0] },
  cardioversion: { firstLowJPerKg: 0.5, firstHighJPerKg: 1, secondJPerKg: 2, sourceIds: [0, 1] },
  amiodarone: { mgPerKg: 5, minutesLow: 20, minutesHigh: 60, sourceIds: [0] },
  procainamide: { mgPerKg: 15, minutesLow: 30, minutesHigh: 60, sourceIds: [0] },
} as const

export const SHOCK_FLUIDS = { boluses: [10, 20], maxTotalMlPerKg: 60, limitedResourceMaxMlPerKg: 40, sourceIds: [1, 2] } as const

export const ANAPHYLAXIS = { mgPerKg: 0.01, maxMgChild: 0.3, maxMgAdult: 0.5, mgPerMl: 1, repeatMinLow: 5, repeatMinHigh: 15, sourceIds: [3, 4] } as const

export const SEIZURE = {
  lorazepamIv: { mgPerKg: 0.1, maxMg: 4, sourceIds: [5] },
  diazepamIv: { lowMgPerKg: 0.15, highMgPerKg: 0.2, maxMg: 10, sourceIds: [5] },
  midazolamIm: { minKg: 13, upToKgInclusive: 40, mgSmall: 5, mgLarge: 10, sourceIds: [5] }, // 5 mg for 13-40 kg, 10 mg above 40 kg
  diazepamRectal: { lowMgPerKg: 0.2, highMgPerKg: 0.5, maxMg: 20, sourceIds: [5] },
} as const
