import type { CalculatorDefinition } from "../types"
import { num, assertPositive, safeDivide, round, fmt } from "../helpers"

export const molarityCalculator: CalculatorDefinition = {
  id: "molarity",
  name: "Molarity Calculator",
  shortName: "Molarity",
  category: "lab-solutions",
  description: "Calculates the molar concentration of a solution from mass, molecular weight, and volume.",
  formula: "Molarity (M) = mass (g) / [molecular weight (g/mol) x volume (L)]",
  keywords: ["molarity", "molar concentration", "solution"],
  relatedTools: ["normality"],
  inputs: [
    { id: "mass", label: "Mass of solute", kind: "number", unit: "g", min: 0, step: 0.001, defaultValue: 5.85 },
    { id: "molecularWeight", label: "Molecular weight", kind: "number", unit: "g/mol", min: 0, step: 0.01, defaultValue: 58.44 },
    { id: "volume", label: "Solution volume", kind: "number", unit: "L", min: 0, step: 0.001, defaultValue: 1 },
  ],
  calculate: (inputs) => {
    const mass = num(inputs, "mass")
    const mw = num(inputs, "molecularWeight")
    const volume = num(inputs, "volume")
    assertPositive(mw, "Molecular weight")
    assertPositive(volume, "Volume")

    const moles = safeDivide(mass, mw, "molecular weight")
    const molarity = safeDivide(moles, volume, "volume")
    const rounded = round(molarity, 4)

    return {
      value: rounded,
      unit: "M",
      display: fmt(rounded, 4, "M"),
      secondary: [
        { label: "mM", value: fmt(round(molarity * 1000, 2), 2) },
        { label: "µM", value: fmt(round(molarity * 1_000_000, 1), 1) },
        { label: "Moles of solute", value: fmt(round(moles, 4), 4, "mol") },
      ],
      calculationSteps: [`moles = ${mass} / ${mw} = ${round(moles, 4)} mol`, `M = ${round(moles, 4)} / ${volume} L`],
    }
  },
  notes: ["To prepare a solution of a target molarity, solve for mass: mass = M x MW x volume."],
}

export const normalityCalculator: CalculatorDefinition = {
  id: "normality",
  name: "Normality Calculator",
  shortName: "Normality",
  category: "lab-solutions",
  description: "Calculates normality from mass, equivalent weight, and volume.",
  formula: "Normality (N) = mass (g) / [equivalent weight (g/eq) x volume (L)]",
  keywords: ["normality", "equivalent weight", "solution"],
  relatedTools: ["molarity"],
  inputs: [
    { id: "mass", label: "Mass of solute", kind: "number", unit: "g", min: 0, step: 0.001, defaultValue: 4.9 },
    {
      id: "equivalentWeight",
      label: "Equivalent weight",
      kind: "number",
      unit: "g/eq",
      min: 0,
      step: 0.01,
      defaultValue: 49,
      helpText: "Equivalent weight depends on the reaction context (e.g. valence for acids/bases or redox reactions).",
    },
    { id: "volume", label: "Solution volume", kind: "number", unit: "L", min: 0, step: 0.001, defaultValue: 1 },
  ],
  calculate: (inputs) => {
    const mass = num(inputs, "mass")
    const eqWeight = num(inputs, "equivalentWeight")
    const volume = num(inputs, "volume")
    assertPositive(eqWeight, "Equivalent weight")
    assertPositive(volume, "Volume")

    const equivalents = safeDivide(mass, eqWeight, "equivalent weight")
    const normality = safeDivide(equivalents, volume, "volume")
    const rounded = round(normality, 4)

    return {
      value: rounded,
      unit: "N",
      display: fmt(rounded, 4, "N"),
      secondary: [{ label: "mN", value: fmt(round(normality * 1000, 2), 2) }],
      calculationSteps: [`equivalents = ${mass} / ${eqWeight}`, `N = ${round(equivalents, 4)} / ${volume} L`],
    }
  },
  notes: ["Equivalent weight depends on the reaction context, it is not a fixed property of a substance."],
}

export const c1v1c2v2Calculator: CalculatorDefinition = {
  id: "c1v1-c2v2-dilution",
  name: "C1V1 = C2V2 Dilution",
  shortName: "C1V1=C2V2",
  category: "lab-solutions",
  subcategory: "dilution-preparation",
  description: "Solves a single-step dilution equation when three of concentration or volume values are known.",
  formula: "C1 × V1 = C2 × V2",
  keywords: ["c1v1", "c2v2", "dilution", "stock", "working solution"],
  inputs: [
    { id: "solveFor", label: "Solve for", kind: "select", options: [
      { value: "v1", label: "Stock volume (V1)" },
      { value: "c2", label: "Final concentration (C2)" },
      { value: "v2", label: "Final volume (V2)" },
      { value: "c1", label: "Stock concentration (C1)" },
    ], defaultValue: "v1" },
    { id: "c1", label: "Stock concentration (C1)", kind: "number", min: 0, step: 0.001, defaultValue: 100 },
    { id: "v1", label: "Stock volume (V1)", kind: "number", unit: "mL", min: 0, step: 0.01, optional: true },
    { id: "c2", label: "Final concentration (C2)", kind: "number", min: 0, step: 0.001, defaultValue: 10 },
    { id: "v2", label: "Final volume (V2)", kind: "number", unit: "mL", min: 0, step: 0.01, defaultValue: 100 },
  ],
  calculate: (inputs) => {
    const solve = String(inputs.solveFor)
    const c1 = num(inputs, "c1"), v1 = Number(inputs.v1), c2 = num(inputs, "c2"), v2 = num(inputs, "v2")
    if (solve === "v1") {
      assertPositive(c1, "Stock concentration"); assertPositive(c2, "Final concentration"); assertPositive(v2, "Final volume")
      const out = round((c2 * v2) / c1, 4)
      return { value: out, unit: "mL", display: fmt(out, 4, "mL stock"), calculationSteps: [`V1 = (${c2} × ${v2}) ÷ ${c1} = ${out} mL`] }
    }
    if (solve === "c2") {
      assertPositive(c1, "Stock concentration"); assertPositive(v1, "Stock volume"); assertPositive(v2, "Final volume")
      const out = round((c1 * v1) / v2, 6)
      return { value: out, display: `C2 = ${out}`, calculationSteps: [`C2 = (${c1} × ${v1}) ÷ ${v2} = ${out}`] }
    }
    if (solve === "v2") {
      assertPositive(c2, "Final concentration"); assertPositive(c1, "Stock concentration"); assertPositive(v1, "Stock volume")
      const out = round((c1 * v1) / c2, 4)
      return { value: out, unit: "mL", display: fmt(out, 4, "mL final"), calculationSteps: [`V2 = (${c1} × ${v1}) ÷ ${c2} = ${out} mL`] }
    }
    assertPositive(v1, "Stock volume"); assertPositive(c2, "Final concentration"); assertPositive(v2, "Final volume")
    const out = round((c2 * v2) / v1, 6)
    return { value: out, display: `C1 = ${out}`, calculationSteps: [`C1 = (${c2} × ${v2}) ÷ ${v1} = ${out}`] }
  },
  notes: ["Concentration units must be identical on both sides of the equation. Volume units must also match."],
}

export const percentSolutionCalculator: CalculatorDefinition = {
  id: "percent-solution",
  name: "Percent Solution Preparation",
  shortName: "% Solution",
  category: "lab-solutions",
  subcategory: "concentration-preparation",
  description: "Calculates solute amount required for common w/v, v/v, or w/w percentage solutions.",
  formula: "% w/v = g per 100 mL; % v/v = mL per 100 mL; % w/w = g per 100 g",
  keywords: ["percent solution", "w/v", "v/v", "w/w", "percentage", "reagent preparation"],
  inputs: [
    { id: "type", label: "Solution type", kind: "select", options: [
      { value: "wv", label: "w/v (g per 100 mL)" },
      { value: "vv", label: "v/v (mL per 100 mL)" },
      { value: "ww", label: "w/w (g per 100 g)" },
    ], defaultValue: "wv" },
    { id: "percent", label: "Target percentage", kind: "number", min: 0, max: 100, step: 0.01, defaultValue: 5 },
    { id: "finalAmount", label: "Final amount", kind: "number", min: 0, step: 0.1, defaultValue: 100 },
  ],
  calculate: (inputs) => {
    const type = String(inputs.type), percent = num(inputs, "percent"), finalAmount = num(inputs, "finalAmount")
    assertPositive(finalAmount, "Final amount")
    const amount = round((percent / 100) * finalAmount, 4)
    const unit = type === "wv" ? "g" : type === "vv" ? "mL" : "g"
    const denominator = type === "wv" || type === "vv" ? "mL" : "g"
    return {
      value: amount,
      unit,
      display: `${amount} ${unit} solute per ${finalAmount} ${denominator} final solution`,
      calculationSteps: [`${percent}% × ${finalAmount} ${denominator} = ${amount} ${unit}`],
      warnings: ["Follow the validated preparation method for dissolution, final-volume adjustment, mixing, labeling and storage."],
    }
  },
  notes: ["This calculator performs percentage arithmetic only; density, purity, hydrates and volumetric technique are not inferred."],
}

export const molarityPreparationCalculator: CalculatorDefinition = {
  id: "molarity-preparation",
  name: "Molar Solution Preparation",
  shortName: "Prepare Molar Solution",
  category: "lab-solutions",
  subcategory: "concentration-preparation",
  description: "Calculates the mass of solute required to prepare a target molar solution.",
  formula: "Mass (g) = target molarity × molecular weight × final volume (L)",
  keywords: ["molarity", "prepare solution", "reagent", "molecular weight", "stock preparation"],
  relatedTools: ["molarity", "c1v1-c2v2-dilution"],
  inputs: [
    { id: "targetMolarity", label: "Target molarity", kind: "number", unit: "mol/L", min: 0, step: 0.0001, defaultValue: 0.1 },
    { id: "molecularWeight", label: "Molecular weight", kind: "number", unit: "g/mol", min: 0, step: 0.01, defaultValue: 58.44 },
    { id: "finalVolume", label: "Final volume", kind: "number", unit: "L", min: 0, step: 0.001, defaultValue: 1 },
  ],
  calculate: (inputs) => {
    const m = num(inputs, "targetMolarity"), mw = num(inputs, "molecularWeight"), v = num(inputs, "finalVolume")
    assertPositive(mw, "Molecular weight"); assertPositive(v, "Final volume")
    const mass = round(m * mw * v, 4)
    return { value: mass, unit: "g", display: fmt(mass, 4, "g"), calculationSteps: [`${m} × ${mw} × ${v} = ${mass} g`], warnings: ["Check reagent purity, hydration state and the validated volumetric preparation procedure before use."] }
  },
}

export const reagentDilutionVolumeCalculator: CalculatorDefinition = {
  id: "reagent-dilution-volume",
  name: "Reagent Dilution & Solvent Volume",
  shortName: "Dilution Volume",
  category: "lab-solutions",
  subcategory: "dilution-preparation",
  description: "Calculates stock volume and solvent volume for a target diluted solution using C1V1 = C2V2.",
  formula: "V1 = C2V2/C1; solvent = V2 − V1",
  keywords: ["reagent dilution", "solvent volume", "stock solution", "c1v1", "working solution"],
  inputs: [
    { id: "stockConcentration", label: "Stock concentration", kind: "number", min: 0, step: 0.001, defaultValue: 100 },
    { id: "targetConcentration", label: "Target concentration", kind: "number", min: 0, step: 0.001, defaultValue: 10 },
    { id: "finalVolume", label: "Final volume", kind: "number", unit: "mL", min: 0, step: 0.01, defaultValue: 100 },
  ],
  calculate: (inputs) => {
    const c1 = num(inputs, "stockConcentration"), c2 = num(inputs, "targetConcentration"), v2 = num(inputs, "finalVolume")
    assertPositive(c1, "Stock concentration"); assertPositive(v2, "Final volume")
    if (c2 > c1) throw new Error("Target concentration cannot exceed the stock concentration for a simple dilution.")
    const v1 = (c2 * v2) / c1
    const solvent = v2 - v1
    return { value: round(v1, 4), unit: "mL", display: `${round(v1, 4)} mL stock`, secondary: [{ label: "Solvent to add", value: `${round(solvent, 4)} mL` }], calculationSteps: [`V1 = (${c2} × ${v2}) ÷ ${c1} = ${round(v1, 4)} mL`, `Solvent = ${v2} − ${round(v1, 4)} = ${round(solvent, 4)} mL`] }
  },
}
