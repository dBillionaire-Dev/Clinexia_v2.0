import type { ConversionCategory } from "../types"

// Base unit is g/L. Mass concentration only, converting to/from molar
// concentration requires a molecular weight and is handled separately
// (see lib/conversions/molar-mass.ts).
export const concentrationConversion: ConversionCategory = {
  id: "concentration",
  name: "Mass Concentration",
  kind: "linear",
  baseUnitId: "g/L",
  units: [
    { id: "g/L", name: "Grams per liter", symbol: "g/L", factor: 1 },
    { id: "mg/L", name: "Milligrams per liter", symbol: "mg/L", factor: 0.001 },
    { id: "mg/dL", name: "Milligrams per deciliter", symbol: "mg/dL", factor: 0.01 },
    { id: "g/dL", name: "Grams per deciliter", symbol: "g/dL", factor: 10 },
    { id: "ug/mL", name: "Micrograms per milliliter", symbol: "µg/mL", factor: 0.001 },
  ],
}

export const molarConversion: ConversionCategory = {
  id: "molar",
  name: "Molar Concentration",
  kind: "linear",
  baseUnitId: "M",
  units: [
    { id: "M", name: "Molar", symbol: "M", factor: 1 },
    { id: "mM", name: "Millimolar", symbol: "mM", factor: 0.001 },
    { id: "uM", name: "Micromolar", symbol: "µM", factor: 0.000001 },
    { id: "nM", name: "Nanomolar", symbol: "nM", factor: 1e-9 },
  ],
}
