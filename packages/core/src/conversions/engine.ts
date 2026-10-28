import type { ConversionCategory, UnitDefinition } from "./types"

export class ConversionError extends Error {}

function getUnit(category: ConversionCategory, unitId: string): UnitDefinition {
  const unit = category.units.find((u) => u.id === unitId)
  if (!unit) throw new ConversionError(`Unknown unit "${unitId}" in category "${category.id}"`)
  return unit
}

/** Converts a value from one unit to another within the same category. */
export function convert(category: ConversionCategory, value: number, fromId: string, toId: string): number {
  if (!Number.isFinite(value)) throw new ConversionError("Value must be a finite number")

  const from = getUnit(category, fromId)
  const to = getUnit(category, toId)

  const fromOffset = from.offset ?? 0
  const toOffset = to.offset ?? 0

  // Normalize into the category's base unit, then scale into the target unit.
  const base = (value - fromOffset) * from.factor
  return base / to.factor + toOffset
}

export function convertRoundTrip(
  category: ConversionCategory,
  value: number,
  fromId: string,
  toId: string,
): { converted: number; roundTrip: number } {
  const converted = convert(category, value, fromId, toId)
  const roundTrip = convert(category, converted, toId, fromId)
  return { converted, roundTrip }
}

export function findUnit(category: ConversionCategory, unitId: string): UnitDefinition | undefined {
  return category.units.find((u) => u.id === unitId)
}
