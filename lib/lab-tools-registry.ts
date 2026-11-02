export interface LabToolEntry {
  id: string
  name: string
  description: string
  href: string
  keywords?: string[]
}

/**
 * Pages built as standalone components rather than registered calculators
 * or conversion categories (dilution math, solution prep, spectrophotometry
 * UI, and reference tables). Listed here so global search and the command
 * palette can find them too  -  see spec section 37's example results,
 * which explicitly include "Dilution" and "Mass ↔ Volume".
 */
export const labTools: LabToolEntry[] = [
  {
    id: "c1v1-dilution",
    name: "C1V1 = C2V2 Dilution",
    description: "Solve for concentration or volume",
    href: "/lab-tools/dilution",
    keywords: ["dilution", "c1v1", "c2v2", "stock solution"],
  },
  {
    id: "serial-dilution",
    name: "Serial Dilution",
    description: "Concentration at every step of a dilution series",
    href: "/lab-tools/serial-dilution",
    keywords: ["serial dilution", "dilution series"],
  },
  {
    id: "percentage-solution",
    name: "Percentage Solution",
    description: "% w/v, % v/v, % w/w conversions",
    href: "/lab-tools/percentage-solution",
    keywords: ["percentage", "w/v", "v/v", "w/w", "solution"],
  },
  {
    id: "height-converter",
    name: "Height Converter",
    description: "cm, m, mm, ft, in and feet + inches",
    href: "/conversions/height",
    keywords: ["height", "cm to feet", "cm to ft", "feet to cm", "inches to cm", "cm to inches", "ft in", "feet and inches", "m to ft", "stature"],
  },
  {
    id: "mass-volume",
    name: "Mass ↔ Volume",
    description: "Density-based conversion by substance",
    href: "/conversions/mass-volume",
    keywords: ["mass volume", "density", "g to ml", "kg to l"],
  },
  {
    id: "molar-mass-concentration",
    name: "Molar ↔ Mass Concentration",
    description: "mg/dL ↔ mmol/L by analyte",
    href: "/conversions/molar-mass",
    keywords: ["molar", "mass concentration", "mg/dl", "mmol/l"],
  },
  {
    id: "beer-lambert",
    name: "Beer-Lambert Law",
    description: "Solve for absorbance, path length, or concentration",
    href: "/lab-tools/spectrophotometry",
    keywords: ["beer-lambert", "absorbance", "spectrophotometry", "epsilon"],
  },
  {
    id: "transmittance",
    name: "Absorbance ↔ %Transmittance",
    description: "Convert between absorbance and transmittance",
    href: "/lab-tools/spectrophotometry",
    keywords: ["transmittance", "absorbance", "spectrophotometry"],
  },
  {
    id: "calibration-curve",
    name: "Calibration Curve",
    description: "Linear regression from standards, solve for unknowns, dilution-adjusted concentration",
    href: "/lab-tools/spectrophotometry",
    keywords: ["calibration curve", "linear regression", "standards", "dilution-adjusted concentration"],
  },
  {
    id: "mcfarland",
    name: "McFarland Standards",
    description: "Turbidity standard reference table",
    href: "/lab-tools/microbiology",
    keywords: ["mcfarland", "turbidity", "microbiology"],
  },
  {
    id: "red-cell-indices",
    name: "Red Cell Indices",
    description: "MCV, MCH, and MCHC from one set of Hgb/Hct/RBC values",
    href: "/calculators/hematology/red-cell-indices",
    keywords: ["mcv", "mch", "mchc", "red cell indices", "hemoglobin", "hematocrit", "rbc"],
  },
]
