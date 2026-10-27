"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { LANDING } from "@/lib/landing-config"

const DISMISSED_KEY = "clinexia-install-dismissed"
const DISMISS_COOLDOWN = 8 * 60 * 60 * 1000
const FALLBACK_APK_URL = "/downloads/Clinexia-latest.apk"
const MS_STORE_URL =
  LANDING.microsoftStoreUrl ||
  process.env.NEXT_PUBLIC_MS_STORE_URL ||
  ""
const APK_URL =
  LANDING.apkUrl || process.env.NEXT_PUBLIC_APK_URL || FALLBACK_APK_URL

interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isDismissedWithinCooldown(): boolean {
  try {
    const stored = window.localStorage.getItem(DISMISSED_KEY)
    if (!stored) return false

    const timestamp = Number.parseInt(stored, 10)
    if (!Number.isFinite(timestamp) || timestamp <= 0) return false

    const elapsed = Date.now() - timestamp
    return elapsed >= 0 && elapsed < DISMISS_COOLDOWN
  } catch {
    return false
  }
}

export default function SmartInstall() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [alertMessage, setAlertMessage] = useState("")

  const normalizedPath = pathname || "/"
  const isEligibleRoute =
    normalizedPath === "/" ||
    normalizedPath === "/welcome" ||
    normalizedPath === "/app" ||
    normalizedPath.startsWith("/app/")

  const handleDismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, Date.now().toString())
    } catch {
      // Storage may be unavailable.
    }
    setShow(false)
    setDeferredPrompt(null)
  }, [])

  const showInstallAlert = useCallback(
    (message: string) => {
      handleDismiss()
      setAlertMessage(message)
    },
    [handleDismiss],
  )

  useEffect(() => {
    if (!isEligibleRoute) return
    if (isStandalone()) return
    if (isDismissedWithinCooldown()) return

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setShow(true)
    }

    const handleAppInstalled = () => {
      setShow(false)
      setDeferredPrompt(null)

      try {
        window.localStorage.setItem(DISMISSED_KEY, Date.now().toString())
      } catch {
        // The installed event should still close the prompt.
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    const fallbackTimer = setTimeout(() => setShow(true), 2000)

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      )
      window.removeEventListener("appinstalled", handleAppInstalled)
      clearTimeout(fallbackTimer)
    }
  }, [isEligibleRoute])

  const handleInstall = async () => {
    if (installing) return
    setInstalling(true)

    try {
      const ua = window.navigator.userAgent
      const platform = window.navigator.platform

      const isAndroid = /Android/i.test(ua)
      const isWindows = /Windows/i.test(ua)
      const isIOS =
        /iPhone|iPad|iPod/i.test(ua) ||
        (platform === "MacIntel" &&
          window.navigator.maxTouchPoints > 1)
      const isMac =
        /Macintosh/i.test(ua) || platform === "MacIntel"

      if (isAndroid) {
        handleDismiss()
        window.location.href = APK_URL
        return
      }

      if (isWindows) {
        if (MS_STORE_URL) {
          handleDismiss()
          window.location.href = MS_STORE_URL
        } else {
          showInstallAlert(
            "The Clinexia Microsoft Store listing has not been configured yet. Please use Clinexia in your browser for now.",
          )
        }
        return
      }

      if (isIOS) {
        showInstallAlert(
          "To install Clinexia, tap the Share button, then select Add to Home Screen.",
        )
        return
      }

      if (isMac) {
        showInstallAlert(
          "To install Clinexia on Mac, open Safari and choose File → Add to Dock.",
        )
        return
      }

      if (deferredPrompt) {
        const promptEvent = deferredPrompt
        await promptEvent.prompt()
        await promptEvent.userChoice
        handleDismiss()
        return
      }

      showInstallAlert(
        "Use your browser's install option or menu to install Clinexia, if available.",
      )
    } catch (error) {
      console.error("Clinexia install action failed:", error)
      showInstallAlert(
        "Clinexia could not open the installation option. Please try again from your browser menu.",
      )
    } finally {
      setInstalling(false)
    }
  }

  if (!isEligibleRoute && !alertMessage) return null
  if (!show && !alertMessage) return null

  return (
    <>
      {show && isEligibleRoute && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="clinexia-install-title"
          aria-describedby="clinexia-install-description"
          className="fixed z-[9999] flex flex-col gap-3 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          style={{
            bottom: 20,
            left: 15,
            right: 15,
            background: "#0a0a0a",
            color: "white",
            padding: 18,
            borderRadius: 16,
            maxWidth: 520,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div>
            <h2
              id="clinexia-install-title"
              className="text-base font-semibold"
            >
              Install Clinexia App?
            </h2>
            <p
              id="clinexia-install-description"
              className="mt-1 text-sm text-zinc-300"
            >
              Faster and works offline
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleDismiss}
              className="min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ background: "#27272a", color: "white" }}
            >
              Not now
            </button>

            <button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ background: "#2563eb", color: "white" }}
            >
              {installing ? "Opening…" : "Install"}
            </button>
          </div>
        </section>
      )}

      {alertMessage && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAlertMessage("")}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clinexia-alert-title"
            aria-describedby="clinexia-alert-description"
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-950 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>

            <h2
              id="clinexia-alert-title"
              className="text-lg font-semibold"
            >
              Clinexia
            </h2>

            <p
              id="clinexia-alert-description"
              className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300"
            >
              {alertMessage}
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setAlertMessage("")}
                className="min-h-11 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ background: "#2563eb" }}
              >
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
