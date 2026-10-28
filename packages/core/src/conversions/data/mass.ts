import type { ConversionCategory } from "../types"

export const massConversion: ConversionCategory = {
  id: "mass",
  name: "Mass",
  kind: "linear",
  baseUnitId: "kg",
  units: [
    { id: "kg", name: "Kilogram", symbol: "kg", factor: 1 },
    { id: "g", name: "Gram", symbol: "g", factor: 0.001 },
    { id: "mg", name: "Milligram", symbol: "mg", factor: 0.000001 },
    { id: "ug", name: "Microgram", symbol: "µg", factor: 1e-9 },
    { id: "ng", name: "Nanogram", symbol: "ng", factor: 1e-12 },
    { id: "lb", name: "Pound", symbol: "lb", factor: 0.45359237 },
    { id: "oz", name: "Ounce", symbol: "oz", factor: 0.028349523125 },
  ],
}
