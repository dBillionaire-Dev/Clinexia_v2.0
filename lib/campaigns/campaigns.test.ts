import { describe, expect, it } from "vitest"
import { cleanCampaignInput, isLive, safeUrl, validateResponse, type Campaign } from "./model"
import { addPending, parsePending, prunePending, removePending, MAX_PENDING } from "./pending"
import { afterDone, afterLater, afterShown, freshState, normalizeState, pickCampaign, shouldShow } from "./schedule"

const NOW = Date.parse("2026-11-01T12:00:00Z")
const H = 3_600_000
const D = 86_400_000
const base = { title: "Q4 review", kind: "form", presentation: "modal", heading: "Tell us how we're doing", body: "Two minutes.", ctaLabel: "", ctaUrl: "", audience: "everyone", frequency: "once", repeatDays: 7, allowLater: true, laterHours: 8, durationSeconds: null, dismissible: true, startsAt: null, endsAt: null, status: "active",
  questions: [{ id: "q1", type: "rating", label: "How is it?", required: true }, { id: "q2", type: "choice", label: "Best part?", options: ["Speed", "Price"], required: false }] }
const camp = (over: any = {}): Campaign => ({ id: "c1", version: 1, ...(cleanCampaignInput({ ...base, ...over }) as any).value })
const ctx = (over: any = {}) => ({ now: NOW, signedIn: false, shownThisSession: false, ...over })

describe("campaign settings", () => {
  it("accepts a good form and a good notice", () => {
    expect(cleanCampaignInput(base).ok).toBe(true)
    expect(cleanCampaignInput({ ...base, kind: "notice", questions: [], presentation: "banner", durationSeconds: 10 }).ok).toBe(true)
  })
  it("needs a name, a heading and (for forms) questions", () => {
    expect(cleanCampaignInput({ ...base, title: "" }).ok).toBe(false)
    expect(cleanCampaignInput({ ...base, heading: "  " }).ok).toBe(false)
    expect(cleanCampaignInput({ ...base, questions: [] }).ok).toBe(false)
  })
  it("choice questions need at least two distinct options", () => {
    expect(cleanCampaignInput({ ...base, questions: [{ type: "choice", label: "x", options: ["a", "a"] }] }).ok).toBe(false)
  })
  it("button links must be in-app paths or https, never script links", () => {
    expect(safeUrl("/calculators")).toBe(true)
    expect(safeUrl("https://example.com/x")).toBe(true)
    expect(safeUrl("javascript:alert(1)")).toBe(false)
    expect(safeUrl("//evil.com")).toBe(false)
    expect(safeUrl("http://plain.com")).toBe(false)
    expect(cleanCampaignInput({ ...base, ctaLabel: "Go", ctaUrl: "javascript:alert(1)" }).ok).toBe(false)
    expect(cleanCampaignInput({ ...base, ctaLabel: "Go" }).ok).toBe(false)
  })
  it("the end must come after the start, and bad dates are rejected", () => {
    expect(cleanCampaignInput({ ...base, startsAt: "2026-12-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" }).ok).toBe(false)
    expect(cleanCampaignInput({ ...base, startsAt: "not a date" }).ok).toBe(false)
  })
  it("auto-hide only applies to banners and alerts, and is kept within range", () => {
    expect((cleanCampaignInput({ ...base, presentation: "modal", durationSeconds: 20 }) as any).value.durationSeconds).toBeNull()
    expect((cleanCampaignInput({ ...base, presentation: "toast", durationSeconds: 1 }) as any).value.durationSeconds).toBe(3)
  })
})

describe("scheduling: starts and ends by the clock", () => {
  it("is live only while active and inside its window", () => {
    expect(isLive(camp({ startsAt: new Date(NOW + H).toISOString() }), NOW)).toBe(false)
    expect(isLive(camp({ startsAt: new Date(NOW - H).toISOString() }), NOW)).toBe(true)
    expect(isLive(camp({ endsAt: new Date(NOW - 1).toISOString() }), NOW)).toBe(false)
    expect(isLive(camp({ status: "paused" }), NOW)).toBe(false)
    expect(isLive(camp({ status: "draft" }), NOW)).toBe(false)
  })
  it("a scheduled campaign starts by itself when its time arrives", () => {
    const c = camp({ startsAt: new Date(NOW + 2 * H).toISOString() })
    expect(shouldShow(c, freshState(1), ctx()).show).toBe(false)
    expect(shouldShow(c, freshState(1), ctx({ now: NOW + 3 * H })).show).toBe(true)
  })
})

describe("who sees it, and how often", () => {
  it("respects the audience", () => {
    expect(shouldShow(camp({ audience: "guests" }), freshState(1), ctx({ signedIn: true })).show).toBe(false)
    expect(shouldShow(camp({ audience: "guests" }), freshState(1), ctx({ signedIn: false })).show).toBe(true)
    expect(shouldShow(camp({ audience: "signed_in" }), freshState(1), ctx({ signedIn: false })).show).toBe(false)
  })
  it("once: shown a single time", () => {
    const c = camp()
    const seen = afterShown(freshState(1), NOW)
    expect(shouldShow(c, seen, ctx({ now: NOW + D })).show).toBe(false)
  })
  it("every visit: again next visit, but not twice in one visit", () => {
    const c = camp({ frequency: "every_visit" })
    const seen = afterShown(freshState(1), NOW)
    expect(shouldShow(c, seen, ctx({ now: NOW + D })).show).toBe(true)
    expect(shouldShow(c, seen, ctx({ now: NOW + D, shownThisSession: true })).show).toBe(false)
  })
  it("every N days: only after N days", () => {
    const c = camp({ frequency: "every_days", repeatDays: 3 })
    const seen = afterShown(freshState(1), NOW)
    expect(shouldShow(c, seen, ctx({ now: NOW + 2 * D })).show).toBe(false)
    expect(shouldShow(c, seen, ctx({ now: NOW + 3 * D })).show).toBe(true)
  })
  it("people who answered never see it again, whatever the frequency", () => {
    const c = camp({ frequency: "every_visit" })
    expect(shouldShow(c, afterDone(freshState(1), NOW), ctx({ now: NOW + 30 * D })).show).toBe(false)
  })
  it("'Later' brings it back after the wait, even for a show-once campaign", () => {
    const c = camp({ laterHours: 6 })
    const later = afterLater(afterShown(freshState(1), NOW), c, NOW)
    expect(shouldShow(c, later, ctx({ now: NOW + 5 * H })).show).toBe(false)
    expect(shouldShow(c, later, ctx({ now: NOW + 7 * H })).show).toBe(true)
  })
  it("a new version ('show again to everyone') reaches people who already answered", () => {
    const answered = afterDone(freshState(1), NOW)
    const stored = normalizeState(answered, 2)
    expect(shouldShow({ ...camp(), version: 2 }, stored, ctx({ now: NOW + D })).show).toBe(true)
  })
  it("shows one campaign at a time, newest first", () => {
    const a = { ...camp({ startsAt: new Date(NOW - 5 * D).toISOString() }), id: "a" }
    const b = { ...camp({ startsAt: new Date(NOW - 1 * D).toISOString() }), id: "b" }
    expect(pickCampaign([a, b], {}, ctx())?.id).toBe("b")
    expect(pickCampaign([a, b], { b: afterDone(freshState(1), NOW) }, ctx())?.id).toBe("a")
    expect(pickCampaign([], {}, ctx())).toBeNull()
  })
})

describe("answers are checked against the form the admin built", () => {
  const qs = camp().questions
  it("accepts valid answers and drops unknown fields", () => {
    const r = validateResponse(qs, { q1: 4, q2: "Speed", extra: "x" })
    expect(r.ok && r.value).toEqual({ q1: 4, q2: "Speed" })
  })
  it("requires required questions and rejects values that are not on the lists", () => {
    expect(validateResponse(qs, { q2: "Speed" }).ok).toBe(false)
    expect(validateResponse(qs, { q1: 9 }).ok).toBe(false)
    expect(validateResponse(qs, { q1: 3, q2: "Free" }).ok).toBe(false)
    expect(validateResponse(qs, { q1: 3 }).ok).toBe(true)
    expect(validateResponse(qs, null).ok).toBe(false)
  })
  it("handles text, yes/no and multi-choice", () => {
    const more = [{ id: "t", type: "text", label: "Why", required: true }, { id: "y", type: "yesno", label: "Again?", required: true }, { id: "m", type: "multi", label: "Pick", options: ["a", "b"], required: true }] as any
    expect(validateResponse(more, { t: "  hello ", y: "yes", m: ["a", "a"] })).toMatchObject({ ok: true, value: { t: "hello", y: "yes", m: ["a"] } })
    expect(validateResponse(more, { t: "x", y: "maybe", m: ["a"] }).ok).toBe(false)
    expect(validateResponse(more, { t: "x", y: "no", m: ["z"] }).ok).toBe(false)
  })
})

describe("parked behind the profile icon ('Remind me later')", () => {
  const pub = (id: string, version = 1) => { const { title: _t, status: _s, ...c } = { ...camp(), id, version } as any; return c }
  it("adds a campaign once, newest first, and replaces an older copy of the same one", () => {
    let list = addPending([], pub("a"), 1)
    list = addPending(list, pub("b"), 2)
    list = addPending(list, pub("a", 2), 3)
    expect(list.map((p) => p.id)).toEqual(["a", "b"])
    expect(list[0].version).toBe(2)
  })
  it("keeps only a handful", () => {
    let list: any[] = []
    for (let i = 0; i < 9; i++) list = addPending(list, pub(`c${i}`), i)
    expect(list).toHaveLength(MAX_PENDING)
  })
  it("removes one when it is completed or dismissed", () => {
    const list = addPending(addPending([], pub("a"), 1), pub("b"), 2)
    expect(removePending(list, "a").map((p) => p.id)).toEqual(["b"])
  })
  it("drops campaigns that ended, were paused or deleted, or were re-versioned", () => {
    const list = addPending(addPending([], pub("a"), 1), pub("b"), 2)
    expect(prunePending(list, [{ id: "a", version: 1 }]).map((p) => p.id)).toEqual(["a"])
    expect(prunePending(list, [{ id: "a", version: 2 }, { id: "b", version: 1 }]).map((p) => p.id)).toEqual(["b"])
    expect(prunePending(list, [])).toEqual([])
  })
  it("reads storage safely", () => {
    const stored = JSON.stringify(addPending([], pub("a"), 1))
    expect(parsePending(stored)).toHaveLength(1)
    expect(parsePending(null)).toEqual([])
    expect(parsePending("not json")).toEqual([])
    expect(parsePending('[{"id":1}]')).toEqual([])
    expect(parsePending('{"a":1}')).toEqual([])
  })
})
