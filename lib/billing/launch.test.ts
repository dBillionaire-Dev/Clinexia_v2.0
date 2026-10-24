import { describe, expect, it } from "vitest"
import { cleanNewUserDays, cleanTrialDays, NO_LAUNCH, personalTrialEnd, resolveLaunch, stillRunning, trialEnd, type LaunchState } from "./launch"

const NOW = Date.parse("2026-11-01T00:00:00Z")
const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString()
const on = (over: Partial<LaunchState> = {}): LaunchState => ({ enforce: true, freeUntil: null, introducedAt: iso(NOW - DAY), newUserTrialDays: 7, ...over })

describe("payments hidden, introduced, and the free periods", () => {
  it("is hidden by default: nothing shown, nothing locked", () => {
    expect(resolveLaunch(NO_LAUNCH, {}, NOW)).toMatchObject({ enforced: false, trial: false, switchedOn: false, introducedAt: null })
  })
  it("introduced with no free period: locked immediately", () => {
    expect(resolveLaunch(on(), {}, NOW)).toMatchObject({ enforced: true, trial: false, switchedOn: true, adminOn: true })
  })
  it("during the free period for everyone nothing is locked, yet payments are shown", () => {
    const s = on({ freeUntil: iso(NOW + 10 * DAY) })
    expect(resolveLaunch(s, {}, NOW)).toMatchObject({ enforced: false, trial: true, switchedOn: true, freeUntil: s.freeUntil })
  })
  it("locks start the moment the free period ends", () => {
    const end = NOW + 10 * DAY
    const s = on({ freeUntil: iso(end) })
    expect(resolveLaunch(s, {}, end - 1).enforced).toBe(false)
    expect(resolveLaunch(s, {}, end).enforced).toBe(true)
    expect(resolveLaunch(s, {}, end + DAY)).toMatchObject({ enforced: true, trial: false })
  })
  it("a free-period date does nothing while payments are hidden", () => {
    expect(resolveLaunch({ ...NO_LAUNCH, freeUntil: iso(NOW + DAY) }, {}, NOW)).toMatchObject({ enforced: false, trial: false, switchedOn: false, freeUntil: null })
  })
  it("the old environment setting still forces payments on", () => {
    expect(resolveLaunch(NO_LAUNCH, { BILLING_ENFORCE_PREMIUM: "true" }, NOW)).toMatchObject({ enforced: true, envForced: true, switchedOn: true })
  })
  it("BILLING_ENABLED=false beats everything", () => {
    expect(resolveLaunch(on(), { BILLING_ENABLED: "false", BILLING_ENFORCE_PREMIUM: "true" }, NOW)).toMatchObject({ enforced: false, switchedOn: false })
  })
})

describe("new users get their own free days", () => {
  const status = resolveLaunch(on({ introducedAt: iso(NOW), newUserTrialDays: 7 }), {}, NOW)
  it("joined after payments were introduced: signup date + 7 days", () => {
    expect(personalTrialEnd(status, iso(NOW + 3 * DAY))).toBe(iso(NOW + 10 * DAY))
  })
  it("joined before: no personal period (they have the free period for everyone instead)", () => {
    expect(personalTrialEnd(status, iso(NOW - DAY))).toBeNull()
  })
  it("joined at the exact moment of introduction counts as new", () => {
    expect(personalTrialEnd(status, iso(NOW))).toBe(iso(NOW + 7 * DAY))
  })
  it("no personal period when hidden, when 0 days, or when the signup date is unknown", () => {
    expect(personalTrialEnd(resolveLaunch(NO_LAUNCH, {}, NOW), iso(NOW))).toBeNull()
    expect(personalTrialEnd({ ...status, newUserTrialDays: 0 }, iso(NOW + DAY))).toBeNull()
    expect(personalTrialEnd(status, null)).toBeNull()
    expect(personalTrialEnd(status, "not a date")).toBeNull()
  })
  it("env-forced payments with no introduction date give no personal periods", () => {
    expect(personalTrialEnd(resolveLaunch(NO_LAUNCH, { BILLING_ENFORCE_PREMIUM: "true" }, NOW), iso(NOW))).toBeNull()
  })
  it("stillRunning is exclusive of the end moment", () => {
    expect([stillRunning(iso(NOW + 1), NOW), stillRunning(iso(NOW), NOW), stillRunning(null, NOW)]).toEqual([true, false, false])
  })
})

describe("helpers", () => {
  it("free-period inputs are whole days in range", () => {
    expect(trialEnd(NOW, 30)).toBe(iso(NOW + 30 * DAY))
    expect(trialEnd(NOW, 0)).toBeNull()
    expect([cleanTrialDays(30), cleanTrialDays("0"), cleanTrialDays(-1), cleanTrialDays(366), cleanTrialDays(1.5), cleanTrialDays("x")]).toEqual([30, 0, null, null, null, null])
    expect([cleanNewUserDays(7), cleanNewUserDays(60), cleanNewUserDays(61)]).toEqual([7, 60, null])
  })
})
