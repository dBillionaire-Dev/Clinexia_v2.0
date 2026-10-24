import { NextResponse, type NextRequest } from "next/server"
import { corsHeadersFor, corsPath } from "@/lib/billing/cors"
import { applyEmbedFrameHeaders, isEmbedPath } from "@/lib/integration/embed-headers"
import { getEmbedOrigins } from "@/lib/integration/embed-origins"
import { APP_HOST, APP_URL, LANDING_HOST, LANDING_URL, LEGACY_HOSTS, LEGACY_REDIRECT_ON, splitEnabled } from "@/lib/site"

/**
 * Replaces the app's service worker on the old address. The old one serves pages from its cache first, so an installed
 * copy would never reach the redirect. This version clears the caches, removes itself and reloads the open pages,
 * which then hit the redirect.
 */
const RETIRE_SERVICE_WORKER = `self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: "window" })
    clients.forEach((c) => c.navigate(c.url))
  })())
})
`


/**
 * Host router for the two-domain setup. Does nothing unless NEXT_PUBLIC_LANDING_URL and NEXT_PUBLIC_APP_URL are set,
 * and does nothing for any other host (localhost, previews, the old vercel.app address), which keeps working as before.
 *
 *   example.com        "/" shows the landing page; every app page redirects to app.example.com
 *   www.convertlab.co    redirects to example.com
 *   app.example.com    the app; /welcome redirects to example.com
 */
const LANDING_PASS = [
  "/_next/", "/landing/", "/landing-seo/",
  "/favicon.ico", "/icon-192x192.png", "/icon-512x512.png", "/icon-maskable-192x192.png", "/apple-touch-icon.png", "/og-image.png",
]

function route(request: NextRequest) {
  if (!splitEnabled) return NextResponse.next()

  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase()
  const { pathname, search } = request.nextUrl

  // Old address (opt-in): installed copies get a service worker that retires itself, everything else goes to the app domain.
  // /api/ is left alone so older installs and mobile builds that still report to this address keep working.
  if (LEGACY_REDIRECT_ON && LEGACY_HOSTS.includes(host)) {
    if (pathname === "/service-worker.js") {
      return new NextResponse(RETIRE_SERVICE_WORKER, {
        headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" },
      })
    }
    if (pathname.startsWith("/api/")) return NextResponse.next()
    if (pathname.startsWith("/welcome")) return NextResponse.redirect(new URL("/", LANDING_URL), 308)
    return NextResponse.redirect(new URL(`${pathname}${search}`, APP_URL), 308)
  }

  // API calls (the Android app reports to the website address) must never be redirected: a redirected POST is not followed.
  if (pathname.startsWith("/api/") && (host === LANDING_HOST || host === `www.${LANDING_HOST}`)) return NextResponse.next()

  if (host === `www.${LANDING_HOST}`) {
    // One hop: the home page belongs to the landing site, every other page to the app.
    return NextResponse.redirect(new URL(`${pathname}${search}`, pathname === "/" ? LANDING_URL : APP_URL), 308)
  }

  if (host === LANDING_HOST) {
    if (pathname === "/") return NextResponse.rewrite(new URL("/welcome", request.url))
    if (pathname === "/welcome") return NextResponse.redirect(new URL("/", LANDING_URL), 308)
    if (pathname === "/robots.txt") return NextResponse.rewrite(new URL("/landing-seo/robots", request.url))
    if (pathname === "/sitemap.xml") return NextResponse.rewrite(new URL("/landing-seo/sitemap", request.url))
    // The landing site is not an installable app: a non-installable manifest, and no service worker.
    if (pathname === "/manifest.webmanifest") return NextResponse.rewrite(new URL("/landing-seo/manifest", request.url))
    if (pathname === "/service-worker.js") return new NextResponse(null, { status: 404 })
    if (LANDING_PASS.some((p) => pathname.startsWith(p))) return NextResponse.next()
    return NextResponse.redirect(new URL(`${pathname}${search}`, APP_URL), 308)
  }

  if (host === APP_HOST && pathname.startsWith("/welcome")) {
    return NextResponse.redirect(new URL("/", LANDING_URL), 308)
  }

  return NextResponse.next()
}

/**
 * Lets the Clinexia mobile apps (Android app, mobile site) call the account, billing, campaign and feedback APIs.
 * Only origins listed in lib/billing/cors.ts (or MOBILE_ALLOWED_ORIGINS) get CORS headers; everything else is unchanged.
 */
export function proxy(request: NextRequest) {
  const cors = corsPath(request.nextUrl.pathname) ? corsHeadersFor(request.headers.get("origin")) : null
  if (cors && request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: cors })
  const response = route(request)
  if (cors) for (const [key, value] of Object.entries(cors)) response.headers.set(key, value)
  // /embed is the one route other sites may frame: its allowlist (env + embed_partners) is read per request, cached about a minute.
  // Only embed requests become async, so every other route behaves exactly as before.
  if (isEmbedPath(request.nextUrl.pathname)) {
    return getEmbedOrigins().then((origins) => {
      applyEmbedFrameHeaders(response.headers, origins)
      return response
    })
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
