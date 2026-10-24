"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardList, LogIn, User, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { UserAvatar } from "./user-avatar"
import { writeSessionState } from "@/lib/billing/guest"
import { useAccountSession } from "@/lib/billing/use-account-session"
import { ARRIVED_EVENT, OPEN_EVENT, usePendingCampaigns } from "@/lib/campaigns/use-pending"

/**
 * Navbar profile icon. Signed out: sign in / create account. Signed in: your account and sign out. Hidden if accounts are switched off.
 * A "!" appears on it when a review form (or notice) was parked with "Remind me later"; the menu then offers to complete it.
 */
export function AccountMenu() {
  const s = useAccountSession()
  const pending = usePendingCampaigns()
  const [pulse, setPulse] = useState(false)

  // The parked card has just flown into the icon: make the "!" pop.
  useEffect(() => {
    let t: number | undefined
    const arrived = () => { setPulse(true); window.clearTimeout(t); t = window.setTimeout(() => setPulse(false), 1600) }
    window.addEventListener(ARRIVED_EVENT, arrived)
    return () => { window.removeEventListener(ARRIVED_EVENT, arrived); window.clearTimeout(t) }
  }, [])

  if (!s.enabled) return null

  async function signOut() {
    await fetch("/api/account/logout", { method: "POST" }).catch(() => undefined)
    try { writeSessionState(window.localStorage, { enforced: s.enforced, signedIn: false }) } catch { /* ignore */ }
    window.location.href = "/"
  }

  const initial = s.email?.trim().charAt(0).toUpperCase()
  const count = pending.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-account-trigger=""
          aria-label={`${s.signedIn ? "Your account" : "Sign in or create an account"}${count ? `, ${count} thing${count === 1 ? "" : "s"} waiting for you` : ""}`}
          className={`relative shrink-0 ${pulse ? "scale-110 transition-transform" : "transition-transform"}`}
        >
          {s.signedIn && initial ? <UserAvatar url={s.avatarUrl} initial={initial} size={28} /> : <User className="h-5 w-5" />}
          {count > 0 && (
            <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center">
              {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/60" />}
              <span className={`relative flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-destructive-foreground ${pulse ? "animate-bounce" : ""}`}>!</span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {count > 0 && (
          <>
            {pending.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { id: p.id } }))} className="items-start gap-2">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span className="min-w-0"><span className="block text-sm font-medium">{p.campaign.kind === "form" ? "Complete feedback form" : "You have a message"}</span><span className="block truncate text-xs text-muted-foreground">{p.campaign.heading}</span></span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        {s.signedIn ? (
          <>
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{s.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/account"><User className="mr-2 h-4 w-4" />My account</Link></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild><Link href="/login"><LogIn className="mr-2 h-4 w-4" />Sign in</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/register"><UserPlus className="mr-2 h-4 w-4" />Create account</Link></DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
