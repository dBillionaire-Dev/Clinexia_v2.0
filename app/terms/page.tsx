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
    title: "Accounts",
    body: [
      "You can use many tools without an account. Some features need one. When you register you give a real email address and your name, keep your password to yourself, and keep your details up to date.",
      "An account is for one person. Do not share a login: organisations give each member of staff their own account. You are responsible for what happens under your account.",
    ],
  },
  {
    title: "Free use and limits without an account",
    body: [
      "Some tools are free and some are premium, and the app labels which is which. Without an account you can run a limited number of calculations on each device; after that you can keep browsing but you need an account to keep calculating. We may change which tools are free or premium and how many calculations guests get.",
    ],
  },
  {
    title: "Plans and payments",
    body: [
      "Premium tools are paid. You can buy access to the specialties you choose, or All-access. Prices are shown before you pay, in naira for Nigeria and in dollars elsewhere. Prices can change; a change applies to your next payment, not to one you have already made.",
      "Each payment covers one month and does not renew by itself, so to keep access you pay again. If you cancel, you keep access until the end of the month you paid for. Choosing a different plan starts a new month from the day you pay, and unused time on the old plan is not credited. After a plan ends there may be a short grace period.",
      "Payments are processed by Paystack. We never see or store your card details. If you think a payment was taken in error, contact us and we will look into it.",
    ],
  },
  {
    title: "Organisations",
    body: [
      "An organisation account is run by its owner, who chooses the plan and the number of seats, pays for it and invites staff. Owners and administrators can invite and remove members and decide which specialties each member can use. A seat is for one named person. An invitation reserves a seat until it is accepted, withdrawn or expires. The owner is responsible for the people they invite. Any discount for centrally managed organisations applies only after we have verified it.",
    ],
  },
  {
    title: "Messages and notifications",
    body: [
      "We may show notices and short review forms in the app and on the website, and, if you turn them on, send notifications to your phone. You can close them, and you can switch phone notifications off in your phone's settings.",
    ],
  },
  {
    title: "Suspension and deletion",
    body: [
      "We may suspend or delete an account that is misused, for example by sharing a login, fraud, abuse of the service or the payment system, or attempts to get around limits. We will tell you why. While an account is suspended you cannot sign in. Deleting an account is permanent: it removes the profile, memberships and subscription, and any paid time is lost. You can ask us to delete your account at any time.",
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
      "The app may change, be interrupted or be withdrawn at any time. Some tools are free and some are premium, as described above. Offline use depends on your device having saved the app.",
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
