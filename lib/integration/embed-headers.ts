import { buildFrameAncestors } from "./embed-origins"

/** True for /embed and everything under it (and not for look-alikes such as /embedded). */
export const isEmbedPath = (pathname: string) => pathname === "/embed" || pathname.startsWith("/embed/")

/**
 * /embed is the only route that may be framed by other sites. Every other route keeps the frame headers set in
 * next.config.mjs (CSP frame-ancestors 'self' + landing domain, or X-Frame-Options SAMEORIGIN).
 */
export function applyEmbedFrameHeaders(headers: Headers, origins: readonly string[]): void {
  headers.delete("X-Frame-Options")
  headers.set("Content-Security-Policy", buildFrameAncestors(origins))
}
