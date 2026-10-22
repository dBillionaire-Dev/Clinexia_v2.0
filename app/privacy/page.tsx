import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Clinexia stores on your device, what it keeps when you create an account, how payments, notifications and usage statistics work, and what it never collects.",
  alternates: { canonical: "/privacy" },
}

const LAST_UPDATED = "20 October 2026"

const collected: [string, string][] = [
  ["Installation ID", "A random identifier created on first use and kept on your device. It identifies an installation. Without an account it never identifies a person."],
  ["Which tool was used", "The calculator or converter id, its name and its category (for example “bmi”, “BMI”, “general”). Never the values you entered or the result."],
  ["When", "The time the tool was used and the time the app was last open."],
  ["App details", "The app version, whether it is the website, the installed web app or the Android app, and whether the device was offline."],
  ["A generated label", "A made-up device name (for example “User-4F2A91”) used in our own statistics. Without an account it is not your name."],
]

const account: [string, string][] = [
  ["Name and email", "What you enter when you register. Your email is used to sign in, to send the confirmation link, and to contact you about your account."],
  ["Password", "Handled by our sign-in provider (Supabase). It is stored in scrambled (hashed) form. We never see or store your password."],
  ["Profile", "Whether you work in healthcare and what describes you best (for example a laboratory scientist or a pharmacist). It is for your profile only and never changes what you can use."],
  ["Pricing region", "Whether you pay in naira or dollars. It is set at sign-up from the approximate country of your connection, which our host works out. We do not store your IP address for this."],
  ["Where you signed up", "The website, the Android app or the mobile website."],
  ["Sign-in", "A secure sign-in token, kept in a cookie on the website or in the app's private storage, so you stay signed in. Signing out removes it."],
  ["Dates and status", "When you registered and last signed in, and whether the account is active or suspended."],
]

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Clinexia · Last updated {LAST_UPDATED}</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">In short</h2>
        <p className="leading-7">
          You can use Clinexia without an account. The values you enter, your results, your history and your favorites stay on your
          device, with or without an account. Without an account the app sends only an anonymous usage count (which tool was used, never
          what you typed). If you create an account, we keep your name, email and plan, and we link the usage of your devices to your
          account so we can support you. We do not sell data, show ads or share it with advertisers.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">What stays on your device</h2>
        <p className="leading-7">
          Calculation history, favorites, recent searches and settings are stored in your browser or app storage and are not sent to us.
          Clearing the site data, clearing the app&apos;s storage or uninstalling the app removes them. Please do not enter
          patient-identifying information into any calculator.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Anonymous usage statistics</h2>
        <ul className="divide-y rounded-lg border">
          {collected.map(([k, v]) => (
            <li key={k} className="grid gap-1 p-3 sm:grid-cols-[11rem_1fr]">
              <span className="font-medium">{k}</span>
              <span className="text-sm text-muted-foreground">{v}</span>
            </li>
          ))}
        </ul>
        <p className="leading-7">
          <strong>We never collect:</strong> your location, contacts, photos, files, an advertising ID, hardware identifiers, anything you type
          into a calculator, any result, or any patient data.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">If you create an account</h2>
        <ul className="divide-y rounded-lg border">
          {account.map(([k, v]) => (
            <li key={k} className="grid gap-1 p-3 sm:grid-cols-[11rem_1fr]">
              <span className="font-medium">{k}</span>
              <span className="text-sm text-muted-foreground">{v}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Your devices are linked to your account</h2>
        <p className="leading-7">
          When you register or sign in on a device (the website or the Android app), the random installation ID of that device is linked to your
          account. From then on, our administrators see your name against that device and the history of which tools were used on it
          (tool names and times, never the values or results), including usage from before you registered. If you use several devices, each one
          is linked. We use this to give you support, run plans and payments, spot misuse and improve the tools. In the Android app you can turn
          off <em>Settings → Share anonymous usage statistics</em>; the app then does not send usage and does not link the device.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Plans and payments</h2>
        <p className="leading-7">
          Payments are handled by Paystack. Your card or bank details are entered on Paystack and are never seen or stored by Clinexia. We keep
          the payment reference, the amount and currency, the plan bought, its dates and the status. Some of these records must be kept for
          accounting and legal reasons even after an account is deleted.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Organisations</h2>
        <p className="leading-7">
          If you join an organisation, its owner and administrators can see your name, email, role, which specialties you can use and when you
          joined. They can invite and remove members and change what you can use. Invitation links are private and expire. You can leave an
          organisation at any time. Organisations do not see your calculations or your usage history.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Messages, review forms and notifications</h2>
        <ul className="list-disc space-y-2 pl-5 leading-7">
          <li><strong>In-app messages and review forms:</strong> we may show notices and short forms. Your answers are stored with your installation ID and, if you are signed in, linked to your account so we do not ask you twice. “Remind me later” is remembered on your account.</li>
          <li><strong>Phone notifications (Android app):</strong> if you turn them on, we store a notification address issued by Google&apos;s Firebase Cloud Messaging, with your installation ID and, if you are signed in, your account. We use it only to send you the notifications you agreed to. You can switch them off in Android settings.</li>
          <li><strong>Emails:</strong> the confirmation link when you register, and notices about your account such as a suspension, a restored account, a deleted account or a plan change.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Keeping the service safe</h2>
        <p className="leading-7">
          A small number of administrators can see account information to run the service and give support. If an account appears to be misused
          (for example a shared login, fraud or abuse) an administrator may suspend or delete it. We tell the person why. Deleting an account removes
          its profile, memberships, subscription and sign-in, and takes the person&apos;s name off the device records. Payment records are kept as
          explained above, and anonymous usage statistics that no longer name anyone may remain.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Why we collect it</h2>
        <p className="leading-7">
          To run accounts, plans and payments; to give support; to keep the service reliable and prevent misuse; to count how many installations
          are active and see which tools are used so we can improve them. Nothing else.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Where it is processed</h2>
        <p className="leading-7">
          The website is hosted on Vercel. Accounts, plans and statistics are stored in a Supabase database and sign-in is provided by Supabase.
          Payments go through Paystack, phone notifications through Google Firebase Cloud Messaging, and, when switched on, account emails through
          our email provider. Data travels over HTTPS and the database is reachable only from our server, never directly from your device. Like any
          web host, our providers may keep standard server logs (such as IP addresses) for a limited time for security and operations. We do not use
          those logs to identify you.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Your choices</h2>
        <ul className="list-disc space-y-2 pl-5 leading-7">
          <li><strong>Android app:</strong> turn off <em>Settings → Share anonymous usage statistics</em> at any time, and phone notifications in Android settings.</li>
          <li><strong>Reset your identifier:</strong> clear the site data (browser) or the app&apos;s storage, or reinstall. A new random ID is created (and, if you sign in again, linked to your account again).</li>
          <li><strong>See, correct or delete your account information:</strong> contact the developer (below) and we will do it. Deleting your account is permanent.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Children</h2>
        <p className="leading-7">Clinexia is a reference tool for health and laboratory work and is not directed at children. Accounts are for adults and professionals. We do not knowingly collect personal information from children.</p>
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
