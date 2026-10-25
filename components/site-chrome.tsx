"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { isEmbedPath } from "@/lib/integration/embed-headers"

/**
 * Renders its children everywhere except on /embed. The embed view must have no header, footer, navigation, prompts,
 * install banners, update watcher or analytics sync, so the root layout wraps each of those in this component.
 * (usePathname is available during server rendering, so the embed HTML never contains the chrome.)
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname && isEmbedPath(pathname)) return null
  return <>{children}</>
}
