export interface Analyte {
  id: string
  name: string
  molecularWeight: number // g/mol
}

export const analytes: Analyte[] = [
  { id: "glucose", name: "Glucose", molecularWeight: 180.0 },
  { id: "urea", name: "Urea", molecularWeight: 60.06 },
  { id: "creatinine", name: "Creatinine", molecularWeight: 113.12 },
  { id: "cholesterol", name: "Cholesterol", molecularWeight: 386.65 },
  { id: "triglycerides", name: "Triglycerides (avg.)", molecularWeight: 885.4 },
  { id: "bilirubin", name: "Bilirubin", molecularWeight: 584.66 },
  { id: "uric-acid", name: "Uric acid", molecularWeight: 168.11 },
  { id: "sodium", name: "Sodium", molecularWeight: 22.99 },
  { id: "potassium", name: "Potassium", molecularWeight: 39.1 },
  { id: "calcium", name: "Calcium", molecularWeight: 40.08 },
  { id: "magnesium", name: "Magnesium", molecularWeight: 24.31 },
  { id: "phosphate", name: "Phosphate", molecularWeight: 94.97 },
]

export function getAnalyte(id: string): Analyte | undefined {
  return analytes.find((a) => a.id === id)
}

/** mg/dL -> mmol/L, given a molecular weight in g/mol. */
export function mgdLToMmolL(mgdL: number, molecularWeight: number): number {
  if (molecularWeight <= 0) throw new Error("Molecular weight must be greater than zero")
  // mg/dL -> g/L: x0.01. g/L / (g/mol) = mol/L. x1000 -> mmol/L
  return ((mgdL * 0.01) / molecularWeight) * 1000
}

/** mmol/L -> mg/dL, given a molecular weight in g/mol. */
export function mmolLToMgdL(mmolL: number, molecularWeight: number): number {
  if (molecularWeight <= 0) throw new Error("Molecular weight must be greater than zero")
  const molL = mmolL / 1000
  const gL = molL * molecularWeight
  return gL / 0.01
}
