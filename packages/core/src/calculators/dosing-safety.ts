import type { CalculatorDefinition, CalculationResult } from "./types"

export function validateCalculatorInputBounds(
  definition: CalculatorDefinition,
  parsed: Record<string, number | string>,
) {
  for (const input of definition.inputs) {
    if (input.kind !== "number") continue
    const raw = parsed[input.id]
    if (raw === "" || raw === undefined || raw === null) continue

    const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw))
    if (!Number.isFinite(value)) throw new Error(`${input.label} must be a valid number`)
    if (input.min !== undefined && value < input.min) {
      throw new Error(`${input.label} must be at least ${input.min}${input.unit ? ` ${input.unit}` : ""}`)
    }
    if (input.max !== undefined && value > input.max) {
      throw new Error(`${input.label} must be no more than ${input.max}${input.unit ? ` ${input.unit}` : ""}`)
    }
  }
}

export function getDosingSafetyWarnings(
  definition: CalculatorDefinition,
  parsed: Record<string, number | string>,
  result: CalculationResult,
): string[] {
  if (definition.category !== "dosing") return []

  const numericInputs = definition.inputs
    .filter((input) => input.kind === "number")
    .map((input) => ({ input, value: Number.parseFloat(String(parsed[input.id])) }))
    .filter(({ value }) => Number.isFinite(value))

  const warnings: string[] = []

  const weightInput = numericInputs.find(({ input }) =>
    /(^|-)weight$|patientweight|dosingweight/i.test(input.id),
  )
  if (weightInput && (weightInput.value < 0.2 || weightInput.value > 300)) {
    warnings.push(
      "Patient weight is outside a broad 0.2–300 kg plausibility range. Confirm the entered weight and dosing population before using this result.",
    )
  }

  const renalInput = numericInputs.find(({ input }) =>
    /crcl|creatinineclearance|gfr|egfr/i.test(input.id),
  )
  if (renalInput && renalInput.value < 30) {
    warnings.push(
      "Reduced renal function detected. Check the drug-specific renal adjustment, dialysis status and current local protocol before administration.",
    )
  }

  if (typeof result.value === "number" && result.value < 0) {
    throw new Error("The calculated dose/result cannot be negative")
  }
  if (typeof result.value === "number" && result.value === 0) {
    warnings.push("The calculated result is zero. Confirm that the intended dose and all required inputs were entered correctly.")
  }

  warnings.push(
    "Safety check: verify indication, age/weight band, route, formulation/concentration, maximum dose, frequency, renal/hepatic status and current protocol before administration.",
  )

  return warnings
}
