"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAllHistory } from "@/lib/history/db"
import { isLandingSite } from "@/lib/site"
import { localDay, loadConfig, readState, writeState } from "@/lib/feedback/client"
import {
  MIN_PAGE_AGE_MS,
  decidePrompt,
  excludedRoute,
  isEngaged,
  pauseForHours,
  recordVisit,
  snooze,
  type FeedbackConfig,
  type FeedbackState,
} from "@/lib/feedback/schedule"

/**
 * Asks for a star rating once someone has really used Clinexia (3+ calculations, or 3+ different days), like the
 * install prompt: "Later" brings it back after a while (a few times at most), an answer or "Don't ask again" ends it.
 * A star tap opens the short feedback page with that rating filled in.
 */
export function FeedbackPrompt() {
  const pathname = usePathname()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [hover, setHover] = useState(0)
  const loadedAt = useRef(Date.now())
  const config = useRef<FeedbackConfig | null>(null)
  const state = useRef<FeedbackState | null>(null)

  const evaluate = useCallback(async () => {
    const c = config.current
    const s = state.current
    if (!c || !s) return
    let calculations: number | null = null
    try {
      calculations = (await getAllHistory()).length
    } catch {}
    const verdict = decidePrompt({
      config: c,
      state: s,
      now: Date.now(),
      engaged: isEngaged({ calculations, visitDays: s.visitDays.length }),
      online: navigator.onLine !== false,
      pageAgeMs: Date.now() - loadedAt.current,
      onExcludedRoute: excludedRoute(window.location.pathname),
    })
    setVisible(verdict.show)
  }, [])

  // Load the settings and remember today as a visit.
  useEffect(() => {
    if (isLandingSite() || window.self !== window.top) return
    let cancelled = false
    void (async () => {
      const loaded = await loadConfig()
      if (cancelled || !loaded) return
      config.current = loaded
      state.current = recordVisit(readState(loaded.version), localDay())
      writeState(state.current)
      void evaluate()
    })()
    return () => {
      cancelled = true
    }
  }, [evaluate])

  // Re-check when the page changes, once the person has had a minute to use the app.
  useEffect(() => {
    if (excludedRoute(pathname)) {
      setVisible(false)
      return
    }
    const wait = Math.max(0, MIN_PAGE_AGE_MS - (Date.now() - loadedAt.current)) + 400
    const timer = window.setTimeout(() => void evaluate(), wait)
    return () => window.clearTimeout(timer)
  }, [pathname, evaluate])

  const save = (next: FeedbackState) => {
    state.current = next
    writeState(next)
    setVisible(false)
  }

  if (!visible || !config.current || !state.current) return null

  const rate = (stars: number) => {
    // Starting the form pauses the popup for one hour without using up a "Later".
    save(pauseForHours(state.current as FeedbackState, Date.now(), 1))
    router.push(`/feedback?rating=${stars}`)
  }

  return (
    <div
      role="dialog"
      aria-label="Rate Clinexia"
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-sm rounded-lg border bg-background p-4 shadow-lg animate-in fade-in slide-in-from-bottom-2 sm:left-auto sm:right-4 sm:mx-0 sm:w-80"
    >
      <h3 className="text-sm font-semibold">How is Clinexia working for you?</h3>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">Tap a star. It takes about a minute and helps us make it better.</p>
      <div className="mb-3 flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => rate(n)}
            className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2"
          >
            <Star className={`h-8 w-8 ${n <= hover ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => save(snooze(state.current as FeedbackState, config.current as FeedbackConfig, Date.now()))}>
          Later
        </Button>
      </div>
    </div>
  )
}
