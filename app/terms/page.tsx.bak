import type { Metadata } from "next"
import Link from "next/link"
import { TERMS_LAST_UPDATED } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for using Clinexia, including how its clinical calculators may and may not be used.",
  alternates: { canonical: "/terms" },
}

const sections: { title: string; body: string[] }[] = [
  {
    title: "Using Clinexia",
    body: [
      "By using Clinexia you agree to these terms. If you do not agree, please do not use the app.",
      "Clinexia is a set of calculators, converters and reference tools for health and laboratory work. It is intended for qualified health and laboratory professionals and for students under supervision.",
    ],
  },
  {
    title: "Not medical advice, not a medical device",
    body: [
      "Clinexia provides calculations and estimates for educational and clinical reference use. It does not provide medical advice, diagnosis or treatment, and it does not replace the judgement of a qualified professional, local protocols, product information, a formulary or validated laboratory procedures.",
      "Dosing, oncology and stem-cell calculators produce calculation aids, not prescriptions or treatment orders. You are responsible for confirming the indication, patient population, route, formulation, maximum dose, current guideline and local protocol before acting on any result.",
    ],
  },
  {
    title: "Your responsibility",
    body: [
      "You are responsible for the values you enter and for how you use the results. Check inputs and units, and confirm important results independently or with a colleague.",
      "Please do not enter patient-identifying information into any calculator.",
    ],
  },
  {
    title: "Accuracy and sources",
    body: [
      "We work to keep formulas, reference ranges and dosing references accurate and to show their sources where available. Guidelines and product information change, and errors can occur. Clinexia is provided without any promise that it is complete, current or free of mistakes. If you find an error, please tell us.",
    ],
  },
  {
    title: "Availability and changes",
    body: [
      "The app may change, be interrupted or be withdrawn at any time. Features may become paid in the future; if that happens we will say so in the app. Offline use depends on your device having saved the app.",
    ],
  },
  {
    title: "Ownership",
    body: [
      "The Clinexia software, design and original content belong to its developer. You may use the app for your own professional or educational purposes. Please do not copy, resell or republish it, or present it as your own, without permission.",
    ],
  },
  {
    title: "Limits on our responsibility",
    body: [
      "To the extent the law allows, Clinexia and its developer are not liable for loss or harm arising from use of, or inability to use, the app or its results, including decisions made on the basis of a result. Nothing in these terms limits any responsibility that cannot be limited by law.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "If these terms change, the date above changes, and continued use means you accept the updated terms. Questions: contact the developer through nex.is-a.dev. How we handle data is explained in the Privacy Policy.",
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
      <p className="mt-2 text-sm text-muted-foreground">Clinexia · Last updated {TERMS_LAST_UPDATED}</p>

      {sections.map((section) => (
        <section key={section.title} className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="leading-7">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <p className="mt-10 text-sm">
        <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          Back to the app
        </Link>
      </p>
    </div>
  )
}
