import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AppHeader, AppFooter } from "@/components/app-chrome"
import { SITE_BOOTSTRAP } from "@/lib/site"
import { CommandPalette } from "@/components/command-palette"
import { InstallPrompt } from "@/components/install-prompt"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { SkipToContent } from "@/components/skip-to-content"
import { ApplyPreferences } from "@/components/apply-preferences"
import { AnalyticsSync } from "@/components/analytics-sync"
import { UpdateWatcher } from "@/components/update-watcher"
import { DiagnosticsShortcut } from "@/components/diagnostics-shortcut"
import { SiteChrome } from "@/components/site-chrome"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.clinexia.app"),
  title: {
    default: "Clinexia | Clinical Calculators, Drug Dosing and Unit Conversions",
    template: "%s | Clinexia",
  },
  description:
    "Clinexia is a complete clinical toolkit: medical calculators, drug dosing with mg and mL per dose, renal, cardiovascular, oncology and pediatric tools, laboratory calculators, unit conversions and reference ranges. Works offline.",
  keywords: [
    "clinical calculator",
    "medical calculator",
    "drug dose calculator",
    "pediatric dosing calculator",
    "mg to mL dose calculator",
    "eGFR calculator",
    "creatinine clearance calculator",
    "BMI calculator",
    "body surface area calculator",
    "anion gap calculator",
    "corrected calcium calculator",
    "medical unit converter",
    "clinical toolkit",
    "nursing calculator",
    "pharmacy calculator",
    "laboratory calculator",
    "lab reference ranges",
    "hematology calculator",
    "clinical chemistry calculator",
    "offline medical app",
    "Clinexia",
  ],
  applicationName: "Clinexia",
  category: "health",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Clinexia",
    title: "Clinexia | Clinical Calculators, Drug Dosing and Unit Conversions",
    description:
      "Medical calculators, drug dosing with mg and mL per dose, renal, cardiovascular and pediatric tools, laboratory calculators and unit conversions. No account needed, works offline.",
    url: "/",
    images: [{ url: "/og-image.png", alt: "Clinexia clinical toolkit: calculators, drug dosing and unit conversions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clinexia | Clinical Calculators, Drug Dosing and Unit Conversions",
    description:
      "Medical calculators, drug dosing with mg and mL per dose, renal, cardiovascular and pediatric tools, laboratory calculators and unit conversions. No account needed, works offline.",
    images: ["/og-image.png"],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Clinexia" },
  formatDetection: { telephone: false },
  other: { "msapplication-TileColor": "#2563eb" },
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
}

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

// Inline JSON-LD Schema to target Google's YMYL medical & software crawlers
function ClinexiaJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": "https://clinexia.app",
        "name": "Clinexia Clinical Toolkit",
        "applicationCategory": "MedicalApplication",
        "operatingSystem": "Windows, iOS, Android, Web Browser",
        "downloadUrl": "https://www.clinexia.app",
        "offers": {
          "@type": "Offer",
          "price": "0.00",
          "priceCurrency": "USD"
        },
        "author": {
          "@type": "Person",
          "name": "Ebenezer Ekunke",
          "url": "https://is-a.dev"
        },
        "description": "An offline-first progressive web app clinical toolkit featuring pediatric weight-based drug dosing calculators, medical unit converters, and automated EHR clinical note formatting.",
        "features": "Offline local database syncing via IndexedDB, automated EHR note formatting, weight-based pediatric safety guardrails"
      },
      {
        "@type": "MedicalWebPage",
        "@id": "https://clinexia.app",
        "url": "https://www.clinexia.app",
        "name": "Clinexia | Offline Clinical Toolkit & Drug Dosing Calculator",
        "description": "Professional medical calculator for healthcare workers. Calculate pediatric dosages, convert laboratory units, and generate clinical notes completely offline.",
        "aspect": "diagnosis, therapeutic",
        "mainContentOfPage": {
          "@type": "WebPageElement",
          "cssSelector": "main"
        },
        "medicalAudience": {
          "@type": "MedicalAudience",
          "audienceType": "HealthcareProfessionals"
        },
        "about": {
          "@type": "MedicalDeviceAndSoftware",
          "name": "Clinical Math Engine",
          "purpose": "Drug dosage calculation and laboratory unit conversion"
        }
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        {SITE_BOOTSTRAP ? <script dangerouslySetInnerHTML={{ __html: SITE_BOOTSTRAP }} /> : null}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Clinexia" />
        <ClinexiaJsonLd />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteChrome><SkipToContent /></SiteChrome>
          <div className="min-h-screen flex flex-col bg-background">
            <SiteChrome><AppHeader /></SiteChrome>

                 <main
                   id="main-content"
                   tabIndex={-1}
                   className="flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                 >
                   {children}
                 </main>

                 <SiteChrome><AppFooter /></SiteChrome>
          </div>
          <SiteChrome><CommandPalette /></SiteChrome>
          <SiteChrome><InstallPrompt /></SiteChrome>
          <SiteChrome><ServiceWorkerRegistration /></SiteChrome>
          <SiteChrome><ApplyPreferences /></SiteChrome>
          <SiteChrome><AnalyticsSync /></SiteChrome>
          <SiteChrome><UpdateWatcher /></SiteChrome>
          <SiteChrome><DiagnosticsShortcut /></SiteChrome>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
