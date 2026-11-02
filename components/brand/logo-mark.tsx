// clinexia-upgrade:phase7 — the Clinexia mark, drawn as an SVG that takes its colour from the text colour.
import { LOGO_OUTLINE, LOGO_VIEWBOX } from "@/lib/brand/logo-path"

export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} focusable="false">
      <path d={LOGO_OUTLINE} fill="currentColor" />
    </svg>
  )
}
