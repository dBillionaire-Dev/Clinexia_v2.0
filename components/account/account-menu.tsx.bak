"use client"

import Link from "next/link"
import { LogIn, User, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { writeSessionState } from "@/lib/billing/guest"
import { useAccountSession } from "@/lib/billing/use-account-session"

/** Navbar profile icon. Signed out: sign in / create account. Signed in: your account and sign out. Hidden if accounts are switched off. */
export function AccountMenu() {
  const s = useAccountSession()
  if (!s.enabled) return null

  async function signOut() {
    await fetch("/api/account/logout", { method: "POST" }).catch(() => undefined)
    try { writeSessionState(window.localStorage, { enforced: s.enforced, signedIn: false }) } catch { /* ignore */ }
    window.location.href = "/"
  }

  const initial = s.email?.trim().charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={s.signedIn ? "Your account" : "Sign in or create an account"} className="shrink-0">
          {s.signedIn && initial ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initial}</span> : <User className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
