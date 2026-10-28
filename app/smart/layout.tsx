import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Clinexia (SMART on FHIR launch)",
  robots: { index: false, follow: false },
}

export default function SmartLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">{children}</div>
}
