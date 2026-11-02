import Link from "next/link"
import { LogoMark } from "@/components/brand/logo-mark" // clinexia-upgrade:phase7 logo
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { AppLink } from "@/components/landing/app-link"
import { landingHome } from "@/lib/site"

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#demo", label: "Try it" },
  { href: "#get", label: "Get the app" },
  { href: "#screens", label: "Screenshots" },
  { href: "#faq", label: "FAQ" },
]

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href={landingHome} className="flex items-center gap-2" aria-label="Clinexia home">
          <LogoMark className="h-6 w-6 text-[#0059e9] dark:text-blue-400" />
          <span className="text-lg font-bold">Clinexia</span>
        </Link>
        <nav aria-label="Page sections" className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm">
            <AppLink path="/">Open web app</AppLink>
          </Button>
        </div>
      </div>
    </header>
  )
}
