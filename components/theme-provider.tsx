'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'
import { isEmbedPath } from '@/lib/integration/embed-headers'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname()
  // Embedded view: ?theme=light|dark forces the theme without writing the person's saved preference.
  const [embedTheme, setEmbedTheme] = React.useState<'light' | 'dark' | undefined>(undefined)

  React.useEffect(() => {
    if (!pathname || !isEmbedPath(pathname)) {
      setEmbedTheme(undefined)
      return
    }
    const t = new URLSearchParams(window.location.search).get('theme')
    setEmbedTheme(t === 'light' || t === 'dark' ? t : undefined)
  }, [pathname])

  return (
    <NextThemesProvider {...props} forcedTheme={embedTheme ?? props.forcedTheme}>
      {children}
    </NextThemesProvider>
  )
}
