import { describe, expect, it } from "vitest"
import { DELETION_GRACE_DAYS, deletionPhase, retiredEmail } from "./account-deletion"
import { composeAccountDeletedEmail } from "./emails"

const DAY = 86_400_000
const NOW = Date.parse("2026-11-10T00:00:00Z")
const iso = (t: number) => new Date(t).toISOString()

describe("account deletion phases", () => {
  it("an account that was never deleted is untouched", () => {
    expect(deletionPhase({}, NOW)).toEqual({ phase: "none", restoreUntil: null })
    expect(deletionPhase({ deletedAt: null }, NOW).phase).toBe("none")
    expect(deletionPhase({ deletedAt: "not a date" }, NOW).phase).toBe("none")
  })
  it("for 7 days it can be restored, and the deadline is exact", () => {
    const at = NOW - 2 * DAY
    expect(deletionPhase({ deletedAt: iso(at) }, NOW)).toEqual({ phase: "pending", restoreUntil: iso(at + DELETION_GRACE_DAYS * DAY) })
    const end = at + DELETION_GRACE_DAYS * DAY
    expect(deletionPhase({ deletedAt: iso(at) }, end - 1).phase).toBe("pending")
    expect(deletionPhase({ deletedAt: iso(at) }, end).phase).toBe("final")
  })
  it("final even before the daily job has marked it, or once it has", () => {
    expect(deletionPhase({ deletedAt: iso(NOW - 8 * DAY) }, NOW).phase).toBe("final")
    expect(deletionPhase({ deletedAt: iso(NOW - DAY), deletionFinalAt: iso(NOW) }, NOW)).toEqual({ phase: "final", restoreUntil: null })
  })
  it("the retired email is unique per account and cannot receive mail", () => {
    expect(retiredEmail("abc")).toBe("deleted-abc@deleted.invalid")
    expect(retiredEmail("a")).not.toBe(retiredEmail("b"))
  })
  it("the deletion email gives the restore date and the sign-in link", () => {
    const e = composeAccountDeletedEmail({ name: "Ada", restoreUntil: "2026-11-17T00:00:00Z", loginUrl: "https://x.test/login" })
    expect(e.text).toContain("17 November 2026")
    expect(e.text).toContain("https://x.test/login")
    expect(e.subject).toBe("Your Clinexia account was deleted")
  })
})
