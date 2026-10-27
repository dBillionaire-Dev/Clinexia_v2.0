export interface UnitDefinition {
  id: string
  name: string
  symbol: string
  /**
   * Multiplier that converts 1 unit of this into the category's base unit,
   * applied as: base = (value - offset) * factor
   */
  factor: number
  /** Offset applied before scaling (used for temperature). Defaults to 0. */
  offset?: number
}

export type ConversionKind = "linear" | "offset"

export interface ConversionCategory {
  id: string
  name: string
  kind: ConversionKind
  /** id of the unit treated as the base for internal conversion */
  baseUnitId: string
  units: UnitDefinition[]
}
