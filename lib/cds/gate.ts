import { createHash, timingSafeEqual } from "node:crypto"

/** CDS Hooks stays off unless CDS_HOOKS_ENABLED is exactly "true". */
export const cdsEnabled = (env: Record<string, string | undefined> = process.env) => env.CDS_HOOKS_ENABLED === "true"

/**
 * Optional stopgap until the EHR's signed JWT is verified: when CDS_HOOKS_SHARED_SECRET is set, requests must send
 * "Authorization: Bearer <secret>". When it is not set the service is open (it only computes from what the caller sends).
 */
export function cdsAuthorised(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.CDS_HOOKS_SHARED_SECRET
  if (!secret) return true
  const m = /^Bearer\s+(\S+)$/i.exec((header ?? "").trim())
  if (!m) return false
  const a = createHash("sha256").update(m[1]).digest()
  const b = createHash("sha256").update(secret).digest()
  return timingSafeEqual(a, b)
}
