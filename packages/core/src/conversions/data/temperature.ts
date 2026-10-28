import type { ConversionCategory } from "../types"

// Base unit is Celsius. base = (value - offset) * factor
export const temperatureConversion: ConversionCategory = {
  id: "temperature",
  name: "Temperature",
  kind: "offset",
  baseUnitId: "C",
  units: [
    { id: "C", name: "Celsius", symbol: "°C", factor: 1, offset: 0 },
    { id: "F", name: "Fahrenheit", symbol: "°F", factor: 5 / 9, offset: 32 },
    { id: "K", name: "Kelvin", symbol: "K", factor: 1, offset: 273.15 },
  ],
}
