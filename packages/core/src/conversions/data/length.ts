import type { ConversionCategory } from "../types"

export const lengthConversion: ConversionCategory = {
  id: "length",
  name: "Length",
  kind: "linear",
  baseUnitId: "m",
  units: [
    { id: "m", name: "Meter", symbol: "m", factor: 1 },
    { id: "cm", name: "Centimeter", symbol: "cm", factor: 0.01 },
    { id: "mm", name: "Millimeter", symbol: "mm", factor: 0.001 },
    { id: "um", name: "Micrometer", symbol: "µm", factor: 0.000001 },
    { id: "nm", name: "Nanometer", symbol: "nm", factor: 1e-9 },
  ],
}
