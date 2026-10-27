/**
 * Mass <-> Volume conversion requires a density and must never assume
 * 1 g = 1 mL. All inputs/outputs here are in grams and milliliters;
 * callers are responsible for converting to/from other mass/volume
 * units using the mass/volume conversion categories.
 */

export class DensityConversionError extends Error {}

export function massToVolume(massGrams: number, densityGPerML: number): number {
  if (densityGPerML <= 0) throw new DensityConversionError("Density must be greater than zero")
  return massGrams / densityGPerML
}

export function volumeToMass(volumeML: number, densityGPerML: number): number {
  if (densityGPerML <= 0) throw new DensityConversionError("Density must be greater than zero")
  return volumeML * densityGPerML
}
