import type { Metadata } from "next"
import { ArrowRight, ArrowLeftRight, BookOpenText, Calculator, Gauge, Globe, Monitor, Pill, ShieldCheck, Smartphone, WifiOff, Download } from "lucide-react"
import { calculatorCategories, calculators } from "@/lib/calculators/registry"
import { conversionCategories } from "@/lib/conversions/registry"
import { LANDING, androidAvailable } from "@/lib/landing-config"
import { LANDING_URL, splitEnabled } from "@/lib/site"
import { AppLink } from "@/components/landing/app-link"
import { shotById } from "@/lib/landing-data"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { LandingNav } from "@/components/landing/landing-nav"
import { LaptopFrame, PhoneFrame } from "@/components/landing/device-frame"
import { ThemedImage } from "@/components/landing/themed-image"
import { LiveDemo } from "@/components/landing/live-demo"
import { Gallery } from "@/components/landing/gallery"
import { AndroidButton, AndroidChannels, InstallPwaButton, WindowsButton } from "@/components/landing/install-buttons"

const TITLE = "Clinical calculators, drug dosing and conversions in one toolkit"
const DESCRIPTION =
  "Clinexia is a complete clinical toolkit: medical calculators, drug dosing with mg and mL per dose, renal, cardiovascular and pediatric tools, laboratory calculators and unit conversions. Offline-ready on the web, Windows and Android."

// With its own domain the landing page is "/" on that domain, so canonical and share links must point there (absolute).
const CANONICAL = splitEnabled ? `${LANDING_URL}/` : "/welcome"
const OG_IMAGE = splitEnabled ? `${LANDING_URL}/landing/og.png` : "/landing/og.png"

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: "website",
    title: `Clinexia | ${TITLE}`,
    description: DESCRIPTION,
    url: CANONICAL,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Clinexia clinical toolkit on a laptop and a phone" }],
  },
  twitter: { card: "summary_large_image", title: `Clinexia | ${TITLE}`, description: DESCRIPTION, images: [OG_IMAGE] },
}

const androidReady = androidAvailable

export default function WelcomePage() {
  const total = calculators.length
  const estimators = calculators.filter((c) => c.isEstimator).length
  const categories = calculatorCategories.length
  const conversions = conversionCategories.length

  const features = [
    { Icon: Calculator, title: `${total} calculators`, text: `Across ${categories} categories: renal, cardiovascular, drug dosing, oncology, hematology, chemistry and more.` },
    { Icon: Pill, title: "Drug dosing", text: "Weight- and body-surface-based doses, with the mg per dose and the mL per dose from your product strength." },
    { Icon: ArrowLeftRight, title: "Conversions and lab tools", text: `${conversions} unit categories with instant results, plus dilutions, solution preparation and spectrophotometry.` },
    { Icon: Gauge, title: "Estimators", text: `${estimators} tools such as eGFR and body surface area, clearly labelled as estimates.` },
    { Icon: BookOpenText, title: "Shows its working", text: "Formula, notes, limitations and a versioned source on every calculator." },
    { Icon: WifiOff, title: "Offline-ready", text: "Install it once and keep working without a connection." },
  ]

  const faqs = [
    { q: "Do I need an account?", a: "No. Open it and start calculating." },
    { q: "Does it work offline?", a: "Yes. Once the web app is installed (or has been opened once), it keeps working without a connection. The Android app does not need the internet to calculate." },
    { q: "How do I get it on my phone?", a: androidReady ? "On Android, use the Google Play or download button on this page. On any phone you can also install the web app: on iPhone use Share, then Add to Home Screen; on Android Chrome use Install app." : "The Android app is on its way. Until then, install the web app: on iPhone use Share, then Add to Home Screen; on Android Chrome use the menu, then Install app." },
    { q: "Where is my data stored?", a: "History, favorites and settings stay on your device. Clinexia counts anonymous usage (which tool was used, never the values you enter) to understand how many people use it and which tools matter." },
    { q: "Can I rely on the results clinically?", a: "Clinexia is a calculation and reference utility, not a medical device. It does not replace clinical judgement, local protocols, a formulary or validated laboratory procedures. Always check results before acting on them." },
    { q: "Where do the formulas come from?", a: "Each calculator lists its formula, limitations and source with a version and the date it was last verified, so you can check the original." },
  ]

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Clinexia",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web, Android",
    description: DESCRIPTION,
    url: CANONICAL,
    ...(LANDING.playStoreUrl ? { downloadUrl: LANDING.playStoreUrl } : {}),
  }

  return (
    <div className="bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingNav />

      {/* HERO */}
      <section className="relative overflow-hidden border-b">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.14),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:py-20 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />For clinicians, nurses, pharmacists, laboratory staff and students
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">The complete clinical toolkit, for every screen.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              {total} calculators, drug dosing with mg and mL per dose, conversions and lab tools on the web, on your phone and on Android. Fast, offline-ready, and it shows its working.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg"><AppLink path="/">Open the web app<ArrowRight className="ml-2 h-4 w-4" aria-hidden /></AppLink></Button>
              <AndroidButton variant="secondary" />
              <InstallPwaButton variant="outline" />
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><WifiOff className="h-4 w-4 text-primary" aria-hidden />Works offline</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden />No account needed</li>
              <li className="flex items-center gap-2"><BookOpenText className="h-4 w-4 text-primary" aria-hidden />Formulas and sources shown</li>
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-xl pb-8 lg:max-w-none" aria-hidden="false">
            <LaptopFrame>
              <ThemedImage shot={shotById("web-result")} priority className="block h-auto w-full" />
            </LaptopFrame>
            <div className="absolute -bottom-2 right-0 w-[28%] min-w-[104px] sm:right-2">
              <PhoneFrame className="!rounded-[1.4rem] !border-[5px]">
                <ThemedImage shot={shotById("app-home")} priority className="block h-auto w-full" />
              </PhoneFrame>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-16 border-b py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Everything at the bench and the bedside</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">One toolkit, the same calculations everywhere you work.</p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ Icon, title, text }) => (
              <li key={title} className="rounded-xl border bg-card p-5">
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="demo" className="scroll-mt-16 border-b bg-muted/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Try it, right here</h2>
          <p className="mx-auto mb-10 mt-3 max-w-2xl text-center text-muted-foreground">Use the real web app in a laptop or phone frame, or flip through the Android app.</p>
          <LiveDemo />
        </div>
      </section>

      {/* GET THE APP */}
      <section id="get" className="scroll-mt-16 border-b py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Get Clinexia</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">Pick what suits you. It is the same toolkit on all of them.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col rounded-xl border bg-card p-6">
              <Globe className="h-7 w-7 text-primary" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">Web app</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">Nothing to install. Works in any modern browser on a computer, tablet or phone.</p>
              <Button asChild className="mt-5"><AppLink path="/">Open the web app</AppLink></Button>
            </div>
            <div className="flex flex-col rounded-xl border bg-card p-6">
              <Download className="h-7 w-7 text-primary" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">Install as an app (PWA)</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">Add it to your home screen or desktop. It opens full screen and keeps working offline.</p>
              <InstallPwaButton variant="outline" size="default" className="mt-5" />
            </div>
            <div className="flex flex-col rounded-xl border bg-card p-6">
              <Smartphone className="h-7 w-7 text-primary" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">Android app</h3>
              <p className="mt-1 text-sm text-muted-foreground">{androidReady ? "The native app for Android phones and tablets. Fully offline." : "The native Android app is being prepared. Install the web app in the meantime. It is the same toolkit."}</p>
              <AndroidChannels />
            </div>
            <div className="flex flex-col rounded-xl border bg-card p-6">
              <Monitor className="h-7 w-7 text-primary" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">Windows</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{LANDING.microsoftStoreUrl ? "Install it from the Microsoft Store." : "A Microsoft Store version is on its way. Until then, install the web app from Edge or Chrome with the install button."}</p>
              <WindowsButton variant="secondary" size="default" className="mt-5" />
            </div>
          </div>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section id="screens" className="scroll-mt-16 border-b bg-muted/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">See it on every screen</h2>
          <p className="mx-auto mb-8 mt-3 max-w-2xl text-center text-muted-foreground">Real screenshots in light and dark. Tap one to enlarge it.</p>
          <Gallery />
        </div>
      </section>

      {/* TRUST */}
      <section id="privacy" className="scroll-mt-16 border-b py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <ShieldCheck className="h-7 w-7 text-primary" aria-hidden />
            <h2 className="mt-3 text-xl font-semibold">Private by design</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">No account. The values you enter and your results stay on your device. Clinexia counts anonymous usage (which tool was used, never the numbers) so we can see how many people use it and which tools matter. Please do not enter patient-identifying information.</p>
          </div>
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-6 dark:border-amber-500/30 dark:bg-amber-950/30">
            <BookOpenText className="h-7 w-7 text-amber-700 dark:text-amber-400" aria-hidden />
            <h2 className="mt-3 text-xl font-semibold">A utility, not a medical device</h2>
            <p className="mt-2 text-sm leading-6 text-amber-950/80 dark:text-amber-100/80">Clinexia provides calculations and estimates for educational and clinical reference use. It does not replace clinical judgement, local protocols, a formulary or validated laboratory SOPs. Always verify results before acting on them.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 border-b py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Questions</h2>
          <Accordion type="single" collapsible className="mt-8">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* FINAL CTA + FOOTER */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Ready when you are.</h2>
          <p className="mt-3 text-muted-foreground">Open it now. No sign-up, no setup.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg"><AppLink path="/">Open the web app<ArrowRight className="ml-2 h-4 w-4" aria-hidden /></AppLink></Button>
            <AndroidButton variant="secondary" />
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row">
          <span>&copy; {new Date().getFullYear()} Clinexia by <a className="font-medium text-foreground underline-offset-4 hover:underline" href={LANDING.developerUrl} target="_blank" rel="noopener noreferrer">NexDev</a></span>
          <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            <AppLink path="/calculators" className="hover:text-foreground">Calculators</AppLink>
            <AppLink path="/conversions" className="hover:text-foreground">Conversions</AppLink>
            <AppLink path="/lab-tools" className="hover:text-foreground">Lab tools</AppLink>
            <AppLink path="/estimators" className="hover:text-foreground">Estimators</AppLink>
            <AppLink path="/privacy" className="hover:text-foreground">Privacy</AppLink>
          </nav>
        </div>
      </footer>
    </div>
  )
}
