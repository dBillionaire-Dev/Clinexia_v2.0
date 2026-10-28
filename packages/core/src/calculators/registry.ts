import type { CalculatorDefinition, CalculatorGroup } from "./types"
import { withDoseVolume } from "./dose-volume"
import { withCodingMetadata } from "./coding-metadata"
import {
  dailyWaterIntakeCalculator,
  estimatedDueDateCalculator,
  gestationalAgeCalculator,
  leanBodyMassCalculator,
  targetHeartRateCalculator,
  packYearsCalculator,
  alcoholUnitsCalculator,
} from "./definitions/everyday"
import { CALCULATOR_CATEGORY_LABELS } from "./types"
import {
  bmiCalculator,
  bsaCalculator,
  idealBodyWeightCalculator,
  bmrCalculator,
  adjustedBodyWeightCalculator,
  estimatedCalorieRequirementCalculator,
  waistToHeightRatioCalculator,
  waistToHipRatioCalculator,
} from "./definitions/clinical"
import {
  creatinineClearanceCalculator,
  egfrCalculator,
  bunCreatinineRatioCalculator,
  egfrMdrdCalculator,
  fenaCalculator,
  feureaCalculator,
} from "./definitions/renal"
import {
  ldlCalculator,
  nonHdlCalculator,
  vldlCalculator,
  anionGapCalculator,
  correctedCalciumCalculator,
  totalHdlRatioCalculator,
  calciumPhosphateProductCalculator,
  ldlHdlRatioCalculator,
  deltaRatioCalculator,
  estimatedOsmolalityCalculator,
  hba1cEagCalculator,
  correctedSodiumCalculator, correctedBunCalculator, correctedAlbuminAnionGapCalculator, creatinineUnitConversionCalculator,
} from "./definitions/chemistry"
import {
  // mcvCalculator,
  // mchCalculator,
  // mchcCalculator,
  redCellIndicesCalculator,
  absoluteCellCountCalculator,
  correctedWbcCalculator,
  hematocritEstimateCalculator,
  inrCalculator,
  correctedCountIncrementCalculator,
  estimatedBloodVolumeCalculator,
  internationalPrognosticIndexCalculator,
  reticulocyteProductionIndexCalculator,
  apttRatioCalculator,
  estimatedRbcTransfusionVolumeCalculator,
  revisedInternationalPrognosticIndexCalculator,
} from "./definitions/hematology"
import { molarityCalculator, normalityCalculator, c1v1c2v2Calculator, percentSolutionCalculator, molarityPreparationCalculator, reagentDilutionVolumeCalculator } from "./definitions/lab-solutions"
import { beerLambertCalculator, absorbanceTransmittanceCalculator, spectrophotometryStandardCurveCalculator, dilutionCorrectedSpectroConcentrationCalculator, wavelengthFrequencyCalculator, photonEnergyCalculator, wavenumberCalculator, blankCorrectedAbsorbanceCalculator, replicateStatisticsCalculator, calibrationRegressionCalculator, photometricLinearityCalculator } from "./definitions/spectrophotometry"
import {
  oncologyBsaDoseCalculator,
  oncologyDoseIntensityCalculator,
  oncologyRelativeDoseIntensityCalculator,
  oncologyCumulativeDoseCalculator,
  oncologyCycleTotalCalculator,
  carboplatinCalvertCalculator,
  oncologyDoseCapCalculator,
  oncologyRegimenDoseCalculator,
  oncologyHematologicModificationCalculator,
  oncologyOrganFunctionModificationCalculator,
  oncologyToxicitySafetyCalculator,
  oncologyAntiemeticRiskCalculator,
  oncologyFebrileNeutropeniaRiskCalculator,
  oncologyCycleProgressCalculator,
  oncologyCourseCompletionCalculator,
} from "./definitions/oncology"
import {
  cfuCalculator, dilutionFactorCalculator, concentrationAfterDilutionCalculator,
  serialDilutionFactorCalculator, concentrationAfterSerialDilutionCalculator, pooledCultureCfuCalculator,
} from "./definitions/microbiology"
import {
  meanArterialPressureCalculator, ejectionFractionCalculator, cha2ds2VascCalculator,
  daptScoreCalculator, qtcCalculator, atherogenicIndexCalculator,
  pulsePressureCalculator, cardiacIndexCalculator, hasBledCalculator, atrialFibrillationRateCalculator,
} from "./definitions/cardiovascular"
import {
  hctCiCalculator, conditioningDayCalculator, stemCellCollectionYieldCalculator,
  cd34CellDoseCalculator, neutrophilEngraftmentDayCalculator, donorChimerismCalculator,
  collectionTargetCalculator, viableCd34CellDoseCalculator, engraftmentDurationCalculator,
} from "./definitions/stem-cell-transplant"
import {
  mgPerKgDoseCalculator,
  oralLiquidDoseVolumeCalculator,
  tabletCapsuleCountCalculator,
  doseVolumeRoundingCalculator,
  mgPerKgDayCalculator,
  mgPerM2DoseCalculator,
  dosePerAdministrationCalculator,
  doseVolumeCalculator,
  drugConcentrationCalculator,
  infusionRateCalculator,
  dropsPerMinuteCalculator,
  maximumDoseCheckCalculator,
  artesunateSevereMalariaCalculator,
  artemetherLumefantrineCalculator,
  artesunateAmodiaquineCalculator,
  artesunateMefloquineCalculator,
  dihydroartemisininPiperaquineCalculator,
  artesunateSulfadoxinePyrimethamineCalculator,
  artesunatePyronaridineCalculator,
  amoxicillinPediatricCalculator,
  amoxicillinClavulanatePediatricCalculator,
  azithromycinPediatricCalculator,
  ceftriaxonePediatricCalculator,
  cephalexinPediatricCalculator,
  metronidazolePediatricCalculator,
  cefuroximeSurgicalProphylaxisCalculator,
  ampicillinPediatricCalculator,
  cefotaximePediatricCalculator,
  cloxacillinPediatricCalculator,
  ciprofloxacinPediatricCalculator,
  gentamicinPediatricCalculator,
  meropenemPediatricCalculator,
  vancomycinPediatricCalculator,
  amoxicillinClavulanateRenalAdjustmentCalculator,
  ciprofloxacinRenalAdjustmentCalculator,
  cefotaximeRenalAdjustmentCalculator,
  cefuroximeAxetilRenalAdjustmentCalculator,
  meropenemRenalAdjustmentCalculator,
  vancomycinAuc24TargetCalculator,
  gentamicinPeakTroughCheckerCalculator,
  whoYoungInfantSepsisPneumoniaCalculator,
  whoYoungInfantMeningitisCalculator,
  piperacillinTazobactamPediatricCalculator,
  clindamycinPediatricCalculator,
  cefazolinPediatricCalculator,
  linezolidPediatricCalculator,
  doxycyclinePediatricCalculator,
  loadingDoseCalculator,
  maintenanceDoseCalculator,
  infusionDurationCalculator,
  courseTotalDoseCalculator,
  whoPediatricPneumoniaRegimenCalculator,
  whoPediatricDiarrhoeaZincCalculator,
  whoPediatricOrsPlanBCalculator,
  whoPediatricOrsOngoingLossCalculator,
  whoPediatricMaintenanceFluidCalculator,
  pediatricFluidDeficitCalculator,
} from "./definitions/dosing"

const baseCalculators: CalculatorDefinition[] = [
  bmiCalculator,
  bsaCalculator,
  idealBodyWeightCalculator,
  bmrCalculator,
  adjustedBodyWeightCalculator,
  estimatedCalorieRequirementCalculator,
  waistToHeightRatioCalculator,
  waistToHipRatioCalculator,
  dailyWaterIntakeCalculator,
  estimatedDueDateCalculator,
  gestationalAgeCalculator,
  leanBodyMassCalculator,
  targetHeartRateCalculator,
  packYearsCalculator,
  alcoholUnitsCalculator,
  creatinineClearanceCalculator,
  egfrCalculator,
  bunCreatinineRatioCalculator,
  egfrMdrdCalculator,
  fenaCalculator,
  feureaCalculator,
  ldlCalculator,
  nonHdlCalculator,
  vldlCalculator,
  anionGapCalculator,
  correctedCalciumCalculator,
  totalHdlRatioCalculator,
  calciumPhosphateProductCalculator,
  ldlHdlRatioCalculator,
  deltaRatioCalculator,
  estimatedOsmolalityCalculator,
  hba1cEagCalculator,
  correctedSodiumCalculator, correctedBunCalculator, correctedAlbuminAnionGapCalculator, creatinineUnitConversionCalculator,
  // mcvCalculator,
  // mchCalculator,
  // mchcCalculator,
  redCellIndicesCalculator,
  absoluteCellCountCalculator,
  correctedWbcCalculator,
  hematocritEstimateCalculator,
  inrCalculator,
  correctedCountIncrementCalculator,
  estimatedBloodVolumeCalculator,
  internationalPrognosticIndexCalculator,
  reticulocyteProductionIndexCalculator,
  apttRatioCalculator,
  estimatedRbcTransfusionVolumeCalculator,
  revisedInternationalPrognosticIndexCalculator,
  molarityCalculator,
  normalityCalculator,
  c1v1c2v2Calculator,
  percentSolutionCalculator,
  molarityPreparationCalculator,
  reagentDilutionVolumeCalculator,
  beerLambertCalculator,
  absorbanceTransmittanceCalculator,
  spectrophotometryStandardCurveCalculator,
  dilutionCorrectedSpectroConcentrationCalculator,
  wavelengthFrequencyCalculator,
  photonEnergyCalculator,
  wavenumberCalculator,
  blankCorrectedAbsorbanceCalculator,
  replicateStatisticsCalculator,
  calibrationRegressionCalculator,
  photometricLinearityCalculator,
  cfuCalculator,
  dilutionFactorCalculator,
  concentrationAfterDilutionCalculator,
  serialDilutionFactorCalculator,
  concentrationAfterSerialDilutionCalculator,
  pooledCultureCfuCalculator,
  mgPerKgDoseCalculator,
  oralLiquidDoseVolumeCalculator,
  tabletCapsuleCountCalculator,
  doseVolumeRoundingCalculator,
  mgPerKgDayCalculator,
  mgPerM2DoseCalculator,
  dosePerAdministrationCalculator,
  doseVolumeCalculator,
  drugConcentrationCalculator,
  infusionRateCalculator,
  dropsPerMinuteCalculator,
  maximumDoseCheckCalculator,
  artesunateSevereMalariaCalculator,
  artemetherLumefantrineCalculator,
  artesunateAmodiaquineCalculator,
  artesunateMefloquineCalculator,
  dihydroartemisininPiperaquineCalculator,
  artesunateSulfadoxinePyrimethamineCalculator,
  artesunatePyronaridineCalculator,
  amoxicillinPediatricCalculator,
  amoxicillinClavulanatePediatricCalculator,
  azithromycinPediatricCalculator,
  ceftriaxonePediatricCalculator,
  cephalexinPediatricCalculator,
  metronidazolePediatricCalculator,
  cefuroximeSurgicalProphylaxisCalculator,
  ampicillinPediatricCalculator,
  cefotaximePediatricCalculator,
  cloxacillinPediatricCalculator,
  ciprofloxacinPediatricCalculator,
  gentamicinPediatricCalculator,
  meropenemPediatricCalculator,
  vancomycinPediatricCalculator,
  amoxicillinClavulanateRenalAdjustmentCalculator,
  ciprofloxacinRenalAdjustmentCalculator,
  cefotaximeRenalAdjustmentCalculator,
  cefuroximeAxetilRenalAdjustmentCalculator,
  meropenemRenalAdjustmentCalculator,
  vancomycinAuc24TargetCalculator,
  gentamicinPeakTroughCheckerCalculator,
  whoYoungInfantSepsisPneumoniaCalculator,
  whoYoungInfantMeningitisCalculator,
  piperacillinTazobactamPediatricCalculator,
  clindamycinPediatricCalculator,
  cefazolinPediatricCalculator,
  linezolidPediatricCalculator,
  doxycyclinePediatricCalculator,
  loadingDoseCalculator,
  maintenanceDoseCalculator,
  infusionDurationCalculator,
  courseTotalDoseCalculator,
  whoPediatricPneumoniaRegimenCalculator,
  whoPediatricDiarrhoeaZincCalculator,
  whoPediatricOrsPlanBCalculator,
  whoPediatricOrsOngoingLossCalculator,
  whoPediatricMaintenanceFluidCalculator,
  pediatricFluidDeficitCalculator,
  meanArterialPressureCalculator,
  ejectionFractionCalculator,
  cha2ds2VascCalculator,
  daptScoreCalculator,
  qtcCalculator,
  atherogenicIndexCalculator,
  pulsePressureCalculator,
  cardiacIndexCalculator,
  hasBledCalculator,
  atrialFibrillationRateCalculator,
  hctCiCalculator,
  conditioningDayCalculator,
  stemCellCollectionYieldCalculator,
  cd34CellDoseCalculator,
  neutrophilEngraftmentDayCalculator,
  donorChimerismCalculator,
  collectionTargetCalculator,
  viableCd34CellDoseCalculator,
  engraftmentDurationCalculator,
  oncologyBsaDoseCalculator,
  oncologyDoseIntensityCalculator,
  oncologyRelativeDoseIntensityCalculator,
  oncologyCumulativeDoseCalculator,
  oncologyCycleTotalCalculator,
  carboplatinCalvertCalculator,
  oncologyDoseCapCalculator,
  oncologyRegimenDoseCalculator,
  oncologyHematologicModificationCalculator,
  oncologyOrganFunctionModificationCalculator,
  oncologyToxicitySafetyCalculator,
  oncologyAntiemeticRiskCalculator,
  oncologyFebrileNeutropeniaRiskCalculator,
  oncologyCycleProgressCalculator,
  oncologyCourseCompletionCalculator,
]

/** Every calculator, with the optional product-strength inputs and mL-per-dose output added where they apply. */
export const calculators: CalculatorDefinition[] = baseCalculators.map(withDoseVolume).map(withCodingMetadata)

export function getCalculatorById(id: string): CalculatorDefinition | undefined {
  return calculators.find((c) => c.id === id)
}

export function getCalculatorsByCategory(category: CalculatorGroup): CalculatorDefinition[] {
  return calculators.filter((c) => c.category === category)
}

export function getRelatedCalculators(def: CalculatorDefinition): CalculatorDefinition[] {
  if (!def.relatedTools?.length) return []
  return def.relatedTools.map((id) => getCalculatorById(id)).filter((c): c is CalculatorDefinition => Boolean(c))
}

export function getRecommendedCalculators(def: CalculatorDefinition, limit = 6): CalculatorDefinition[] {
  const explicit = getRelatedCalculators(def)
  const explicitIds = new Set(explicit.map((c) => c.id))
  const tokens = new Set((def.keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean))

  const scored = calculators
    .filter((c) => c.id !== def.id && !explicitIds.has(c.id))
    .map((c) => {
      const sharedKeywords = (c.keywords ?? []).reduce((n, keyword) => n + (tokens.has(keyword.toLowerCase()) ? 1 : 0), 0)
      const sameSubcategory = Boolean(def.subcategory && c.category === def.category && c.subcategory === def.subcategory)
      const sameCategory = c.category === def.category
      return { c, score: sharedKeywords * 3 + (sameSubcategory ? 4 : 0) + (sameCategory ? 1 : 0) }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, Math.max(0, limit - explicit.length))
    .map(({ c }) => c)

  return [...explicit, ...scored].slice(0, limit)
}

export const calculatorCatalog: { id: CalculatorGroup; label: string; count: number }[] = (
  Object.keys(CALCULATOR_CATEGORY_LABELS) as CalculatorGroup[]
).map((id) => ({
  id,
  label: CALCULATOR_CATEGORY_LABELS[id],
  count: getCalculatorsByCategory(id).length,
}))

export const calculatorCategories = calculatorCatalog.filter((c) => c.count > 0)

export function getCalculatorsByCategoryAndSubcategory(category: CalculatorGroup, subcategory: string): CalculatorDefinition[] {
  return getCalculatorsByCategory(category).filter((calculator) => calculator.subcategory === subcategory)
}

export function searchCalculators(query: string): CalculatorDefinition[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return calculators.filter((c) => {
    const haystack = [c.name, c.shortName ?? "", c.description, ...(c.keywords ?? [])].join(" ").toLowerCase()
    return haystack.includes(q)
  })
}

export * from "./types"
