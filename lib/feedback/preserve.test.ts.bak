import { describe, expect, it } from "vitest"
import { preserveCompletion } from "./preserve"
import { decidePrompt, freshState, markDone, snooze, DEFAULT_CONFIG } from "./schedule"

const config = { ...DEFAULT_CONFIG, enabled: true, version: 2 }
const NOW = 1_700_000_000_000
const ctx = (state: ReturnType<typeof freshState>, now = NOW) => ({ config, state, now, engaged: true, online: true, pageAgeMs: 10 * 60_000, onExcludedRoute: false })

describe("answers are never erased by a stale copy", () => {
  it("keeps a recorded answer when an older state (no answer) is written afterwards", () => {
    const stored = markDone(freshState(2), NOW)
    const stale = snooze(freshState(2), config, NOW) // the popup's old in-memory copy, after tapping Later
    const merged = preserveCompletion(stored, stale)
    expect(merged.doneAt).toBe(NOW)
    expect(decidePrompt(ctx(merged, NOW + 30 * 86_400_000)).show).toBe(false)
  })
  it("keeps 'do not ask again' too", () => {
    const merged = preserveCompletion({ ...freshState(2), stoppedAt: NOW }, freshState(2))
    expect(merged.stoppedAt).toBe(NOW)
  })
  it("a new round starts fresh: people who answered an earlier round are asked again", () => {
    const merged = preserveCompletion(markDone(freshState(1), NOW), freshState(2))
    expect(merged.doneAt).toBeNull()
    expect(decidePrompt(ctx(merged)).show).toBe(true)
  })
  it("people who tapped Later are asked again after the wait, and not before", () => {
    const later = snooze(freshState(2), config, NOW)
    expect(decidePrompt(ctx(later, NOW + 1 * 3_600_000)).show).toBe(false)
    expect(decidePrompt(ctx(later, NOW + (config.remindAfterHours + 1) * 3_600_000)).show).toBe(true)
  })
  it("ignores junk in storage", () => {
    expect(preserveCompletion("junk", freshState(2)).doneAt).toBeNull()
    expect(preserveCompletion(null, freshState(2)).doneAt).toBeNull()
  })
})
