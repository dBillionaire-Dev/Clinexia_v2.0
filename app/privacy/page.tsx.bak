import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Clinexia stores on your device, the anonymous usage statistics it sends, and what it never collects.",
  alternates: { canonical: "/privacy" },
}

const LAST_UPDATED = "8 October 2026"

const collected: [string, string][] = [
  ["Installation ID", "A random identifier created on first use and kept on your device. It identifies an installation, never a person."],
  ["Which tool was used", "The calculator or converter id, its name and its category (for example “bmi”, “BMI”, “general”). Never the values you entered or the result."],
  ["When", "The time the tool was used and the time the app was last open."],
  ["App details", "The app version, whether it is the website, the installed web app or the Android app, and whether the device was offline."],
  ["A generated label", "A made-up device name (for example “Device 4821”) used in our own statistics. It is not your name."],
]

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Clinexia · Last updated {LAST_UPDATED}</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">In short</h2>
        <p className="leading-7">
          Clinexia has no accounts. The values you enter, your results, your history and your favorites stay on your device.
          The app sends only an anonymous usage count (which tool was used, never what you typed) so we can see how many people
          use it and which tools matter. We do not sell data, show ads or share it with advertisers.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">What stays on your device</h2>
        <p className="leading-7">
          Calculation history, favorites, recent searches and settings are stored in your browser or app storage and are not sent
          to us. Clearing the site data, clearing the app&apos;s storage or uninstalling the app removes them. Please do not enter
          patient-identifying information into any calculator.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Anonymous usage statistics we collect</h2>
        <ul className="divide-y rounded-lg border">
          {collected.map(([k, v]) => (
            <li key={k} className="grid gap-1 p-3 sm:grid-cols-[11rem_1fr]">
              <span className="font-medium">{k}</span>
              <span className="text-sm text-muted-foreground">{v}</span>
            </li>
          ))}
        </ul>
        <p className="leading-7">
          <strong>We do not collect:</strong> your name, email address, phone number, location, contacts, photos, files, an account,
          an advertising ID, hardware identifiers, anything you type into a calculator, any result, or any patient data.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Why we collect it</h2>
        <p className="leading-7">
          To count how many installations are active, to see which tools are used so we can improve them, and to keep the service
          reliable. Nothing else.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Where it is processed</h2>
        <p className="leading-7">
          The website is hosted on Vercel and the statistics are stored in a Supabase database. Data travels over HTTPS and the
          database is reachable only from our server, never directly from your device. Like any web host, our providers may keep
          standard server logs (such as IP addresses) for a limited time for security and operations. We do not use those logs to
          identify you.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Your choices</h2>
        <ul className="list-disc space-y-2 pl-5 leading-7">
          <li><strong>Android app:</strong> turn off <em>Settings → Share anonymous usage statistics</em> at any time.</li>
          <li><strong>Reset your identifier:</strong> clear the site data (browser) or the app&apos;s storage, or reinstall. A new random ID is created.</li>
          <li><strong>Ask a question or request removal:</strong> contact the developer (below). Because the ID is random and not linked to you, we may need the installation ID to find records.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Children</h2>
        <p className="leading-7">Clinexia is a reference tool for health and laboratory work and is not directed at children. We do not knowingly collect personal information from anyone.</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Medical disclaimer</h2>
        <p className="leading-7">
          Clinexia provides calculations and estimates for educational and clinical reference use. It is not a medical device and does
          not replace clinical judgement, local protocols, product information or validated laboratory procedures. Always verify results
          before acting on them.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Changes and contact</h2>
        <p className="leading-7">
          If this policy changes, the date above changes. Questions or requests: contact the developer through{" "}
          <a className="font-medium text-primary underline-offset-4 hover:underline" href="https://nex.is-a.dev/" target="_blank" rel="noopener noreferrer">nex.is-a.dev</a>.
        </p>
      </section>

      <p className="mt-10 text-sm"><Link href="/" className="text-primary underline-offset-4 hover:underline">Back to the app</Link></p>
    </div>
  )
}
