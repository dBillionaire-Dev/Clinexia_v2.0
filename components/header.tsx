"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Menu, X } from "lucide-react"
import { LogoMark } from "@/components/brand/logo-mark" // clinexia-upgrade:phase7 logo
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountMenu } from "@/components/account/account-menu"
import { SiteNav, siteNavLinks } from "@/components/site-nav"

export function Header({ onOpenSearch }: { onOpenSearch?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="border-b-2 border-blue-600 dark:border-blue-500 bg-background sticky top-0 z-40 print:hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/welcome" className="flex items-center gap-2 shrink-0">
            <LogoMark className="h-6 w-6 text-[#0059e9] dark:text-blue-400" />
            <span className="text-lg font-bold">Clinexia</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            <SiteNav />
          </nav>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex items-center gap-2 text-muted-foreground font-normal"
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            >
              <Search className="h-4 w-4" />
              <span>Search Clinexia...</span>
              <kbd className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded border">⌘K</kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label="Search"
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            >
              <Search className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            <AccountMenu />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="md:hidden pb-3 flex flex-col gap-1">
            {siteNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2 rounded-md text-sm hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  )
}
