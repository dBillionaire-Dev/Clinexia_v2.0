import type { ConversionCategory } from "../types"

export const timeConversion: ConversionCategory = {
  id: "time",
  name: "Time",
  kind: "linear",
  baseUnitId: "s",
  units: [
    { id: "s", name: "Seconds", symbol: "s", factor: 1 },
    { id: "min", name: "Minutes", symbol: "min", factor: 60 },
    { id: "h", name: "Hours", symbol: "h", factor: 3600 },
    { id: "d", name: "Days", symbol: "d", factor: 86400 },
  ],
}
