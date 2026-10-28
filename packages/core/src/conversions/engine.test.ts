import { describe, expect, it } from "vitest"
import { convert, ConversionError } from "./engine"
import { conversionCategories } from "./registry"

const TOLERANCE = 1e-9

describe("conversion engine  -  round trips", () => {
  for (const category of conversionCategories) {
    describe(category.name, () => {
      for (const unit of category.units) {
        for (const other of category.units) {
          if (unit.id === other.id) continue
          it(`${unit.id} -> ${other.id} -> ${unit.id} returns the original value`, () => {
            const testValue = 12.345
            const converted = convert(category, testValue, unit.id, other.id)
            const roundTrip = convert(category, converted, other.id, unit.id)
            expect(roundTrip).toBeCloseTo(testValue, 6)
          })
        }
      }
    })
  }
})

describe("conversion engine  -  known values", () => {
  const temperature = conversionCategories.find((c) => c.id === "temperature")!
  const mass = conversionCategories.find((c) => c.id === "mass")!
  const volume = conversionCategories.find((c) => c.id === "volume")!
  const pressure = conversionCategories.find((c) => c.id === "pressure")!

  it("0 C = 32 F", () => {
    expect(convert(temperature, 0, "C", "F")).toBeCloseTo(32, 6)
  })

  it("100 C = 212 F", () => {
    expect(convert(temperature, 100, "C", "F")).toBeCloseTo(212, 6)
  })

  it("0 C = 273.15 K", () => {
    expect(convert(temperature, 0, "C", "K")).toBeCloseTo(273.15, 6)
  })

  it("-40 C = -40 F (the crossover point)", () => {
    expect(convert(temperature, -40, "C", "F")).toBeCloseTo(-40, 6)
  })

  it("1 kg = 1000 g", () => {
    expect(convert(mass, 1, "kg", "g")).toBeCloseTo(1000, 6)
  })

  it("1 kg = 2.20462 lb", () => {
    expect(convert(mass, 1, "kg", "lb")).toBeCloseTo(2.20462, 4)
  })

  it("1 L = 1000 mL", () => {
    expect(convert(volume, 1, "L", "mL")).toBeCloseTo(1000, 6)
  })

  it("1 atm = 760 mmHg", () => {
    expect(convert(pressure, 1, "atm", "mmHg")).toBeCloseTo(760, 1)
  })

  it("zero converts to zero for purely linear categories", () => {
    expect(convert(mass, 0, "kg", "g")).toBe(0)
    expect(convert(volume, 0, "L", "mL")).toBe(0)
  })

  it("negative values convert correctly (e.g. sub-zero temperatures)", () => {
    expect(convert(temperature, -10, "C", "F")).toBeCloseTo(14, 6)
  })

  it("decimal values convert correctly", () => {
    expect(convert(mass, 2.5, "kg", "g")).toBeCloseTo(2500, 6)
  })
})

describe("conversion engine  -  error handling", () => {
  const mass = conversionCategories.find((c) => c.id === "mass")!

  it("throws for an unknown unit id", () => {
    expect(() => convert(mass, 1, "kg", "not-a-unit")).toThrow(ConversionError)
  })

  it("throws for a non-finite value", () => {
    expect(() => convert(mass, Number.NaN, "kg", "g")).toThrow(ConversionError)
    expect(() => convert(mass, Number.POSITIVE_INFINITY, "kg", "g")).toThrow(ConversionError)
  })
})
