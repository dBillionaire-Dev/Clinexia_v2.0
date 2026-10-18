
"use client"

import { usePathname } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ChromeGate } from "@/components/landing/chrome-gate"
import { GuestGuard } from "@/components/account/guest-guard"

export function AppHeader() {
  const pathname = usePathname()

  if (pathname === "/diagnostics") return null

  return (
    <>
      <ChromeGate>
        <Header />
      </ChromeGate>
      <GuestGuard />
    </>
  )
}

export function AppFooter() {
  const pathname = usePathname()

  if (pathname === "/diagnostics") return null

  return (
    <ChromeGate>
      <Footer />
    </ChromeGate>
  )
}
