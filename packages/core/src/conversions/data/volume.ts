import type { ConversionCategory } from "../types"

export const volumeConversion: ConversionCategory = {
  id: "volume",
  name: "Volume",
  kind: "linear",
  baseUnitId: "L",
  units: [
    { id: "L", name: "Liter", symbol: "L", factor: 1 },
    { id: "dL", name: "Deciliter", symbol: "dL", factor: 0.1 },
    { id: "mL", name: "Milliliter", symbol: "mL", factor: 0.001 },
    { id: "uL", name: "Microliter", symbol: "µL", factor: 0.000001 },
    { id: "nL", name: "Nanoliter", symbol: "nL", factor: 1e-9 },
  ],
}
