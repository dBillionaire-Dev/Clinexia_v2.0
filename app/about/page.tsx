import type { Metadata } from "next"
import Link from "next/link"
import {
  Activity, ArrowLeftRight, ArrowRight, Atom, Baby, BookOpenText, Calculator, Code2, Droplets, FlaskConical, Gauge, HeartPulse,
  History, Microscope, Monitor, Moon, Pill, Plug, Search, ShieldCheck, Smartphone, Sparkles, Star, Syringe, TestTube, WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { calculatorCatalog, calculators } from "@/lib/calculators/registry"
import { getCalculatorReferences } from "@/lib/calculators/dosing-references"
import { conversionCategories } from "@/lib/conversions/registry"
import { CLINICAL_REVIEWS } from "@/lib/clinical/review"
import { CLINICAL_MODULE_REVIEWS } from "@/lib/calculators/clinical-modules/review"

const TITLE = "About Clinexia: Clinical Calculators, Drug Dosing and Offline Medical Toolkit"
const DESCRIPTION =
  "Clinexia is a free-to-try clinical toolkit: medical calculators, drug dosing in mg and mL, unit conversions and lab tools. Offline-ready, shows its working. Built by NexDev."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/about", type: "website", images: [{ url: "/og-image.png", alt: "About Clinexia, the clinical toolkit" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og-image.png"] },
}

const DEVELOPER_URL = "https://nex.is-a.dev/"
const GITHUB_URL = "https://github.com/dBillionaire-Dev"

const A = "font-medium text-primary underline-offset-4 hover:underline"

/** Icon and a few examples for each calculator category. The site uses one blue, so every category shares it. */
const CATEGORY_STYLE: Record<string, { Icon: typeof Calculator; examples: string[] }> = {
  general: { Icon: Activity, examples: ["BMI", "Body surface area", "Ideal body weight", "Estimated due date", "Daily water intake"] },
  renal: { Icon: Droplets, examples: ["eGFR (CKD-EPI 2021)", "Cockcroft-Gault clearance", "FENa and FEUrea", "BUN/creatinine ratio"] },
  chemistry: { Icon: TestTube, examples: ["Anion gap", "Corrected calcium", "LDL (Friedewald and Sampson)", "Serum osmolality", "HbA1c to average glucose"] },
  hematology: { Icon: Syringe, examples: ["Red cell indices (MCV, MCH, MCHC)", "Corrected WBC count", "INR", "Reticulocyte production index", "Transfusion volume"] },
  microbiology: { Icon: Microscope, examples: ["CFU/mL estimation", "Dilution factor", "Serial dilution total factor"] },
  "lab-solutions": { Icon: FlaskConical, examples: ["Molarity", "Normality", "C1V1 = C2V2 dilution", "Percent solutions"] },
  spectrophotometry: { Icon: Atom, examples: ["Beer–Lambert law", "Standard curves", "Absorbance and transmittance", "Photometric linearity check"] },
  dosing: { Icon: Pill, examples: ["Weight-based dose (mg/kg)", "Dose to volume (mL)", "Infusion rate and IV drops per minute", "Antimalarial regimens", "Pediatric antibiotic doses"] },
  oncology: { Icon: Sparkles, examples: ["BSA-based chemotherapy dose", "Carboplatin (Calvert)", "Dose intensity", "Emetogenic risk"] },
  cardiovascular: { Icon: HeartPulse, examples: ["Mean arterial pressure", "CHA₂DS₂-VASc", "HAS-BLED", "QTc correction", "Cardiac index"] },
  "stem-cell-transplant": { Icon: Baby, examples: ["CD34+ cell dose", "Neutrophil engraftment timing", "Donor chimerism", "HCT comorbidity index"] },
}

type Approved = { key: string; reviewer: string; credentials: string; reviewedAt: string; scope: string }

/** Read straight from the two review registers, so this page can never claim a review that the code does not record. */
function reviewSummary() {
  const approved: Approved[] = []
  let pending = 0
  for (const [key, r] of [...Object.entries(CLINICAL_REVIEWS), ...Object.entries(CLINICAL_MODULE_REVIEWS)]) {
    if (r.status === "approved") approved.push({ key, reviewer: r.reviewer, credentials: r.credentials, reviewedAt: r.reviewedAt, scope: r.scope })
    else pending += 1
  }
  approved.sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
  return { approved, pending }
}

function referenceSummary() {
  let withReference = 0
  let current = 0
  for (const c of calculators) {
    const refs = getCalculatorReferences(c)
    if (refs.length) withReference += 1
    if (refs.some((r) => r.status === "current")) current += 1
  }
  return { withReference, current }
}

const formatDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

export default function AboutPage() {
  const { approved, pending } = reviewSummary()
  const refs = referenceSummary()
  const latestReview = approved[0]?.reviewedAt
  const categories = calculatorCatalog.filter((c) => c.count > 0)
  const total = calculators.length
  const estimators = calculators.filter((c) => c.isEstimator).length
  // The conversion categories, plus the three dedicated converters (height, mass-volume, molar-mass).
  const converters = conversionCategories.length + 3

  const stats = [
    { value: total, label: "calculators" },
    { value: categories.length, label: "specialty areas" },
    { value: converters, label: "converters" },
    { value: 5, label: "lab bench tools" },
  ]

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": "https://www.clinexia.app/about",
        url: "https://www.clinexia.app/about",
        name: "About Clinexia",
        description: DESCRIPTION,
        inLanguage: "en",
        dateModified: "2026-11-02",
        about: { "@id": "https://www.clinexia.app/#app" },
        publisher: { "@id": `${DEVELOPER_URL}#nexdev` },
        breadcrumb: { "@id": "https://www.clinexia.app/about#breadcrumb" },
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://www.clinexia.app/about#breadcrumb",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Clinexia", item: "https://www.clinexia.app/" },
          { "@type": "ListItem", position: 2, name: "About", item: "https://www.clinexia.app/about" },
        ],
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.clinexia.app/#app",
        name: "Clinexia",
        url: "https://www.clinexia.app/",
        applicationCategory: "HealthApplication",
        operatingSystem: "Web, Android, Windows",
        description: DESCRIPTION,
        featureList: [
          `${total} clinical calculators across ${categories.length} specialty areas`,
          "Drug dosing with mg per dose and mL per dose",
          "Unit conversions including height (cm, m, ft, in) and laboratory units",
          "Laboratory tools: dilution, serial dilution, percentage solutions, microbiology, spectrophotometry",
          "Works offline and installs as an app",
          "Formula, limitations and versioned source shown on every calculator",
          "API, embeddable calculators and SMART on FHIR launcher for developers",
        ],
        author: { "@id": `${DEVELOPER_URL}#nexdev` },
      },
      {
        "@type": "Organization",
        "@id": `${DEVELOPER_URL}#nexdev`,
        name: "NexDev",
        url: DEVELOPER_URL,
        sameAs: [GITHUB_URL],
      },
    ],
  }

  return (
    <div className="bg-background text-foreground pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />For clinicians, nurses, pharmacists, laboratory staff and students
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">About Clinexia</h1>
          <p className="mt-3 text-xl font-medium text-primary sm:text-2xl">The clinical toolkit that is fast, shows its working, and is still there when the network is not.</p>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            Clinexia is a client-side progressive web application designed by{" "}
            <a className={A} href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer">Ebenezer Ekunke</a>.
            It gathers the calculations healthcare and laboratory teams repeat every day into one place: medical calculators, drug dosing in mg and mL,
            unit conversions, bench tools and reference ranges, all running in your browser.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg"><Link href="/">Open the web app<ArrowRight className="ml-2 h-4 w-4" aria-hidden /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/calculators">Browse all calculators</Link></Button>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border bg-card p-4">
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-3xl font-bold text-primary">{s.value}</dd>
                <dd className="text-sm text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-4 pt-14">
        {/* WHY */}
        <section className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Why it exists</p>
          <h2 className="text-3xl font-bold tracking-tight">Built for the bench and the bedside</h2>
          <p className="max-w-3xl leading-7 text-muted-foreground">
            Clinical work is full of small calculations: a dose in mg per kg that has to become mL from the bottle in your hand, an eGFR, a dilution, a
            unit that arrives in the wrong system. Doing them by hand is slow and a slip can matter. Clinexia puts them behind clean inputs,
            validates what you type, shows the formula it used, and keeps working when the connection drops, which in many wards and laboratories is the normal state.
          </p>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Clinexia supports professional judgment and does not replace it. It is a calculation and reference utility, not a medical device.
          </p>
        </section>

        {/* CATEGORIES */}
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">What is inside</p>
            <h2 className="text-3xl font-bold tracking-tight">{total} calculators across {categories.length} specialty areas</h2>
            <p className="max-w-3xl text-muted-foreground">
              From a quick BMI to chemotherapy dosing and stem cell transplant tracking. {estimators} of them are estimators and are labelled as estimates.
              A few examples from each area:
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {categories.map((c) => {
              const style = CATEGORY_STYLE[c.id] ?? { Icon: Calculator, examples: [] }
              return (
                <li key={c.id} className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/50">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><style.Icon className="h-5 w-5" aria-hidden /></span>
                    <div>
                      <h3 className="font-semibold leading-tight">
                        <Link href={`/calculators/${c.id}`} className="hover:underline">{c.label}</Link>
                      </h3>
                      <p className="text-xs text-muted-foreground">{c.count} calculator{c.count === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  {style.examples.length ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {style.examples.map((e) => (
                        <li key={e} className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">{e}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>

        {/* DOSING */}
        <section className="rounded-2xl border bg-muted/40 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Pill className="h-6 w-6" aria-hidden /></span>
            <h2 className="text-2xl font-bold tracking-tight">Drug dosing: from mg to the mL you draw up</h2>
          </div>
          <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
            Dosing is where a unit slip hurts most, so Clinexia gives you both numbers that matter: the mg per dose and the mL per dose from the strength of the product you hold.
            Weight-based, body-surface-area-based and fixed doses are supported, with safety checks on maximum doses and input ranges.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Everyday dosing maths", "mg/kg and mg/kg/day, mg/m², dose to volume, infusion rate, IV drops per minute, loading and maintenance doses, course totals."],
              ["Antimalarial regimens", "Artemisinin-based combinations for uncomplicated malaria and artesunate for severe malaria, by weight."],
              ["Pediatric antibiotics", "Weight-based doses for commonly used antibiotics, plus WHO regimens for young infants, diarrhoea, ORS and maintenance fluids."],
              ["Renal adjustment and monitoring", "Renal dose adjustment for selected antibiotics and therapeutic drug monitoring checks for vancomycin and gentamicin."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-lg border bg-card p-4">
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5"><Link href="/calculators/dosing" className={A}>Explore drug dosing calculators <ArrowRight className="inline h-4 w-4" aria-hidden /></Link></p>
        </section>

        {/* CONVERSIONS + LAB */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ArrowLeftRight className="h-6 w-6" aria-hidden /></span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Unit conversions that get the details right</h2>
            <p className="mt-2 leading-7 text-muted-foreground">
              {converters} converters cover mass, volume, length, temperature, pressure, energy, time and concentration, plus three specialist ones:
              a <Link href="/conversions/height" className={A}>height converter</Link> (cm, m, mm, feet, inches and feet + inches),
              a <Link href="/conversions/mass-volume" className={A}>mass to volume converter</Link> that uses density by substance instead of assuming 1 g = 1 mL,
              and a <Link href="/conversions/molar-mass" className={A}>molar to mass concentration converter</Link> (mg/dL to mmol/L) by analyte.
            </p>
            <p className="mt-3"><Link href="/conversions" className={A}>See all conversions <ArrowRight className="inline h-4 w-4" aria-hidden /></Link></p>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><FlaskConical className="h-6 w-6" aria-hidden /></span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Lab tools for the bench</h2>
            <p className="mt-2 leading-7 text-muted-foreground">
              Dilution (C1V1 = C2V2), serial dilution with the concentration at every step, percentage solutions (w/v, v/v, w/w), microbiology
              (CFU/mL, dilution factors, McFarland standards) and spectrophotometry (Beer–Lambert, standard curves, blank correction).
              Molarity and normality calculators sit alongside them.
            </p>
            <p className="mt-3"><Link href="/lab-tools" className={A}>Open lab tools <ArrowRight className="inline h-4 w-4" aria-hidden /></Link></p>
          </div>
        </section>

        {/* SHOWS ITS WORKING */}
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Trust, built in</p>
            <h2 className="text-3xl font-bold tracking-tight">It shows its working</h2>
            <p className="max-w-3xl text-muted-foreground">A number you cannot check is a number you cannot trust. Every calculator is designed so you can see where the answer came from.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: BookOpenText, t: "Formula on screen", d: "The formula, notes and limitations sit beside the result." },
              { Icon: Gauge, t: "Versioned sources", d: "Each calculator lists its source, the version used and when it was last verified." },
              { Icon: History, t: "Public changelog", d: "Every calculator has a formula version. A behaviour change needs a version bump and a changelog entry." },
              { Icon: ShieldCheck, t: "Tested", d: "Recorded test cases for every calculator catch an unnoticed change before release." },
            ].map(({ Icon, t, d }) => (
              <li key={t} className="rounded-xl border bg-card p-5">
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {refs.withReference} of {total} calculators have a recorded reference, {refs.current} of them marked current. Formulas and reference ranges are collected on the{" "}
            <Link className={A} href="/reference">Reference Ranges and Formulas</Link> page. Spotted an error or an out-of-date source? Tell us through the feedback option in the app.
          </p>
        </section>

        {/* EVERYWHERE */}
        <section className="rounded-2xl border bg-muted/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Everywhere you work</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight">Offline-first, installable, quick to search</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { Icon: WifiOff, t: "Works offline", d: "Open it once and keep calculating without a connection." },
              { Icon: Smartphone, t: "Install it", d: "Add it to your phone or computer as an app. Android and Windows apps are linked from the home page when available." },
              { Icon: Search, t: "Find a tool in seconds", d: "A command palette (Ctrl or ⌘ + K) searches every calculator, converter and lab tool, and forgives typos." },
              { Icon: Star, t: "Favorites, recents and history", d: "Pin the tools you use daily. Your history and favorites stay on your device." },
              { Icon: Moon, t: "Light and dark", d: "Comfortable in a bright lab or a dim night shift." },
              { Icon: Monitor, t: "Any screen", d: "A layout that adapts from a small phone to a desktop monitor." },
            ].map(({ Icon, t, d }) => (
              <li key={t} className="rounded-xl border bg-card p-5">
                <Icon className="h-6 w-6 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* WHO */}
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Who uses it</p>
            <h2 className="text-3xl font-bold tracking-tight">One toolkit, many roles</h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Nurses and clinicians", "Doses, infusion rates, eGFR and scores at the bedside."],
              ["Pharmacists", "mg and mL per dose, renal adjustment, therapeutic drug monitoring."],
              ["Laboratory scientists", "Dilutions, solutions, indices, spectrophotometry and unit conversions."],
              ["Students", "See the formula, the limits and the source while you learn."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-xl border border-t-4 border-t-primary bg-card p-5">
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* DEVELOPERS: two per row on large screens, one per row on small */}
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">For teams and developers</p>
            <h2 className="text-3xl font-bold tracking-tight">Clinexia inside the software you already use</h2>
            <p className="max-w-3xl text-muted-foreground">
              The same calculation code powers every integration, so a number is the same everywhere. These integrations are designed not to log or store the values you send.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              { Icon: Code2, t: "API", d: "Run calculators and conversions from your own software." },
              { Icon: Plug, t: "Embeds and deep links", d: "Embed a calculator on a page, or open one with values prefilled." },
              { Icon: Activity, t: "SMART on FHIR and CDS Hooks", d: "Launch from an electronic health record and surface calculations in the clinical workflow." },
              { Icon: FlaskConical, t: "Laboratory systems", d: "Reference adapters for HL7 laboratory results." },
            ].map(({ Icon, t, d }) => (
              <li key={t} className="flex gap-4 rounded-xl border bg-card p-5">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
                <div>
                  <h3 className="font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ul>
          <p><Link href="/developers" className={A}>Read the developer documentation <ArrowRight className="inline h-4 w-4" aria-hidden /></Link></p>
        </section>

        {/* CLINICAL REVIEW */}
        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Clinical review</p>
            <h2 className="text-3xl font-bold tracking-tight">Named reviewers, recorded dates</h2>
            <p className="max-w-3xl text-muted-foreground">
              Content that goes beyond a plain calculation is released only after a named person has reviewed it. Each review records who reviewed it, their credentials, the date and exactly what was reviewed.
              Latest recorded clinical review: <strong className="text-foreground">{latestReview ? formatDate(latestReview) : "none yet"}</strong>.
              {pending > 0 ? ` ${pending} item${pending === 1 ? " is" : "s are"} still pending review and ${pending === 1 ? "is" : "are"} not released to users.` : ""}
            </p>
          </div>
          {approved.length ? (
            <ul className="divide-y rounded-xl border bg-card">
              {approved.map((a) => (
                <li key={a.key} className="grid gap-1 p-4 sm:grid-cols-[15rem_1fr]">
                  <span>
                    <span className="font-medium">{a.reviewer}</span>
                    <span className="block text-sm text-muted-foreground">{a.credentials} · {formatDate(a.reviewedAt)}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{a.scope}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No clinical reviewer has signed off any content yet. This list fills in automatically when a review is recorded.</p>
          )}
        </section>

        {/* PRIVACY + NEXDEV: two per row on large screens, one per row on small */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="h-6 w-6" aria-hidden /></span>
              <h2 className="text-2xl font-bold tracking-tight">Your numbers stay on your device</h2>
            </div>
            <p className="mt-4 max-w-3xl leading-7">
              Calculations run in your browser. The values you enter, your results, your history and your favorites stay on your device, and Clinexia never asks for patient names or record numbers.
              To learn how the app is used it counts which tool was opened and when, never the values or the result. An account is optional.
              Read the full details in the <Link href="/privacy" className={A}>Privacy Policy</Link>.
            </p>
          </section>

          <section className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight">Made by Ebenezer Ekunke</h2>
            <p className="mt-3 max-w-3xl leading-7 opacity-90">
              Clinexia is designed and maintained by Ebenezer Ekunke (NexDev). Questions, corrections, feature requests or partnership ideas are welcome.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="secondary"><a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer">Contact</a></Button>
              <Button asChild variant="outline" className="border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
              </Button>
            </div>
          </section>

        </div>

      </div>
    </div>
  )
}
