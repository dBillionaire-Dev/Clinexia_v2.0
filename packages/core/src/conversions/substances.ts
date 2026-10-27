export interface Substance {
  id: string
  name: string
  category: "aqueous" | "biological" | "solvent" | "solution"
  density: {
    value: number // g/mL
    approximate: boolean
    notes?: string
  }
}

export const substances: Substance[] = [
  {
    id: "water",
    name: "Water",
    category: "aqueous",
    density: { value: 1.0, approximate: false, notes: "At approximately 4°C / room temperature; varies slightly with temperature." },
  },
  {
    id: "blood",
    name: "Whole blood",
    category: "biological",
    density: {
      value: 1.06,
      approximate: true,
      notes: "Blood density varies between samples with hematocrit and composition  -  this is an estimate, not a measured value.",
    },
  },
  {
    id: "plasma",
    name: "Plasma",
    category: "biological",
    density: { value: 1.025, approximate: true, notes: "Approximate reference value; actual density varies with protein content." },
  },
  {
    id: "serum",
    name: "Serum",
    category: "biological",
    density: { value: 1.024, approximate: true, notes: "Approximate reference value; actual density varies with composition." },
  },
  {
    id: "urine",
    name: "Urine (typical)",
    category: "biological",
    density: {
      value: 1.015,
      approximate: true,
      notes: "Urine density varies significantly (specific gravity roughly 1.003–1.035). Prefer a measured specific gravity or user-provided density when available.",
    },
  },
  {
    id: "saline-0.9",
    name: "Saline 0.9% NaCl",
    category: "solution",
    density: { value: 1.005, approximate: true, notes: "Normal (0.9%) saline, approximate." },
  },
  {
    id: "saline-0.45",
    name: "Saline 0.45% NaCl",
    category: "solution",
    density: { value: 1.003, approximate: true, notes: "Half-normal (0.45%) saline, approximate." },
  },
  {
    id: "ethanol-70",
    name: "Ethanol 70%",
    category: "solution",
    density: { value: 0.89, approximate: true, notes: "70% v/v aqueous ethanol, approximate at room temperature." },
  },
  {
    id: "ethanol-95",
    name: "Ethanol 95%",
    category: "solution",
    density: { value: 0.81, approximate: true, notes: "95% v/v aqueous ethanol, approximate at room temperature." },
  },
  {
    id: "ethanol-100",
    name: "Ethanol 100% (absolute)",
    category: "solvent",
    density: { value: 0.789, approximate: false, notes: "Absolute ethanol at 20°C." },
  },
  {
    id: "methanol",
    name: "Methanol",
    category: "solvent",
    density: { value: 0.792, approximate: false, notes: "At 20°C." },
  },
  {
    id: "acetone",
    name: "Acetone",
    category: "solvent",
    density: { value: 0.784, approximate: false, notes: "At 20°C." },
  },
  {
    id: "glycerol",
    name: "Glycerol",
    category: "solvent",
    density: { value: 1.261, approximate: false, notes: "At 20°C." },
  },
  {
    id: "isopropanol",
    name: "Isopropanol",
    category: "solvent",
    density: { value: 0.786, approximate: false, notes: "At 20°C." },
  },
]

export function getSubstance(id: string): Substance | undefined {
  return substances.find((s) => s.id === id)
}
