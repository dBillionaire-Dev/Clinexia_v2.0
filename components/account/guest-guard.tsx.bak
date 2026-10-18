"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/components/ui/app-dialogs"
import { useToast } from "@/hooks/use-toast"
import { GUEST_CALC_LIMIT, isGuestLimited, readGuestCount } from "@/lib/billing/guest"
import { useAccountSession } from "@/lib/billing/use-account-session"

const EXEMPT = /^\/(login|register|account|admin|welcome|privacy|terms|diagnostics)(\/|$)/
const FIELDS = 'input,textarea,select,button,[contenteditable="true"],[role="button"],[role="combobox"],[role="switch"],[role="checkbox"],[role="radio"],[role="tab"]'

/**
 * Mounted once for the whole app. While premium locking is on, a signed-out visitor gets GUEST_CALC_LIMIT calculations per device;
 * after that the page content becomes browse-only: links still work, anything else asks them to create an account.
 */
export function GuestGuard() {
  const s = useAccountSession()
  const pathname = usePathname() ?? "/"
  const { toast } = useToast()
  const [count, setCount] = useState(0)
  const dialogOpen = useRef(false)
  const exempt = EXEMPT.test(pathname)
  const limited = !s.loading && isGuestLimited({ enforced: s.enforced, signedIn: s.signedIn }, count)
  const active = limited && !exempt

  const ask = useCallback(async (title: string) => {
    if (dialogOpen.current) return
    dialogOpen.current = true
    const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"
    const yes = await confirmDialog({
      title,
      description: (
        <>
          Guests can run {GUEST_CALC_LIMIT} calculations on each device. Create a free account to keep going.{" "}
          Already have one? <a className="underline" href={`/login?next=${encodeURIComponent(here)}`}>Sign in</a>.
        </>
      ),
      confirmLabel: "Create account",
      cancelLabel: "Not now",
    })
    dialogOpen.current = false
    if (yes) window.location.href = `/register?next=${encodeURIComponent(here)}`
  }, [])

  useEffect(() => {
    const sync = () => { try { setCount(readGuestCount(window.localStorage)) } catch { setCount(0) } }
    sync()
    const onCalc = (e: Event) => {
      sync()
      const d = (e as CustomEvent<{ remaining: number; limited: boolean }>).detail
      if (!d) return
      if (d.limited) void ask("That was your last free calculation")
      else toast({ description: `${d.remaining} free calculation${d.remaining === 1 ? "" : "s"} left on this device. Create a free account to keep going.` })
    }
    window.addEventListener("clinexia:guest-calc", onCalc)
    window.addEventListener("storage", sync)
    return () => { window.removeEventListener("clinexia:guest-calc", onCalc); window.removeEventListener("storage", sync) }
  }, [ask, toast])

  useEffect(() => {
    if (!active) return
    const blocked = (e: Event) => {
      const target = e.target as Element | null
      const main = document.getElementById("main-content")
      if (!target?.closest || !main || !main.contains(target)) return // header, menus and dialogs keep working
      if (target.closest("a[href]")) return // navigating is always allowed
      if (e instanceof KeyboardEvent) {
        const typing = e.key === "Enter" || e.key === " " || e.key.length === 1
        if (!typing || e.ctrlKey || e.metaKey || !target.closest(FIELDS)) return
      } else if (!target.closest(FIELDS) && e.type !== "submit") return
      e.preventDefault()
      e.stopPropagation()
      if (e.type === "click" || e.type === "submit" || e.type === "keydown") void ask("Create a free account to continue")
    }
    const types = ["pointerdown", "mousedown", "click", "keydown", "beforeinput", "submit"] as const
    types.forEach((t) => document.addEventListener(t, blocked, true))
    return () => types.forEach((t) => document.removeEventListener(t, blocked, true))
  }, [active, ask])

  if (!active) return null
  return (
    <div role="region" aria-label="Free calculations used" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur print:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">You have used your {GUEST_CALC_LIMIT} free calculations on this device. You can keep browsing; create a free account to keep calculating.</p>
        <div className="flex gap-2">
          <Button asChild size="sm"><Link href={`/register?next=${encodeURIComponent(pathname)}`}>Create account</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link></Button>
        </div>
      </div>
    </div>
  )
}
