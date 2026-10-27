import type { ConversionCategory } from "./types"
import { massConversion } from "./data/mass"
import { volumeConversion } from "./data/volume"
import { lengthConversion } from "./data/length"
import { temperatureConversion } from "./data/temperature"
import { pressureConversion } from "./data/pressure"
import { energyConversion } from "./data/energy"
import { timeConversion } from "./data/time"
import { concentrationConversion, molarConversion } from "./data/concentration"

export const conversionCategories: ConversionCategory[] = [
  massConversion,
  volumeConversion,
  lengthConversion,
  temperatureConversion,
  pressureConversion,
  energyConversion,
  timeConversion,
  concentrationConversion,
  molarConversion,
]

export function getConversionCategory(id: string): ConversionCategory | undefined {
  return conversionCategories.find((c) => c.id === id)
}

export function searchConversions(query: string): ConversionCategory[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return conversionCategories.filter((c) => {
    const haystack = [c.name, ...c.units.map((u) => `${u.name} ${u.symbol}`)].join(" ").toLowerCase()
    return haystack.includes(q)
  })
}

export * from "./types"
export * from "./engine"
