import type { ConversionCategory } from "../types"

export const pressureConversion: ConversionCategory = {
  id: "pressure",
  name: "Pressure",
  kind: "linear",
  baseUnitId: "Pa",
  units: [
    { id: "Pa", name: "Pascal", symbol: "Pa", factor: 1 },
    { id: "kPa", name: "Kilopascal", symbol: "kPa", factor: 1000 },
    { id: "mmHg", name: "Millimeters of mercury", symbol: "mmHg", factor: 133.322387415 },
    { id: "cmH2O", name: "Centimeters of water", symbol: "cmH₂O", factor: 98.0665 },
    { id: "bar", name: "Bar", symbol: "bar", factor: 100000 },
    { id: "atm", name: "Atmosphere", symbol: "atm", factor: 101325 },
  ],
}
