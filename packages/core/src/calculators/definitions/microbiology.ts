import type { CalculatorDefinition } from "../types"
import { num, assertPositive, assertNonNegative, safeDivide, round, fmt } from "../helpers"

export const cfuCalculator: CalculatorDefinition = {
  id: "cfu-per-ml",
  name: "CFU/mL Estimation",
  shortName: "CFU/mL",
  category: "microbiology",
  description: "Estimates colony-forming units per mL from a plated colony count.",
  isEstimator: true,
  formula: "CFU/mL = (colonies counted / volume plated[mL]) x dilution factor",
  keywords: ["cfu", "colony forming units", "plate count", "microbiology"],
  relatedTools: ["dilution-factor", "concentration-after-dilution"],
  inputs: [
    { id: "colonies", label: "Colonies counted", kind: "number", min: 0, step: 1, defaultValue: 150 },
    { id: "volumePlated", label: "Volume plated", kind: "number", unit: "mL", min: 0, step: 0.01, defaultValue: 0.1 },
    { id: "dilutionFactor", label: "Dilution factor", kind: "number", min: 1, step: 1, defaultValue: 1000, helpText: "e.g. enter 1000 for a 10⁻³ dilution" },
  ],
  calculate: (inputs) => {
    const colonies = num(inputs, "colonies")
    const volumePlated = num(inputs, "volumePlated")
    const dilutionFactor = num(inputs, "dilutionFactor")
    assertNonNegative(colonies, "Colony count")
    assertPositive(volumePlated, "Volume plated")
    assertPositive(dilutionFactor, "Dilution factor")

    const cfuPerMl = safeDivide(colonies, volumePlated, "volume plated") * dilutionFactor
    const rounded = round(cfuPerMl, 0)

    return {
      value: rounded,
      unit: "CFU/mL",
      display: `${rounded.toLocaleString()} CFU/mL`,
      calculationSteps: [`(${colonies} / ${volumePlated}) x ${dilutionFactor}`],
      warnings:
        colonies < 30 || colonies > 300
          ? ["Plates with 30-300 colonies are generally considered statistically reliable for counting; this count falls outside that range."]
          : undefined,
    }
  },
  notes: ["Countable range is conventionally 30-300 colonies per plate for reliable statistics."],
}

export const dilutionFactorCalculator: CalculatorDefinition = {
  id: "dilution-factor",
  name: "Dilution Factor",
  shortName: "Dilution Factor",
  category: "microbiology",
  description: "Calculates the dilution factor from initial and final volumes (or concentrations).",
  formula: "Dilution factor = final volume / initial (aliquot) volume",
  keywords: ["dilution factor", "dilution ratio", "microbiology"],
  relatedTools: ["cfu-per-ml", "concentration-after-dilution"],
  inputs: [
    { id: "aliquotVolume", label: "Aliquot (sample) volume", kind: "number", unit: "mL", min: 0, step: 0.01, defaultValue: 1 },
    { id: "finalVolume", label: "Final total volume", kind: "number", unit: "mL", min: 0, step: 0.01, defaultValue: 10 },
  ],
  calculate: (inputs) => {
    const aliquot = num(inputs, "aliquotVolume")
    const final = num(inputs, "finalVolume")
    assertPositive(aliquot, "Aliquot volume")
    assertPositive(final, "Final volume")

    const factor = safeDivide(final, aliquot, "aliquot volume")
    const rounded = round(factor, 2)

    return {
      value: rounded,
      display: `1:${rounded}`,
      secondary: [{ label: "As a fraction", value: `1/${rounded}` }],
      calculationSteps: [`${final} / ${aliquot}`],
    }
  },
}

export const concentrationAfterDilutionCalculator: CalculatorDefinition = {
  id: "concentration-after-dilution",
  name: "Concentration After Dilution",
  shortName: "Post-Dilution Conc.",
  category: "microbiology",
  description: "Calculates the resulting concentration after a single dilution step.",
  formula: "C2 = C1 / dilution factor",
  keywords: ["concentration after dilution", "microbiology", "dilution"],
  relatedTools: ["dilution-factor", "cfu-per-ml"],
  inputs: [
    { id: "initialConcentration", label: "Initial concentration", kind: "number", min: 0, step: 0.0001, defaultValue: 1000000 },
    { id: "dilutionFactor", label: "Dilution factor", kind: "number", min: 1, step: 0.01, defaultValue: 10, helpText: "e.g. enter 10 for a 1:10 dilution" },
  ],
  calculate: (inputs) => {
    const initial = num(inputs, "initialConcentration")
    const factor = num(inputs, "dilutionFactor")
    assertNonNegative(initial, "Initial concentration")
    assertPositive(factor, "Dilution factor")

    const final = safeDivide(initial, factor, "dilution factor")

    return {
      value: final,
      display: fmt(final, final < 1 ? 6 : 2),
      calculationSteps: [`${initial} / ${factor}`],
    }
  },
  notes: ["Use the same concentration units for input and output. This tool does not convert units."],
}


export const serialDilutionFactorCalculator: CalculatorDefinition = {
  id: "serial-dilution-total-factor",
  name: "Serial Dilution Total Factor",
  shortName: "Total Dilution",
  category: "microbiology",
  description: "Calculates the overall dilution factor from multiple serial dilution steps.",
  formula: "Total dilution factor = factor₁ × factor₂ × ... × factorₙ",
  inputs: [
    { id: "factor1", label: "Dilution factor  -  step 1", kind: "number", min: 1, step: 1, defaultValue: 10 },
    { id: "factor2", label: "Dilution factor  -  step 2", kind: "number", min: 1, step: 1, optional: true },
    { id: "factor3", label: "Dilution factor  -  step 3", kind: "number", min: 1, step: 1, optional: true },
    { id: "factor4", label: "Dilution factor  -  step 4", kind: "number", min: 1, step: 1, optional: true },
  ],
  calculate: (inputs) => {
    const values = ["factor1","factor2","factor3","factor4"].map(id => inputs[id]).filter(v => v !== undefined && v !== "")
    if (!values.length) throw new Error("At least one dilution factor is required.")
    const factors = values.map((v, i) => {
      const n = Number(v)
      if (!Number.isFinite(n) || n < 1) throw new Error(`Dilution factor ${i + 1} must be at least 1.`)
      return n
    })
    const total = factors.reduce((a,b) => a*b, 1)
    return { value: total, display: `Total dilution factor: ${total}`, calculationSteps: [factors.join(" × ") + ` = ${total}`], warnings: ["Enter each step as the reciprocal dilution factor (for example, 10 for a 1:10 dilution)."] }
  }
}

export const concentrationAfterSerialDilutionCalculator: CalculatorDefinition = {
  id: "microbiology-concentration-dilution",
  name: "Microbiology Concentration After Dilution",
  shortName: "Diluted Concentration",
  category: "microbiology",
  description: "Calculates the concentration after a documented dilution factor; useful for serial-dilution laboratory workflows.",
  formula: "Final concentration = initial concentration ÷ dilution factor",
  inputs: [
    { id: "initialConcentration", label: "Initial concentration", kind: "number", min: 0, step: 0.01 },
    { id: "dilutionFactor", label: "Dilution factor", kind: "number", min: 1, step: 1, defaultValue: 100 },
  ],
  calculate: (inputs) => {
    const c = num(inputs, "initialConcentration"), f = num(inputs, "dilutionFactor")
    assertNonNegative(c, "Initial concentration"); assertPositive(f, "Dilution factor")
    const out = round(c / f, 6)
    return { value: out, display: `Final concentration: ${out}`, calculationSteps: [`${c} ÷ ${f} = ${out}`], warnings: ["Keep concentration units unchanged; this tool performs arithmetic only."] }
  }
}

export const pooledCultureCfuCalculator: CalculatorDefinition = {
  id: "pooled-cfu-per-ml",
  name: "Pooled CFU/mL Estimation",
  shortName: "Pooled CFU/mL",
  category: "microbiology",
  description: "Estimates CFU/mL when multiple plates from the same dilution are pooled, using total colonies and total plated volume.",
  formula: "CFU/mL = total colonies ÷ total plated volume × dilution factor",
  inputs: [
    { id: "totalColonies", label: "Total colonies counted", kind: "number", min: 0, step: 1, defaultValue: 100 },
    { id: "totalVolumeMl", label: "Total plated volume", kind: "number", unit: "mL", min: 0.001, step: 0.001, defaultValue: 0.1 },
    { id: "dilutionFactor", label: "Dilution factor", kind: "number", min: 1, step: 1, defaultValue: 100 },
  ],
  calculate: (inputs) => {
    const c = num(inputs, "totalColonies"), v = num(inputs, "totalVolumeMl"), f = num(inputs, "dilutionFactor")
    assertNonNegative(c, "Total colonies"); assertPositive(v, "Total plated volume"); assertPositive(f, "Dilution factor")
    const result = round((c / v) * f, 2)
    return { value: result, unit: "CFU/mL", display: `Estimated CFU/mL: ${result}`, calculationSteps: [`(${c} ÷ ${v}) × ${f} = ${result} CFU/mL`], warnings: ["Use only plates and dilution steps that meet the laboratory's validated counting criteria."] }
  }
}
