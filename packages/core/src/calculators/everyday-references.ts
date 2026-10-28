import type { CalculatorReference } from "./dosing-references"

const VERIFIED_ON = "2026-10-13"

const ACOG_DUE_DATE: CalculatorReference = {
  source: "ACOG Committee Opinion No. 700: Methods for Estimating the Due Date (ACOG, AIUM, SMFM)",
  version: "May 2017 (reaffirmed 2022)",
  url: "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date",
  applicablePopulation: "Pregnancies dated from the last menstrual period. Early ultrasound dating, and the embryo transfer date after assisted reproduction, take precedence where available.",
  indication: "Estimating gestational age and the estimated due date (EDD).",
  lastVerified: VERIFIED_ON,
  status: "current",
  note: "Gestational age is counted from the first day of the last menstrual period; an average pregnancy is 280 days. Confirm there is no newer ACOG guidance.",
}

export const EVERYDAY_REFERENCES: Record<string, CalculatorReference> = {
  "daily-water-intake": {
    source: "EFSA Panel on Dietetic Products, Nutrition and Allergies (NDA): Scientific Opinion on Dietary Reference Values for water",
    version: "EFSA Journal 2010;8(3):1459",
    url: "https://doi.org/10.2903/j.efsa.2010.1459",
    applicablePopulation: "Healthy people aged 2 years and over, at moderate environmental temperature and moderate physical activity.",
    indication: "Adequate intake of total water (all drinks plus water in food).",
    lastVerified: VERIFIED_ON,
    status: "current",
    note: "Adequate intakes, not requirements. Pregnancy adds 300 mL/day and breastfeeding about 700 mL/day to the adult female value.",
  },
  "estimated-due-date": ACOG_DUE_DATE,
  "gestational-age": ACOG_DUE_DATE,
  "lean-body-mass": {
    source: "Boer P. Estimated lean body mass as an index for normalization of body fluid volumes in humans. Am J Physiol 1984;247(4):F632-F635",
    version: "1984 prediction equations",
    applicablePopulation: "Adults. Not for children.",
    indication: "Estimating lean body mass from sex, weight and height.",
    lastVerified: VERIFIED_ON,
    status: "current",
  },
  "target-heart-rate": {
    source: "Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. J Am Coll Cardiol 2001;37(1):153-156",
    version: "2001 (HRmax = 208 - 0.7 x age)",
    url: "https://pubmed.ncbi.nlm.nih.gov/11153730/",
    applicablePopulation: "Healthy adults. The equation was independent of sex and habitual activity; individual maximum heart rate varies by about 10 beats per minute or more around the estimate.",
    indication: "Estimating maximum heart rate; target rates use the heart rate reserve (Karvonen) method.",
    lastVerified: VERIFIED_ON,
    status: "current",
  },
  "pack-years": {
    source: "US Preventive Services Task Force: Screening for Lung Cancer (JAMA 2021;325(10):962-970)",
    version: "March 2021",
    url: "https://uspreventiveservicestaskforce.org/uspstf/recommendation/lung-cancer-screening",
    applicablePopulation: "Adults who smoke or have smoked cigarettes. The screening criteria quoted apply to ages 50 to 80.",
    indication: "Quantifying cumulative cigarette exposure. One pack-year is 20 cigarettes per day for one year.",
    lastVerified: VERIFIED_ON,
    status: "current",
    note: "Screening eligibility rules change; check current local guidance.",
  },
  "alcohol-units": {
    source: "UK Chief Medical Officers' Low Risk Drinking Guidelines",
    version: "2016",
    url: "https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/545937/UK_CMOs__report.pdf",
    applicablePopulation: "Adults. One UK unit is 10 mL (8 g) of pure alcohol. Other countries define units and standard drinks differently.",
    indication: "Converting a drink's volume and strength into UK units.",
    lastVerified: VERIFIED_ON,
    status: "current",
    note: "The guideline describes low-risk drinking, not safe drinking. If pregnant or planning a pregnancy, the safest approach is not to drink alcohol.",
  },
}
