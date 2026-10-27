import { describe, expect, it } from "vitest"
import { massToVolume, volumeToMass, DensityConversionError } from "./density"
import { substances } from "./substances"

describe("density conversion  -  round trips", () => {
  for (const substance of substances) {
    it(`${substance.name}: mass -> volume -> mass returns the original value`, () => {
      const originalMass = 123.45
      const volume = massToVolume(originalMass, substance.density.value)
      const roundTripMass = volumeToMass(volume, substance.density.value)
      expect(roundTripMass).toBeCloseTo(originalMass, 6)
    })
  }
})

describe("density conversion  -  known values", () => {
  it("100 g of water (density 1.0) = 100 mL", () => {
    expect(massToVolume(100, 1.0)).toBeCloseTo(100, 6)
  })

  it("100 mL of blood (density 1.06) = 106 g", () => {
    expect(volumeToMass(100, 1.06)).toBeCloseTo(106, 6)
  })

  it("zero mass converts to zero volume", () => {
    expect(massToVolume(0, 1.0)).toBe(0)
  })

  it("decimal mass converts correctly", () => {
    expect(massToVolume(2.5, 0.789)).toBeCloseTo(3.1685, 3)
  })
})

describe("density conversion  -  error handling", () => {
  it("throws for zero density", () => {
    expect(() => massToVolume(100, 0)).toThrow(DensityConversionError)
    expect(() => volumeToMass(100, 0)).toThrow(DensityConversionError)
  })

  it("throws for negative density", () => {
    expect(() => massToVolume(100, -1)).toThrow(DensityConversionError)
  })
})
