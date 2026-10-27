import type { ConversionCategory } from "../types"

export const energyConversion: ConversionCategory = {
  id: "energy",
  name: "Energy",
  kind: "linear",
  baseUnitId: "J",
  units: [
    { id: "J", name: "Joule", symbol: "J", factor: 1 },
    { id: "kJ", name: "Kilojoule", symbol: "kJ", factor: 1000 },
    { id: "cal", name: "Calorie", symbol: "cal", factor: 4.184 },
    { id: "kcal", name: "Kilocalorie", symbol: "kcal", factor: 4184 },
  ],
}
