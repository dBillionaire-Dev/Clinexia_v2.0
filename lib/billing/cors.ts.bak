// Which other Clinexia apps (the Android app, the mobile website) may call this site's account, billing, campaign and
// feedback APIs from a browser. They sign in with a token (never cookies), so allowing them cannot be used for cross-site tricks.
const PATHS = ["/api/account/", "/api/billing/", "/api/campaigns/", "/api/feedback/", "/api/push/", "/api/analytics"]
const NEVER = ["/api/billing/webhook"] // called by the payment provider, not by an app

export const corsPath = (pathname: string) => PATHS.some((p) => pathname.startsWith(p)) && !NEVER.some((p) => pathname.startsWith(p))

// The Android app's web view is https://localhost (capacitor.config androidScheme "https"); iOS would be capacitor://localhost.
const DEFAULT_ORIGINS = ["https://localhost", "capacitor://localhost", "https://clinexia-mobile.vercel.app"]

type Env = Record<string, string | undefined>

export function allowedOrigins(env: Env = process.env): string[] {
  const extra = (env.MOBILE_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean)
  return [...DEFAULT_ORIGINS, ...extra]
}

export function isTrustedOrigin(origin: string | null | undefined, env: Env = process.env): boolean {
  if (!origin) return false
  const o = origin.replace(/\/+$/, "")
  if (allowedOrigins(env).includes(o)) return true
  // Local development: the mobile dev server and the Android emulator's live reload.
  return env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(o)
}

export function corsHeadersFor(origin: string | null | undefined, env: Env = process.env): Record<string, string> | null {
  if (!isTrustedOrigin(origin, env)) return null
  return {
    "Access-Control-Allow-Origin": origin as string,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Clinexia-Client",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}
