import { parseAllowedIss, parseThresholds } from "./config"

// Written out literally so Next.js inlines them into the browser bundle.
export const SMART_CLIENT_ID = (process.env.NEXT_PUBLIC_SMART_CLIENT_ID ?? "").trim()
export const SMART_ALLOWED_ISS = parseAllowedIss(process.env.NEXT_PUBLIC_SMART_ALLOWED_ISS)
export const SMART_STALE_THRESHOLDS = parseThresholds({
  creatinine: process.env.NEXT_PUBLIC_SMART_STALE_DAYS_CREATININE,
  height: process.env.NEXT_PUBLIC_SMART_STALE_DAYS_HEIGHT,
  other: process.env.NEXT_PUBLIC_SMART_STALE_DAYS_OTHER,
})
