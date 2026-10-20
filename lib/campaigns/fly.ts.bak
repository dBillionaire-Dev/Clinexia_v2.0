// The "disappears into the profile icon" animation: a copy of the card shrinks and flies to the icon while fading out.
// Returns once it has landed (or at once when there is nothing to animate or the person prefers reduced motion).
export const ACCOUNT_TRIGGER = "[data-account-trigger]"

export function canFlyToAccount(): boolean {
  return typeof document !== "undefined" && document.querySelector(ACCOUNT_TRIGGER) !== null
}

export function flyToAccountIcon(card: HTMLElement | null): Promise<void> {
  const target = typeof document === "undefined" ? null : (document.querySelector(ACCOUNT_TRIGGER) as HTMLElement | null)
  if (!card || !target || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return Promise.resolve()

  const from = card.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (from.width === 0 || from.height === 0) return Promise.resolve()

  // Copy what the card looks like, not its classes (the pop-up's centring classes would fight the animation).
  const cs = getComputedStyle(card)
  const ghost = card.cloneNode(true) as HTMLElement
  ghost.className = ""
  ghost.removeAttribute("id")
  Object.assign(ghost.style, {
    position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, margin: "0", boxSizing: "border-box",
    transform: "none", translate: "none", scale: "none", pointerEvents: "none", zIndex: "2147483000", overflow: "hidden", transformOrigin: "center center",
    background: cs.backgroundColor === "rgba(0, 0, 0, 0)" ? "hsl(var(--background))" : cs.backgroundColor, color: cs.color, border: cs.border, borderRadius: cs.borderRadius, boxShadow: cs.boxShadow, padding: cs.padding,
  })
  ghost.setAttribute("aria-hidden", "true")
  document.body.appendChild(ghost)

  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const scale = Math.max(0.03, Math.min(0.12, to.width / from.width))
  const animation = ghost.animate(
    [
      { transform: "translate(0px, 0px) scale(1)", opacity: 1, borderRadius: cs.borderRadius },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 24}px) scale(${Math.max(scale * 3, 0.3)})`, opacity: 0.9, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.15, borderRadius: "9999px" },
    ],
    { duration: 700, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" },
  )
  return animation.finished.then(() => undefined, () => undefined).finally(() => ghost.remove())
}
