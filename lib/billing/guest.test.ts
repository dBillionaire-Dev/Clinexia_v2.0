import { describe, expect, it } from "vitest"
import { GUEST_CALC_LIMIT, GUEST_KEY, SESSION_STATE_KEY, guestLimitOn, isGuestLimited, noteGuestCalculation, readSessionState, writeSessionState } from "./guest"

const store = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }

describe("3 free calculations for guests", () => {
  it("counts to 3 for a guest when the account requirement is on, even with payments hidden (enforced false)", () => {
    const s = store(); writeSessionState(s, { enforced: false, guestLimit: true, signedIn: false })
    expect(noteGuestCalculation(s)).toMatchObject({ counted: true, count: 1, remaining: 2, limited: false })
    expect(noteGuestCalculation(s)).toMatchObject({ counted: true, count: 2, remaining: 1 })
    expect(noteGuestCalculation(s)).toMatchObject({ counted: true, count: 3, remaining: 0, limited: true })
    expect(noteGuestCalculation(s)).toMatchObject({ counted: false, limited: true }) // the count stops at the limit
    expect(s.getItem(GUEST_KEY)).toBe(String(GUEST_CALC_LIMIT))
  })
  it("the lock needs no network: it works from the saved state alone", () => {
    const s = store({ [SESSION_STATE_KEY]: JSON.stringify({ enforced: false, guestLimit: true, signedIn: false }), [GUEST_KEY]: "3" })
    expect(isGuestLimited(readSessionState(s), 3)).toBe(true)
  })
  it("signed-in people and an off switch are never counted or locked", () => {
    const a = store(); writeSessionState(a, { enforced: false, guestLimit: true, signedIn: true }); expect(noteGuestCalculation(a).counted).toBe(false)
    const b = store(); writeSessionState(b, { enforced: false, guestLimit: false, signedIn: false }); expect(noteGuestCalculation(b).counted).toBe(false)
    expect(isGuestLimited({ enforced: false, guestLimit: false, signedIn: false }, 3)).toBe(false)
  })
  it("states saved before this setting existed behave as before (enforced means limited)", () => {
    expect(guestLimitOn({ enforced: true, signedIn: false })).toBe(true)
    expect(guestLimitOn({ enforced: false, signedIn: false })).toBe(false)
    expect(readSessionState(store({ [SESSION_STATE_KEY]: JSON.stringify({ enforced: true, signedIn: false }) }))).toEqual({ enforced: true, signedIn: false })
  })
})
