// clinexia-upgrade:phase8 — plain-language explanations for patients.
//
// Rules for everything in this file (a test enforces most of them):
//  - General information only. It explains WHAT a number is. It never tells the reader what to do about their own number,
//    never mentions a dose, and never starts, stops or changes treatment.
//  - Short sentences and common words. Average reading level: school grade 9 or lower.
//  - Each explanation is hidden until a clinician approves "patient:<tool id>" in review.ts.
//  - {result} is replaced with the result the person is looking at.

import { isReleased } from "./review"

export interface PatientExplanation {
  id: string
  title: string
  whatItIs: string
  howToRead: string
  limits: string
  questions: string[]
}

export const PATIENT_DISCLAIMER =
  "This is general information, not medical advice and not a diagnosis. Do not start, stop or change any medicine because of it. Talk to your doctor, nurse or pharmacist about your own results."

export const PATIENT_EXPLANATIONS: PatientExplanation[] = [
  {
    id: "bmi",
    title: "About your BMI",
    whatItIs: "BMI stands for body mass index. It is a number worked out from your weight and height. Your result is {result}.",
    howToRead: "Doctors use BMI as a quick check. A higher or lower number can be a sign to look at your health more closely. It does not tell muscle from fat, so it is not right for everyone.",
    limits: "BMI does not measure body fat directly. It can be less accurate for athletes, older adults and pregnant women. Children use different charts.",
    questions: ["What does my BMI mean for my health?", "Are there other measures that matter more for me, such as my waist size?"],
  },
  {
    id: "egfr-ckd-epi",
    title: "About your eGFR",
    whatItIs: "eGFR is an estimate of how well your kidneys clean your blood. It is worked out from a blood test called creatinine, your age and your sex. Your result is {result}.",
    howToRead: "A lower number can mean your kidneys are not cleaning the blood as well. One result is not enough to say there is kidney disease. Doctors look at results over time, and often a urine test too.",
    limits: "It is an estimate. Muscle size, what you eat and some medicines can change the creatinine test, and so the estimate.",
    questions: ["Do I need to repeat this test?", "Could any of my medicines affect my kidneys?"],
  },
  {
    id: "hba1c-eag",
    title: "About your HbA1c",
    whatItIs: "HbA1c is a blood test that shows your average blood sugar over the last two to three months. The average glucose number turns it into the units used by a finger-prick meter. Your result is {result}.",
    howToRead: "Your care team uses it to see how your blood sugar has been over time. Your own target may be different from someone else's.",
    limits: "It is an average, so it can hide high and low sugars during the day. Some blood conditions make HbA1c less accurate.",
    questions: ["What HbA1c target is right for me?", "How often should I have this test?"],
  },
  {
    id: "ldl-friedewald",
    title: "About your LDL cholesterol",
    whatItIs: "LDL cholesterol is one kind of fat in your blood. This number is worked out from other results in your cholesterol test. It is not measured directly. Your result is {result}.",
    howToRead: "Over many years, a higher LDL level is linked to a higher chance of heart disease and stroke. Doctors look at LDL together with your age, blood pressure, smoking and other health details.",
    limits: "It is a calculation. When triglycerides are high, the calculation may not be reliable, and a direct LDL test may be better.",
    questions: ["What LDL level should I aim for?", "Do I need a direct LDL test?"],
  },
  {
    id: "ldl-sampson",
    title: "About your LDL cholesterol",
    whatItIs: "LDL cholesterol is one kind of fat in your blood. This number is an estimate worked out from other results in your cholesterol test. Your result is {result}.",
    howToRead: "Over many years, a higher LDL level is linked to a higher chance of heart disease and stroke. Doctors look at LDL together with your age, blood pressure, smoking and other health details.",
    limits: "It is an estimate, not a direct measurement. A direct LDL test is the better choice when it is available, especially when triglycerides are high.",
    questions: ["What LDL level should I aim for?", "Do I need a direct LDL test?"],
  },
  {
    id: "cha2ds2-vasc",
    title: "About your CHA2DS2-VASc score",
    whatItIs: "This is a points score for people who have atrial fibrillation, an uneven heart rhythm. It estimates the chance of a stroke. Your score is {result}. Points are given for things like age, high blood pressure, diabetes, heart failure and an earlier stroke.",
    howToRead: "A higher score means a higher chance of stroke. Doctors use the score, with your other health details, to talk with you about ways to lower that chance.",
    limits: "The score is only one part of the choice. Your doctor will also think about your chance of bleeding and about what matters to you.",
    questions: ["What does my score mean for me?", "What are the good and bad points of each choice for me?"],
  },
  {
    id: "has-bled",
    title: "About your HAS-BLED score",
    whatItIs: "This is a points score for people with atrial fibrillation who may take a blood thinner. It estimates the chance of serious bleeding. Your score is {result}. Points are given for things like high blood pressure, kidney or liver problems, earlier bleeding, age, some medicines and alcohol.",
    howToRead: "A higher score means a higher chance of bleeding. Doctors use it to find things that can be improved, such as blood pressure. It is not used on its own to make the choice about a blood thinner.",
    limits: "The score describes groups of people. It is not a forecast for you. Your doctor will think about it together with your other health details.",
    questions: ["Which of these points can I improve?", "How will you watch for bleeding?"],
  },
  {
    id: "mean-arterial-pressure",
    title: "About your mean arterial pressure",
    whatItIs: "Mean arterial pressure, or MAP, is the average pressure in your blood vessels during one heartbeat. It is worked out from your two blood pressure numbers. Your result is {result}.",
    howToRead: "Doctors use it to check that your organs, such as the brain and kidneys, are getting enough blood. It is mostly used in hospitals for people who are very ill.",
    limits: "It is a calculated number. Your care team will also look at your usual blood pressure and at how you feel.",
    questions: ["What blood pressure should I aim for?", "How often should my blood pressure be checked?"],
  },
]

export interface RenderedExplanation {
  id: string
  title: string
  sections: Array<{ heading: string; text: string }>
  questions: string[]
  disclaimer: string
  /** Plain text for the copy button. */
  copyText: string
}

export interface ResultLike {
  display?: string
  value?: string | number
  unit?: string
}

export function fillResult(text: string, result: ResultLike): string {
  const shown = result.display?.trim() || (result.value !== undefined ? `${result.value}${result.unit ? ` ${result.unit}` : ""}` : "shown above")
  return text.replaceAll("{result}", shown)
}

/** The rendered explanation, or null when this tool has none or a clinician has not approved it yet. */
export function getPatientExplanation(id: string, result: ResultLike): RenderedExplanation | null {
  const e = PATIENT_EXPLANATIONS.find((x) => x.id === id)
  if (!e || !isReleased(`patient:${id}`)) return null
  const sections = [
    { heading: "What this is", text: fillResult(e.whatItIs, result) },
    { heading: "How doctors use it", text: e.howToRead },
    { heading: "Things to know", text: e.limits },
  ]
  const copyText = [e.title, ...sections.map((s) => `${s.heading}: ${s.text}`), "Questions you could ask:", ...e.questions.map((q) => `- ${q}`), PATIENT_DISCLAIMER].join("\n")
  return { id, title: e.title, sections, questions: e.questions, disclaimer: PATIENT_DISCLAIMER, copyText }
}
