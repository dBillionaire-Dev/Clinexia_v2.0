import type { CalculatorDefinition } from "../types"
import { num, assertPositive, round, fmt } from "../helpers"

export const beerLambertCalculator: CalculatorDefinition = {
  id: "beer-lambert-law",
  name: "Beer–Lambert Law",
  shortName: "Beer–Lambert",
  category: "spectrophotometry",
  description: "Calculates absorbance, concentration, path length, or molar absorptivity from the Beer–Lambert relationship using a selected solve direction.",
  inputs: [
    { id:"solveFor", label:"Solve for", kind:"select", options:[
      {value:"absorbance",label:"Absorbance"},{value:"concentration",label:"Concentration"},{value:"pathLength",label:"Path length"},{value:"epsilon",label:"Molar absorptivity"}
    ]},
    { id:"absorbance",label:"Absorbance",kind:"number",min:0,step:0.001,optional:true },
    { id:"epsilon",label:"Molar absorptivity",kind:"number",unit:"L·mol⁻¹·cm⁻¹",min:0.000001,step:0.1,optional:true },
    { id:"pathLength",label:"Path length",kind:"number",unit:"cm",min:0.0001,step:0.01,optional:true },
    { id:"concentration",label:"Concentration",kind:"number",unit:"mol/L",min:0.0000001,step:0.000001,optional:true },
  ],
  calculate:(inputs)=>{
    const solve=String(inputs.solveFor)
    const A=Number(inputs.absorbance), e=Number(inputs.epsilon), l=Number(inputs.pathLength), c=Number(inputs.concentration)
    if(solve==="absorbance"){
      assertPositive(e,"Molar absorptivity");assertPositive(l,"Path length");assertPositive(c,"Concentration");const v=round(e*l*c,4);return {value:v,display:`Absorbance: ${v}`,calculationSteps:[`${e} × ${l} × ${c} = ${v}`]}
    }
    if(solve==="concentration"){
      if(!Number.isFinite(A)||A<0)throw new Error("Absorbance must be non-negative.");assertPositive(e,"Molar absorptivity");assertPositive(l,"Path length");const v=round(A/(e*l),8);return {value:v,unit:"mol/L",display:fmt(v,8,"mol/L"),calculationSteps:[`${A} ÷ (${e} × ${l}) = ${v} mol/L`]}
    }
    if(solve==="pathLength"){
      if(!Number.isFinite(A)||A<0)throw new Error("Absorbance must be non-negative.");assertPositive(e,"Molar absorptivity");assertPositive(c,"Concentration");const v=round(A/(e*c),5);return {value:v,unit:"cm",display:fmt(v,5,"cm"),calculationSteps:[`${A} ÷ (${e} × ${c}) = ${v} cm`]}
    }
    if(solve==="epsilon"){
      if(!Number.isFinite(A)||A<0)throw new Error("Absorbance must be non-negative.");assertPositive(l,"Path length");assertPositive(c,"Concentration");const v=round(A/(l*c),3);return {value:v,unit:"L·mol⁻¹·cm⁻¹",display:fmt(v,3,"L·mol⁻¹·cm⁻¹"),calculationSteps:[`${A} ÷ (${l} × ${c}) = ${v} L·mol⁻¹·cm⁻¹`]}
    }
    throw new Error("Select a valid quantity to solve for.")
  },
  formula:"A = εlc",
  notes:["Use absorbance measured within the validated linear range of the method. Blank correction, wavelength, matrix effects and instrument validation remain laboratory-method requirements."]
}

export const absorbanceTransmittanceCalculator: CalculatorDefinition = {
  id: "absorbance-transmittance",
  name: "Absorbance ↔ Transmittance",
  shortName: "A ↔ %T",
  category: "spectrophotometry",
  description: "Converts between absorbance and percent transmittance using the logarithmic relationship.",
  formula: "A = −log10(T), T = 10^(−A), %T = 100T",
  keywords: ["absorbance", "transmittance", "%T", "spectrophotometry"],
  inputs: [
    { id: "solveFor", label: "Convert to", kind: "select", options: [{ value: "transmittance", label: "Percent transmittance" }, { value: "absorbance", label: "Absorbance" }], defaultValue: "transmittance" },
    { id: "absorbance", label: "Absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.301 },
    { id: "percentTransmittance", label: "Percent transmittance", kind: "number", min: 0, max: 100, step: 0.01, defaultValue: 50 },
  ],
  calculate: (inputs) => {
    const solve = String(inputs.solveFor)
    if (solve === "transmittance") {
      const a = num(inputs, "absorbance")
      const t = Math.pow(10, -a) * 100
      return { value: round(t, 4), unit: "%T", display: fmt(round(t, 4), 4, "%T"), calculationSteps: [`100 × 10^(-${a}) = ${round(t, 4)} %T`] }
    }
    const t = num(inputs, "percentTransmittance")
    if (t <= 0 || t > 100) throw new Error("Percent transmittance must be greater than 0 and no more than 100.")
    const a = -Math.log10(t / 100)
    return { value: round(a, 6), unit: "AU", display: fmt(round(a, 6), 6, "AU"), calculationSteps: [`−log10(${t}/100) = ${round(a, 6)} AU`] }
  },
  notes: ["Use blank-corrected measurements and a validated analytical range for the method. Instrument and matrix effects are not corrected by this arithmetic conversion."],
}

export const spectrophotometryStandardCurveCalculator: CalculatorDefinition = {
  id: "spectro-standard-curve",
  name: "Spectrophotometry Standard Curve",
  shortName: "Standard Curve",
  category: "spectrophotometry",
  description: "Calculates the linear calibration relationship and estimates an unknown concentration from absorbance using two-point or slope/intercept data.",
  formula: "y = mx + b; x = (y − b)/m",
  keywords: ["standard curve", "calibration", "slope", "intercept", "absorbance", "concentration"],
  inputs: [
    { id: "standard1Concentration", label: "Standard 1 concentration", kind: "number", min: 0, step: 0.001, defaultValue: 0 },
    { id: "standard1Absorbance", label: "Standard 1 absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0 },
    { id: "standard2Concentration", label: "Standard 2 concentration", kind: "number", min: 0, step: 0.001, defaultValue: 10 },
    { id: "standard2Absorbance", label: "Standard 2 absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 1 },
    { id: "unknownAbsorbance", label: "Unknown absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.5 },
  ],
  calculate: (inputs) => {
    const x1 = num(inputs, "standard1Concentration"), y1 = num(inputs, "standard1Absorbance"), x2 = num(inputs, "standard2Concentration"), y2 = num(inputs, "standard2Absorbance"), y = num(inputs, "unknownAbsorbance")
    if (x2 === x1) throw new Error("Standard concentrations must be different.")
    const slope = (y2 - y1) / (x2 - x1)
    if (slope === 0) throw new Error("The standard curve slope cannot be zero.")
    const intercept = y1 - slope * x1
    const concentration = (y - intercept) / slope
    return { value: round(concentration, 6), display: `Estimated concentration: ${round(concentration, 6)}`, secondary: [{ label: "Slope (m)", value: fmt(round(slope, 6), 6) }, { label: "Intercept (b)", value: fmt(round(intercept, 6), 6) }], calculationSteps: [`m = (${y2} − ${y1}) ÷ (${x2} − ${x1}) = ${round(slope, 6)}`, `b = ${y1} − (${round(slope, 6)} × ${x1}) = ${round(intercept, 6)}`, `x = (${y} − ${round(intercept, 6)}) ÷ ${round(slope, 6)} = ${round(concentration, 6)}`], warnings: concentration < 0 ? ["The calculated unknown concentration is below zero; review blank correction and whether the measurement is within the validated calibration range."] : undefined }
  },
  limitations: ["This is a two-point linear calculation, not a full least-squares regression. Use the laboratory's validated calibration procedure for quantitative reporting."],
}

export const dilutionCorrectedSpectroConcentrationCalculator: CalculatorDefinition = {
  id: "spectro-dilution-corrected-concentration",
  name: "Spectrophotometry Dilution-Corrected Concentration",
  shortName: "Dilution-Corrected Conc.",
  category: "spectrophotometry",
  description: "Applies a documented dilution factor to a concentration calculated from a linear absorbance-versus-concentration equation.",
  formula: "Original concentration = [(A − b)/m] × dilution factor",
  keywords: ["spectrophotometry", "dilution factor", "standard curve", "concentration"],
  inputs: [
    { id: "absorbance", label: "Sample absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.5 },
    { id: "slope", label: "Calibration slope", kind: "number", step: 0.0001, defaultValue: 0.1 },
    { id: "intercept", label: "Calibration intercept", kind: "number", step: 0.0001, defaultValue: 0 },
    { id: "dilutionFactor", label: "Documented dilution factor", kind: "number", min: 1, step: 0.1, defaultValue: 10 },
  ],
  calculate: (inputs) => {
    const a = num(inputs, "absorbance"), m = num(inputs, "slope"), b = num(inputs, "intercept"), f = num(inputs, "dilutionFactor")
    if (m === 0) throw new Error("Calibration slope cannot be zero.")
    assertPositive(f, "Dilution factor")
    const measured = (a - b) / m
    const original = measured * f
    return { value: round(original, 6), display: `Original concentration: ${round(original, 6)}`, secondary: [{ label: "Concentration in measured dilution", value: `${round(measured, 6)}` }, { label: "Applied dilution factor", value: `${f}×` }], calculationSteps: [`(${a} − ${b}) ÷ ${m} = ${round(measured, 6)}`, `${round(measured, 6)} × ${f} = ${round(original, 6)}`], warnings: measured < 0 ? ["Calculated concentration is below zero; verify blank correction, calibration range and sample result."] : undefined }
  },
}

export const wavelengthFrequencyCalculator: CalculatorDefinition = {
  id: "spectro-wavelength-frequency",
  name: "Wavelength ↔ Frequency",
  shortName: "λ ↔ Frequency",
  category: "spectrophotometry",
  subcategory: "wavelength-photon",
  description: "Converts electromagnetic wavelength and frequency using the speed of light.",
  formula: "f = c / λ",
  keywords: ["wavelength", "frequency", "spectrophotometry", "nm", "Hz"],
  inputs: [
    { id: "solveFor", label: "Solve for", kind: "select", options: [{ value: "frequency", label: "Frequency" }, { value: "wavelength", label: "Wavelength" }], defaultValue: "frequency" },
    { id: "wavelengthNm", label: "Wavelength", kind: "number", unit: "nm", min: 0.000001, step: 1, defaultValue: 500 },
    { id: "frequencyHz", label: "Frequency", kind: "number", unit: "Hz", min: 0.000001, step: 1, defaultValue: 599584916000000 },
  ],
  calculate: (inputs) => {
    const solve = String(inputs.solveFor)
    const c = 299792458
    if (solve === "frequency") {
      const wavelength = num(inputs, "wavelengthNm") * 1e-9
      assertPositive(wavelength, "Wavelength")
      const frequency = c / wavelength
      return { value: round(frequency, 3), unit: "Hz", display: fmt(round(frequency, 3), 3, "Hz"), calculationSteps: [`${c} ÷ (${round(wavelength, 12)} m) = ${round(frequency, 3)} Hz`] }
    }
    const frequency = num(inputs, "frequencyHz")
    assertPositive(frequency, "Frequency")
    const wavelengthNm = (c / frequency) * 1e9
    return { value: round(wavelengthNm, 6), unit: "nm", display: fmt(round(wavelengthNm, 6), 6, "nm"), calculationSteps: [`${c} ÷ ${frequency} × 10⁹ = ${round(wavelengthNm, 6)} nm`] }
  },
  notes: ["Uses the vacuum speed of light. In laboratory instruments, the reported wavelength is an instrument-setting quantity and measurement conditions still matter."],
}

export const photonEnergyCalculator: CalculatorDefinition = {
  id: "spectro-photon-energy",
  name: "Photon Energy from Wavelength",
  shortName: "Photon Energy",
  category: "spectrophotometry",
  subcategory: "wavelength-photon",
  description: "Calculates photon energy from wavelength using E = hc/λ.",
  formula: "E = hc / λ",
  keywords: ["photon", "energy", "wavelength", "Planck", "spectrophotometry"],
  inputs: [{ id: "wavelengthNm", label: "Wavelength", kind: "number", unit: "nm", min: 0.000001, step: 1, defaultValue: 500 }],
  calculate: (inputs) => {
    const wavelengthNm = num(inputs, "wavelengthNm")
    assertPositive(wavelengthNm, "Wavelength")
    const h = 6.62607015e-34
    const c = 299792458
    const energyJ = (h * c) / (wavelengthNm * 1e-9)
    const energyEv = energyJ / 1.602176634e-19
    return { value: energyJ, unit: "J/photon", display: `${energyJ.toExponential(6)} J/photon`, secondary: [{ label: "Energy", value: `${round(energyEv, 6)} eV/photon` }], calculationSteps: [`E = hc/λ = ${energyJ.toExponential(6)} J/photon`] }
  },
}

export const wavenumberCalculator: CalculatorDefinition = {
  id: "spectro-wavenumber",
  name: "Wavelength ↔ Wavenumber",
  shortName: "Wavenumber",
  category: "spectrophotometry",
  subcategory: "wavelength-photon",
  description: "Converts wavelength in nanometres to wavenumber in reciprocal centimetres and back.",
  formula: "ṽ (cm⁻¹) = 10⁷ / λ(nm)",
  keywords: ["wavenumber", "wavelength", "cm-1", "infrared", "spectroscopy"],
  inputs: [
    { id: "solveFor", label: "Solve for", kind: "select", options: [{ value: "wavenumber", label: "Wavenumber" }, { value: "wavelength", label: "Wavelength" }], defaultValue: "wavenumber" },
    { id: "wavelengthNm", label: "Wavelength", kind: "number", unit: "nm", min: 0.000001, step: 1, defaultValue: 500 },
    { id: "wavenumberCm1", label: "Wavenumber", kind: "number", unit: "cm⁻¹", min: 0.000001, step: 1, defaultValue: 20000 },
  ],
  calculate: (inputs) => {
    const solve = String(inputs.solveFor)
    if (solve === "wavenumber") {
      const wavelength = num(inputs, "wavelengthNm")
      assertPositive(wavelength, "Wavelength")
      const value = 1e7 / wavelength
      return { value: round(value, 4), unit: "cm⁻¹", display: fmt(round(value, 4), 4, "cm⁻¹"), calculationSteps: [`10⁷ ÷ ${wavelength} nm = ${round(value, 4)} cm⁻¹`] }
    }
    const wavenumber = num(inputs, "wavenumberCm1")
    assertPositive(wavenumber, "Wavenumber")
    const value = 1e7 / wavenumber
    return { value: round(value, 4), unit: "nm", display: fmt(round(value, 4), 4, "nm"), calculationSteps: [`10⁷ ÷ ${wavenumber} cm⁻¹ = ${round(value, 4)} nm`] }
  },
}

export const blankCorrectedAbsorbanceCalculator: CalculatorDefinition = {
  id: "spectro-blank-corrected-absorbance",
  name: "Blank-Corrected Absorbance",
  shortName: "Blank Corrected A",
  category: "spectrophotometry",
  subcategory: "absorbance-transmittance",
  description: "Subtracts a documented blank absorbance from a sample absorbance.",
  formula: "A(corrected) = A(sample) − A(blank)",
  keywords: ["blank", "blank correction", "absorbance", "baseline", "spectrophotometry"],
  inputs: [
    { id: "sampleAbsorbance", label: "Sample absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.65 },
    { id: "blankAbsorbance", label: "Blank absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.05 },
  ],
  calculate: (inputs) => {
    const sample = num(inputs, "sampleAbsorbance")
    const blank = num(inputs, "blankAbsorbance")
    const corrected = sample - blank
    return { value: round(corrected, 6), unit: "AU", display: fmt(round(corrected, 6), 6, "AU"), calculationSteps: [`${sample} − ${blank} = ${round(corrected, 6)} AU`], warnings: corrected < 0 ? ["Corrected absorbance is below zero; verify blank, cuvette, wavelength and sample measurements."] : undefined }
  },
  limitations: ["Blank correction is only the arithmetic subtraction supplied by the user; it does not validate the blank or analytical method."],
}

export const replicateStatisticsCalculator: CalculatorDefinition = {
  id: "spectro-replicate-statistics",
  name: "Spectrophotometry Replicate Statistics",
  shortName: "Replicate Stats",
  category: "spectrophotometry",
  subcategory: "photometric-quality",
  description: "Calculates mean, sample standard deviation and coefficient of variation from three replicate readings.",
  formula: "Mean = Σx/n; SD = sample standard deviation; CV% = SD/Mean × 100",
  keywords: ["replicates", "mean", "standard deviation", "CV", "precision", "photometric"],
  inputs: [
    { id: "reading1", label: "Reading 1", kind: "number", min: 0, step: 0.001, defaultValue: 0.500 },
    { id: "reading2", label: "Reading 2", kind: "number", min: 0, step: 0.001, defaultValue: 0.502 },
    { id: "reading3", label: "Reading 3", kind: "number", min: 0, step: 0.001, defaultValue: 0.498 },
  ],
  calculate: (inputs) => {
    const values = [num(inputs, "reading1"), num(inputs, "reading2"), num(inputs, "reading3")]
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (values.length - 1)
    const sd = Math.sqrt(variance)
    const cv = mean === 0 ? 0 : (sd / Math.abs(mean)) * 100
    return { value: round(mean, 6), display: `Mean: ${round(mean, 6)}`, secondary: [{ label: "Sample SD", value: String(round(sd, 6)) }, { label: "CV", value: `${round(cv, 3)}%` }], calculationSteps: [`Mean = (${values.join(" + ")}) ÷ 3 = ${round(mean, 6)}`, `SD = ${round(sd, 6)}`, `CV = (${round(sd, 6)} ÷ |${round(mean, 6)}|) × 100 = ${round(cv, 3)}%`] }
  },
  limitations: ["This tool summarizes three supplied measurements; it does not establish an acceptable precision limit for a method."],
}

export const calibrationRegressionCalculator: CalculatorDefinition = {
  id: "spectro-calibration-regression",
  name: "Spectrophotometry Calibration Regression",
  shortName: "Calibration Regression",
  category: "spectrophotometry",
  subcategory: "calibration-curves",
  description: "Performs an ordinary least-squares linear regression on five standards and estimates an unknown concentration from absorbance.",
  formula: "y = mx + b; R² = 1 − SSres/SStot; x = (y − b)/m",
  keywords: ["calibration", "linear regression", "least squares", "R²", "standard curve", "unknown"],
  inputs: [
    { id: "x1", label: "Standard 1 concentration", kind: "number", min: 0, step: 0.001, defaultValue: 0 }, { id: "y1", label: "Standard 1 absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0 },
    { id: "x2", label: "Standard 2 concentration", kind: "number", min: 0, step: 0.001, defaultValue: 2 }, { id: "y2", label: "Standard 2 absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.2 },
    { id: "x3", label: "Standard 3 concentration", kind: "number", min: 0, step: 0.001, defaultValue: 4 }, { id: "y3", label: "Standard 3 absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.4 },
    { id: "x4", label: "Standard 4 concentration", kind: "number", min: 0, step: 0.001, defaultValue: 6 }, { id: "y4", label: "Standard 4 absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.6 },
    { id: "x5", label: "Standard 5 concentration", kind: "number", min: 0, step: 0.001, defaultValue: 8 }, { id: "y5", label: "Standard 5 absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.8 },
    { id: "unknownAbsorbance", label: "Unknown absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.5 },
  ],
  calculate: (inputs) => {
    const x = [1,2,3,4,5].map(i => num(inputs, `x${i}`))
    const y = [1,2,3,4,5].map(i => num(inputs, `y${i}`))
    const unknown = num(inputs, "unknownAbsorbance")
    const xMean = x.reduce((a,b)=>a+b,0)/5
    const yMean = y.reduce((a,b)=>a+b,0)/5
    const ssxx = x.reduce((s, xi)=>s+(xi-xMean)**2,0)
    if (ssxx === 0) throw new Error("Standard concentrations must not all be identical.")
    const slope = x.reduce((s, xi, i)=>s+(xi-xMean)*(y[i]-yMean),0)/ssxx
    if (slope === 0) throw new Error("Calibration slope cannot be zero.")
    const intercept = yMean - slope*xMean
    const predicted = x.map(xi=>slope*xi+intercept)
    const ssres = y.reduce((s, yi, i)=>s+(yi-predicted[i])**2,0)
    const sstot = y.reduce((s, yi)=>s+(yi-yMean)**2,0)
    const r2 = sstot === 0 ? 1 : 1-ssres/sstot
    const concentration = (unknown-intercept)/slope
    return { value: round(concentration, 6), display: `Estimated concentration: ${round(concentration, 6)}`, secondary: [{label:"Slope (m)",value:String(round(slope,8))},{label:"Intercept (b)",value:String(round(intercept,8))},{label:"R²",value:String(round(r2,6))}], calculationSteps:[`Least-squares slope = ${round(slope,8)}`,`Intercept = ${round(intercept,8)}`,`R² = ${round(r2,6)}`,`(${unknown} − ${round(intercept,8)}) ÷ ${round(slope,8)} = ${round(concentration,6)}`], warnings: concentration < 0 ? ["Estimated concentration is below zero; review blank correction and calibration applicability."] : undefined }
  },
  limitations: ["This is an ordinary least-squares calculation on five supplied standards. It does not perform weighting, residual diagnostics, lack-of-fit testing, or method validation."],
}

export const photometricLinearityCalculator: CalculatorDefinition = {
  id: "spectro-photometric-linearity",
  name: "Photometric Linearity Check",
  shortName: "Linearity Check",
  category: "spectrophotometry",
  subcategory: "photometric-quality",
  description: "Compares an observed absorbance with an expected absorbance and reports percentage deviation.",
  formula: "Deviation (%) = (Observed − Expected) / Expected × 100",
  keywords: ["photometric linearity", "linearity", "deviation", "expected absorbance", "quality control"],
  inputs: [
    { id: "expectedAbsorbance", label: "Expected absorbance", kind: "number", min: 0.000001, step: 0.001, defaultValue: 1 },
    { id: "observedAbsorbance", label: "Observed absorbance", kind: "number", min: 0, step: 0.001, defaultValue: 0.98 },
  ],
  calculate: (inputs) => {
    const expected = num(inputs, "expectedAbsorbance")
    const observed = num(inputs, "observedAbsorbance")
    assertPositive(expected, "Expected absorbance")
    const deviation = ((observed-expected)/expected)*100
    return { value: round(deviation, 3), unit: "%", display: `Deviation: ${round(deviation, 3)}%`, secondary: [{label:"Absolute deviation",value:`${round(Math.abs(deviation),3)}%`}], calculationSteps:[`(${observed} − ${expected}) ÷ ${expected} × 100 = ${round(deviation,3)}%`], warnings:["No universal acceptance limit is applied. Compare the result with the instrument or method-specific validated criterion."] }
  },
}
