"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { getAnonymousId } from "@/lib/analytics/client-id"
import { getPlatform } from "@/lib/platform"
import { isLandingSite } from "@/lib/site"
import { useAccountSession } from "@/lib/billing/use-account-session"
import type { Answers, Campaign } from "@/lib/campaigns/model"
import { canFlyToAccount, flyToAccountIcon } from "@/lib/campaigns/fly"
import { prunePending } from "@/lib/campaigns/pending"
import { afterDone, afterLater, afterShown, normalizeState, pickCampaign, type LocalState } from "@/lib/campaigns/schedule"
import { ARRIVED_EVENT, OPEN_EVENT, announcePending, parkCampaign, readPending, replacePending, unparkCampaign } from "@/lib/campaigns/use-pending"
import { CampaignForm, CampaignView, type PublicCampaign } from "./campaign-view"

const KEY = "clinexia:campaigns:v1"
const SESSION_KEY = "clinexia:campaign-session"
const EXCLUDED = /^\/(admin|login|register|diagnostics|welcome)(\/|$)/
const AWAY_MS = 10 * 60_000 // coming back after this long counts as a new visit, so newly published campaigns can appear

const readAll = (): Record<string, unknown> => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {} } catch { return {} } }
const writeOne = (id: string, st: LocalState) => { try { localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [id]: st })) } catch { /* storage unavailable */ } }

type Ref = { id: string; version: number }
async function fetchState(): Promise<{ answered: Ref[]; parked: Ref[] } | null> {
  try {
    const res = await fetch(`/api/campaigns/answered?aid=${encodeURIComponent(getAnonymousId())}`, { cache: "no-store" })
    return res.ok ? await res.json() : null
  } catch { return null }
}
const tellServerParked = (c: Ref, parked: boolean) => {
  fetch("/api/campaigns/park", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: c.id, version: c.version, parked }) }).catch(() => undefined)
}

/**
 * Shows notices and review forms the admin set up in Admin > Campaigns: as a pop-up window, a bar under the header, or a small
 * alert, on the schedule, audience and platforms they chose. One campaign per visit. Answering ends it, on every device for a
 * signed-in person. "Remind me later" shrinks it into the profile icon (which gets a "!") and follows the person's account.
 */
export function CampaignHost() {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const session = useAccountSession()
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [fromMenu, setFromMenu] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [synced, setSynced] = useState(false)
  const [again, setAgain] = useState(0)
  const list = useRef<PublicCampaign[] | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const loadedAt = useRef(Date.now())
  const syncedFor = useRef("")
  const card = useRef<HTMLDivElement | null>(null)

  const unpark = useCallback((c: Ref) => {
    if (readPending().some((p) => p.id === c.id)) unparkCampaign(c.id)
    if (session.signedIn) tellServerParked(c, false)
  }, [session.signedIn])

  const decide = useCallback(() => {
    if (!list.current || list.current.length === 0 || session.loading) return
    let shown = false
    try { shown = sessionStorage.getItem(SESSION_KEY) === "1" } catch { /* ignore */ }
    const stored = readAll()
    const full = list.current.map((c) => ({ ...c, title: "", status: "active" as const })) as Campaign[]
    const states = Object.fromEntries(full.map((c) => [c.id, normalizeState(stored[c.id], c.version)]))
    const pick = pickCampaign(full, states, { now: Date.now(), signedIn: session.signedIn, shownThisSession: shown, platform: "web" })
    if (!pick) return
    try { sessionStorage.setItem(SESSION_KEY, "1") } catch { /* ignore */ }
    writeOne(pick.id, afterShown(states[pick.id], Date.now()))
    unpark(pick)
    setFromMenu(false)
    setFormOpen(pick.kind === "form" && pick.presentation === "modal")
    setCampaign(list.current.find((c) => c.id === pick.id) ?? null)
  }, [session.loading, session.signedIn, unpark])

  // What is live right now. Asked again when someone comes back after a while.
  useEffect(() => {
    if (isLandingSite() || window.self !== window.top) return
    let cancelled = false
    fetch("/api/campaigns/active", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j || !Array.isArray(j.campaigns)) return
        list.current = j.campaigns
        const now = readPending()
        const kept = prunePending(now, j.campaigns)
        if (kept.length !== now.length) replacePending(kept)
        setLoaded(true)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [again])

  useEffect(() => {
    let hiddenAt = 0
    const onVisible = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return }
      if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) {
        hiddenAt = 0
        try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
        syncedFor.current = ""
        setSynced(false)
        setAgain((n) => n + 1)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  // Agree with the server about what this person (on any device) has answered or parked.
  useEffect(() => {
    if (!loaded || session.loading) return
    const key = `${session.signedIn}:${again}`
    if (syncedFor.current === key) return
    syncedFor.current = key
    void fetchState().then((state) => {
      if (state && list.current) {
        const stored = readAll()
        const answeredIds = new Set<string>()
        for (const a of state.answered) {
          const c = list.current.find((x) => x.id === a.id && x.version === a.version)
          if (!c) continue
          answeredIds.add(c.id)
          writeOne(c.id, afterDone(normalizeState(stored[c.id], c.version), Date.now()))
          if (readPending().some((p) => p.id === c.id)) unparkCampaign(c.id)
        }
        let added = false
        for (const p of state.parked) {
          const c = list.current.find((x) => x.id === p.id && x.version === p.version)
          if (c && !answeredIds.has(c.id) && !readPending().some((q) => q.id === c.id)) { parkCampaign(c, false); added = true }
        }
        if (added) announcePending()
      }
      setSynced(true)
    })
  }, [loaded, session.loading, session.signedIn, again])

  // Look again whenever the page changes, a few seconds after the app opened, so nothing pops up the instant someone arrives.
  useEffect(() => {
    if (EXCLUDED.test(pathname) || campaign || !loaded || !synced) return
    const wait = Math.max(0, 4000 - (Date.now() - loadedAt.current))
    const t = window.setTimeout(decide, wait + 300)
    return () => window.clearTimeout(t)
  }, [pathname, decide, campaign, loaded, synced, again])

  // The profile menu asks to reopen a parked campaign.
  useEffect(() => {
    const open = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      const item = readPending().find((p) => p.id === id)
      if (!item) return
      if (item.campaign.kind === "notice") unpark(item) // reading a notice is all it needs
      setFromMenu(true)
      setFormOpen(item.campaign.kind === "form")
      setCampaign(item.campaign)
    }
    window.addEventListener(OPEN_EVENT, open)
    return () => window.removeEventListener(OPEN_EVENT, open)
  }, [unpark])

  const close = useCallback(() => { window.clearTimeout(timer.current); setCampaign(null); setFormOpen(false); setFromMenu(false) }, [])

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (campaign && !fromMenu && campaign.presentation !== "modal" && campaign.durationSeconds && !formOpen) timer.current = window.setTimeout(close, campaign.durationSeconds * 1000)
    return () => window.clearTimeout(timer.current)
  }, [campaign, formOpen, fromMenu, close])

  if (!campaign || EXCLUDED.test(pathname)) return null
  const c: PublicCampaign = fromMenu ? { ...campaign, presentation: "modal", allowLater: false, durationSeconds: null, dismissible: true } : campaign
  const state = () => normalizeState(readAll()[c.id], c.version)

  const later = () => {
    writeOne(c.id, afterLater(state(), c, Date.now()))
    if (session.signedIn) tellServerParked(c, true)
    if (!canFlyToAccount()) return close()
    parkCampaign(campaign, false) // saved now; the "!" lights up when the card lands
    const landed = flyToAccountIcon(card.current) // makes its copy of the card before the real one goes away
    close()
    void landed.then(() => { announcePending(); window.dispatchEvent(new Event(ARRIVED_EVENT)) })
  }
  const cta = () => { unpark(c); if (c.ctaUrl.startsWith("/")) router.push(c.ctaUrl); else window.open(c.ctaUrl, "_blank", "noopener,noreferrer"); close() }
  const submit = async (answers: Answers): Promise<string | null> => {
    try {
      const res = await fetch("/api/campaigns/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: c.id, version: c.version, anonymousId: getAnonymousId(), platform: getPlatform(), website: "", answers }) })
      if (res.ok) { writeOne(c.id, afterDone(state(), Date.now())); unpark(c); window.setTimeout(close, 2500); return null }
      return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not send your answer. Please try again."
    } catch {
      return "You seem to be offline. Please try again when you are back online."
    }
  }
  const view = (variant: "modal" | "banner" | "toast", inlineForm: boolean) => (
    <CampaignView campaign={c} variant={variant} inlineForm={inlineForm} onClose={close} onLater={later} onCta={cta} onOpenForm={() => setFormOpen(true)} onSubmit={submit} />
  )

  if (c.presentation === "banner" && !formOpen)
    return <div ref={card} role="region" aria-label={c.heading} className="border-b bg-primary/10 px-4 py-3 print:hidden"><div className="container mx-auto">{view("banner", false)}</div></div>
  if (c.presentation === "toast" && !formOpen)
    return <div ref={card} role="status" className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-sm rounded-lg border bg-background p-4 shadow-lg animate-in fade-in slide-in-from-bottom-2 print:hidden sm:left-auto sm:right-4 sm:mx-0 sm:w-96">{view("toast", false)}</div>

  return (
    <Dialog open onOpenChange={(o) => { if (!o && c.dismissible) close() }}>
      <DialogContent ref={card} className={c.dismissible ? "max-h-[88vh] overflow-y-auto sm:max-w-lg" : "max-h-[88vh] overflow-y-auto sm:max-w-lg [&>button]:hidden"} onInteractOutside={(e) => { if (!c.dismissible) e.preventDefault() }} onEscapeKeyDown={(e) => { if (!c.dismissible) e.preventDefault() }}>
        <DialogTitle className="sr-only">{c.heading}</DialogTitle>
        <DialogDescription className="sr-only">{c.body || c.heading}</DialogDescription>
        {c.presentation === "modal" && !fromMenu ? view("modal", true) : (
          <div className="space-y-4">
            <p className="text-base font-semibold">{c.heading}</p>
            {c.body && <p className="whitespace-pre-line text-sm text-muted-foreground">{c.body}</p>}
            {c.kind === "form" ? <CampaignForm campaign={c} onSubmit={submit} /> : null}
            {fromMenu && c.kind === "form" && <button type="button" className="text-xs text-muted-foreground underline" onClick={() => { unpark(c); close() }}>No thanks, remove this reminder</button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
