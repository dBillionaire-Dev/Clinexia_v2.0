"use client"
// clinexia-upgrade:phase6 — floating "Emergency Mode" button. Appears only when emergency dosing is released.
import Link from "next/link"
import { usePathname } from "next/navigation"
import { isReleased } from "@/lib/clinical/review"

export function EmergencyFab() {
  const path = usePathname()
  if (!isReleased("emergency-doses") || path?.startsWith("/emergency")) return null
  return (
    <Link href="/emergency" aria-label="Open Emergency Mode" className="fixed bottom-24 left-3 z-50 flex min-h-[48px] items-center rounded-full bg-red-600 px-4 text-sm font-black tracking-wide text-white shadow-lg ring-2 ring-white/80">
      EMERGENCY
    </Link>
  )
}
