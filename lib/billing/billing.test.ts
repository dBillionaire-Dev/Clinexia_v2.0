import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { CATEGORY_SPECIALTY, DEFAULT_PRICING, SPECIALTIES, billingEnabled, marketFromCountry, parsePricingConfig, premiumEnforced } from "./config"
import { canDeleteUser, cleanReason, confirmationMatches, suspendedMessage } from "./admin-rules"
import { composeNotice, sendEmail } from "./notify"
import { corsHeadersFor, corsPath, isTrustedOrigin } from "./cors"
import { accountNameFor, isDeviceId, summariseHistory } from "./history"
import { explainSetupError, missingSqlHint } from "./setup-hints"
import { summariseChecks } from "./setup-check"
import { GUEST_CALC_LIMIT, isGuestLimited, noteGuestCalculation, readGuestCount, safeNextPath, writeSessionState } from "./guest"
import { canUseCalculator, hasSpecialty, isPremiumCalculator, resolveEntitlements, type MembershipContext, type PlanRecord } from "./entitlements"
import { addMonthsUtc, effectiveStatus, nextPeriodEnd } from "./lifecycle"
import { hashInviteToken, invitationState, parseEmailList } from "./invitations"
import { processPaystackWebhook, type ApplyResult, type PaymentStore } from "./payments"
import type { PaymentProvider, VerifiedTransaction } from "./paystack"
import { computeQuote, formatMoney, naira } from "./pricing"
import { can, canManageMember } from "./roles"
import { seatUsage } from "./seats"
import { validateOrganisation, validateSignup } from "./validation"
import {
  acceptInvitation, getDashboard, inviteMembers, leaveOrganisation, removeMember, revokeInvitation, setMemberSpecialties,
  type AcceptResult, type CreateInviteResult, type InviteRecord, type MemberRecord, type OrgRecord, type OrgStore, type Settings,
} from "./org-actions"
import type { Specialty } from "./config"
import type { OrgRole } from "./roles"

const P = DEFAULT_PRICING
const NOW = Date.parse("2026-11-01T00:00:00Z")
const DAY = 86_400_000
const ok = (r: any) => { if (!r.ok) throw new Error(r.error ?? "not ok"); return r.quote }

describe("feature switches", () => {
  it("is on by default for testing, and BILLING_ENABLED=false switches it off", () => {
    expect(billingEnabled({})).toBe(true)
    expect(billingEnabled({ BILLING_ENABLED: "false" })).toBe(false)
  })
  it("premium locking is a separate switch that is off by default", () => {
    expect(premiumEnforced({})).toBe(false)
    expect(premiumEnforced({ BILLING_ENFORCE_PREMIUM: "true" })).toBe(true)
    expect(premiumEnforced({ BILLING_ENABLED: "false", BILLING_ENFORCE_PREMIUM: "true" })).toBe(false)
  })
  it("every existing calculator category maps to a known specialty", () => {
    for (const s of Object.values(CATEGORY_SPECIALTY)) expect(SPECIALTIES as readonly string[]).toContain(s)
  })
})

describe("markets: naira for Nigeria, dollars elsewhere", () => {
  const quote = (market: any, input: any) => ok(computeQuote(input, P, market))
  it("detects the market from the visitor's country (unknown means Nigeria)", () => {
    expect(marketFromCountry("NG")).toBe("ng")
    expect(marketFromCountry("ng")).toBe("ng")
    expect(marketFromCountry("US")).toBe("intl")
    expect(marketFromCountry("GH")).toBe("intl")
    expect(marketFromCountry(null)).toBe("ng")
    expect(marketFromCountry("")).toBe("ng")
  })
  it("quotes in the market's own currency with its own prices", () => {
    const ng = quote("ng", { kind: "individual", plan: "all_access" })
    const intl = quote("intl", { kind: "individual", plan: "all_access" })
    expect(ng).toMatchObject({ currency: "NGN", market: "ng", totalMinor: 500_000 })
    expect(intl).toMatchObject({ currency: "USD", market: "intl", totalMinor: P.markets.intl.individual.allAccessMinor })
  })
  it("the two markets are independent: changing dollar prices never moves naira prices", () => {
    const cfg = parsePricingConfig({ markets: { intl: { individual: { allAccessMinor: 1234, specialtyMinor: 99 } } } })
    expect(cfg.markets.intl.individual.allAccessMinor).toBe(1234)
    expect(cfg.markets.ng.individual.allAccessMinor).toBe(500_000)
    expect(ok(computeQuote({ kind: "individual", plan: "specialty", specialties: ["renal", "laboratory"] }, cfg, "intl")).totalMinor).toBe(99 + cfg.markets.intl.individual.additionalSpecialtyMinor)
  })
  it("enterprise cap, extra seats and the discount work per market", () => {
    const intl = P.markets.intl.enterprise
    expect(quote("intl", { kind: "enterprise", plan: "all_access", seats: 10 }).totalMinor).toBe(Math.min(10 * intl.allAccessPerSeatMinor, intl.allAccessBlockMinor))
    expect(quote("intl", { kind: "enterprise", plan: "all_access", seats: 12 }).totalMinor).toBe(intl.allAccessBlockMinor + 2 * intl.extraSeatMinor)
    const v = quote("intl", { kind: "enterprise", plan: "all_access", seats: 1, managedStatus: "verified" })
    expect(v.totalMinor).toBe(Math.round(intl.allAccessPerSeatMinor * 0.9))
    expect(v.currency).toBe("USD")
  })
  it("an older flat stored config is read as the Nigeria prices", () => {
    const cfg = parsePricingConfig({ individual: { allAccessMinor: 700_000 } })
    expect(cfg.markets.ng.individual.allAccessMinor).toBe(700_000)
    expect(cfg.markets.intl.individual.allAccessMinor).toBe(P.markets.intl.individual.allAccessMinor)
  })
  it("formats both currencies", () => {
    expect(formatMoney(250_000, "NGN")).toBe("₦2,500")
    expect(formatMoney(650, "USD")).toBe("$6.50")
    expect(formatMoney(600, "USD")).toBe("$6")
  })
})

describe("administrator safety rules and notices", () => {
  it("a reason is required and cleaned", () => {
    expect(cleanReason("  Repeated   chargebacks \n")).toBe("Repeated chargebacks")
    expect(cleanReason("no")).toBeNull()
    expect(cleanReason(undefined)).toBeNull()
    expect(cleanReason("x".repeat(501))).toBeNull()
  })
  it("deletion needs the exact email or name typed back", () => {
    expect(confirmationMatches(" Ada@X.com ", "ada@x.com")).toBe(true)
    expect(confirmationMatches("ada@y.com", "ada@x.com")).toBe(false)
    expect(confirmationMatches(undefined, "ada@x.com")).toBe(false)
    expect(confirmationMatches("", "")).toBe(false)
  })
  it("an organisation owner cannot be deleted until the organisation is dealt with", () => {
    expect(canDeleteUser({ ownedOrganisations: 0 }).ok).toBe(true)
    expect(canDeleteUser({ ownedOrganisations: 2 })).toMatchObject({ ok: false })
  })
  it("the suspension notice includes the reason and tells the person how to appeal", () => {
    const n = composeNotice("user_suspended", { reason: "Shared login across staff" })
    expect(n.subject).toContain("suspended")
    expect(n.text).toContain("Reason: Shared login across staff")
    expect(n.text).toContain("mistake")
    expect(composeNotice("user_restored", { reason: "ignored" }).text).toContain("active again")
    expect(composeNotice("user_restored", { reason: "ignored" }).text.includes("Reason")).toBe(false)
    expect(composeNotice("org_deleted", { name: "City Lab", reason: "Fraud" }).text).toContain("City Lab")
  })
  it("a suspended person is shown the notice when they try to sign in", () => {
    expect(suspendedMessage("Reason: fraud")).toContain("Reason: fraud")
    expect(suspendedMessage(null)).toContain("suspended")
  })
  it("email is skipped, not faked, when no provider is configured", async () => {
    expect(await sendEmail("a@b.com", "s", "t", (async () => { throw new Error("must not be called") }) as any)).toBe("not_configured")
  })
})

describe("pricing", () => {
  it("individual: first specialty 2,500, each extra 1,000, all-access 5,000", () => {
    expect(ok(computeQuote({ kind: "individual", plan: "specialty", specialties: ["laboratory"] }, P)).totalMinor).toBe(250_000)
    expect(ok(computeQuote({ kind: "individual", plan: "specialty", specialties: ["laboratory", "pharmacy", "renal"] }, P)).totalMinor).toBe(450_000)
    expect(ok(computeQuote({ kind: "individual", plan: "all_access" }, P)).totalMinor).toBe(500_000)
  })
  it("tells the buyer when all-access is the cheaper choice", () => {
    expect(ok(computeQuote({ kind: "individual", plan: "specialty", specialties: ["laboratory", "pharmacy", "renal", "nursing"] }, P)).allAccessIsCheaper).toBe(true)
    expect(ok(computeQuote({ kind: "individual", plan: "specialty", specialties: ["laboratory"] }, P)).allAccessIsCheaper).toBe(false)
  })
  it("never double-charges a repeated specialty", () => {
    expect(ok(computeQuote({ kind: "individual", plan: "specialty", specialties: ["renal", "renal"] }, P)).totalMinor).toBe(250_000)
  })
  it("rejects bad input", () => {
    expect(computeQuote({ kind: "individual", plan: "specialty", specialties: [] }, P).ok).toBe(false)
    expect(computeQuote({ kind: "individual", plan: "specialty", specialties: ["magic"] }, P).ok).toBe(false)
    expect(computeQuote({ kind: "enterprise", plan: "all_access", seats: 0 }, P).ok).toBe(false)
    expect(computeQuote({ kind: "enterprise", plan: "all_access", seats: 2.5 }, P).ok).toBe(false)
    expect(computeQuote({ kind: "enterprise", plan: "all_access", seats: 999_999 }, P).ok).toBe(false)
    expect(computeQuote({ kind: "individual", plan: "gold" as any }, P).ok).toBe(false)
  })
  it("enterprise specialty plans are per seat", () => {
    expect(ok(computeQuote({ kind: "enterprise", plan: "specialty", specialties: ["laboratory"], seats: 8 }, P)).totalMinor).toBe(8 * 250_000)
    expect(ok(computeQuote({ kind: "enterprise", plan: "specialty", specialties: ["laboratory", "renal"], seats: 8 }, P)).totalMinor).toBe(8 * 350_000)
  })
  it("enterprise all-access: capped at 45,000 for the first 10 seats, then 2,500 per new seat", () => {
    const t = (seats: number) => ok(computeQuote({ kind: "enterprise", plan: "all_access", seats }, P)).totalMinor
    expect(t(1)).toBe(500_000)
    expect(t(9)).toBe(4_500_000)
    expect(t(10)).toBe(4_500_000)
    expect(t(11)).toBe(4_750_000)
    expect(t(25)).toBe(4_500_000 + 15 * 250_000)
  })
  it("the 10% managed discount applies only to verified organisations, and means paying 90%", () => {
    const q = (managedStatus: any) => ok(computeQuote({ kind: "enterprise", plan: "all_access", seats: 1, managedStatus }, P))
    expect(q("verified").totalMinor).toBe(450_000) // 5,000 -> 4,500
    expect(q("verified").discount).toMatchObject({ applied: true, bps: 1000, amountMinor: 50_000 })
    for (const s of ["none", "requested", "rejected", undefined]) expect(q(s).discount.applied).toBe(false)
    expect(q("requested").totalMinor).toBe(500_000)
  })
  it("a client-supplied discount flag is ignored by the quote function's inputs", () => {
    const r = computeQuote({ kind: "enterprise", plan: "all_access", seats: 1, discount: true, managedStatus: "none" } as any, P)
    expect(ok(r).discount.applied).toBe(false)
  })
  it("individuals never get the enterprise discount", () => {
    expect(ok(computeQuote({ kind: "individual", plan: "all_access", managedStatus: "verified" }, P)).discount.applied).toBe(false)
  })
  it("prices and the discount are configurable, and bad overrides are ignored", () => {
    const cfg = parsePricingConfig({ markets: { ng: { individual: { allAccessMinor: 600_000, specialtyMinor: -5 } } }, managedDiscountBps: 1500, graceDays: "x" })
    expect(cfg.markets.ng.individual.allAccessMinor).toBe(600_000)
    expect(cfg.markets.ng.individual.specialtyMinor).toBe(250_000)
    expect(cfg.managedDiscountBps).toBe(1500)
    expect(cfg.graceDays).toBe(7)
    expect(parsePricingConfig("junk")).toEqual(DEFAULT_PRICING)
  })
  it("formats naira", () => {
    expect(naira(250_000)).toBe("₦2,500")
  })
})

const plan = (over: Partial<PlanRecord> = {}): PlanRecord => ({ plan: "specialty", specialties: ["laboratory"], status: "active", currentPeriodEnd: new Date(NOW + 10 * DAY).toISOString(), ...over })
const member = (over: Partial<MembershipContext> = {}): MembershipContext => ({ orgId: "o1", role: "staff", allSpecialties: true, specialties: [], seatIndex: 0, orgSeats: 5, orgSuspended: false, orgPlan: plan(), ...over })
const resolve = (individual: PlanRecord | null, memberships: MembershipContext[] = []) => resolveEntitlements({ individual, memberships, now: NOW, graceDays: 7 })

describe("entitlements", () => {
  it("a laboratory subscriber gets laboratory only", () => {
    const e = resolve(plan())
    expect(e.specialties).toEqual(["laboratory"])
    expect(hasSpecialty(e, "pharmacy")).toBe(false)
  })
  it("all-access covers every specialty", () => {
    const e = resolve(plan({ plan: "all_access", specialties: [] }))
    expect(e.all).toBe(true)
    expect(e.specialties).toHaveLength(SPECIALTIES.length)
  })
  it("no plan means no premium specialties", () => {
    expect(resolve(null)).toMatchObject({ all: false, specialties: [] })
    expect(resolve(plan({ status: "pending", currentPeriodEnd: null })).specialties).toEqual([])
  })
  it("combines an individual plan with an organisation seat", () => {
    const e = resolve(plan({ specialties: ["renal"] }), [member()])
    expect(e.specialties).toEqual(["laboratory", "renal"])
  })
  it("staff receive only what the organisation plan covers AND what they were assigned", () => {
    const org = plan({ plan: "specialty", specialties: ["laboratory", "pharmacy"] })
    expect(resolve(null, [member({ orgPlan: org, allSpecialties: false, specialties: ["pharmacy", "cardiology"] })]).specialties).toEqual(["pharmacy"])
  })
  it("an all-access organisation covers every specialty for members with all access, and only assignments otherwise", () => {
    const org = plan({ plan: "all_access", specialties: [] })
    expect(resolve(null, [member({ orgPlan: org })]).all).toBe(true)
    expect(resolve(null, [member({ orgPlan: org, allSpecialties: false, specialties: ["nursing"] })]).specialties).toEqual(["nursing"])
  })
  it("members beyond the paid seat count, suspended organisations and lapsed plans give nothing", () => {
    expect(resolve(null, [member({ seatIndex: 5, orgSeats: 5 })]).specialties).toEqual([])
    expect(resolve(null, [member({ orgSuspended: true })]).specialties).toEqual([])
    expect(resolve(null, [member({ orgPlan: plan({ currentPeriodEnd: new Date(NOW - 30 * DAY).toISOString() }) })]).specialties).toEqual([])
    expect(resolve(null, [member({ orgPlan: null })]).specialties).toEqual([])
  })
  it("changing a profile role cannot widen access (role is not an input)", () => {
    const m = member({ allSpecialties: false, specialties: [] })
    expect(resolve(null, [m]).specialties).toEqual([])
    expect(resolve(null, [{ ...m, role: "owner" }]).specialties).toEqual([]) // org role does not grant specialties either
  })
  it("two organisations cannot leak access into each other", () => {
    const a = member({ orgId: "a", orgPlan: plan({ specialties: ["laboratory"] }) })
    const b = member({ orgId: "b", orgPlan: plan({ specialties: ["pharmacy"] }), allSpecialties: false, specialties: [] })
    expect(resolve(null, [a, b]).specialties).toEqual(["laboratory"])
  })
})

describe("free versus premium", () => {
  const calc = (id: string, category: any) => ({ id, category })
  it("nothing is locked while enforcement is off (today's behaviour)", () => {
    expect(canUseCalculator(calc("egfr", "renal"), resolve(null), false)).toBe(true)
  })
  it("free tools stay free when enforcement is on", () => {
    expect(isPremiumCalculator(calc("bmi", "general"))).toBe(false)
    expect(canUseCalculator(calc("bmi", "general"), resolve(null), true)).toBe(true)
  })
  it("premium tools need the matching specialty when enforcement is on", () => {
    expect(canUseCalculator(calc("egfr", "renal"), resolve(null), true)).toBe(false)
    expect(canUseCalculator(calc("egfr", "renal"), resolve(plan({ specialties: ["renal"] })), true)).toBe(true)
    expect(canUseCalculator(calc("ldl", "chemistry"), resolve(plan({ specialties: ["laboratory"] })), true)).toBe(true)
    expect(canUseCalculator(calc("ldl", "chemistry"), resolve(plan({ specialties: ["pharmacy"] })), true)).toBe(false)
    expect(canUseCalculator(calc("egfr", "renal"), resolve(plan({ plan: "all_access", specialties: [] })), true)).toBe(true)
  })
})

describe("subscription lifecycle", () => {
  const sub = (status: any, endOffsetDays: number | null) => ({ status, currentPeriodEnd: endOffsetDays === null ? null : new Date(NOW + endOffsetDays * DAY).toISOString() })
  it("active until the end, then a grace period, then expired", () => {
    expect(effectiveStatus(sub("active", 1), NOW, 7)).toBe("active")
    expect(effectiveStatus(sub("active", -3), NOW, 7)).toBe("grace")
    expect(effectiveStatus(sub("past_due", -3), NOW, 7)).toBe("grace")
    expect(effectiveStatus(sub("active", -8), NOW, 7)).toBe("expired")
  })
  it("cancelled keeps access to the paid end date and gets no grace", () => {
    expect(effectiveStatus(sub("cancelled", 5), NOW, 7)).toBe("active")
    expect(effectiveStatus(sub("cancelled", -1), NOW, 7)).toBe("expired")
  })
  it("pending and expired never grant access; missing dates fail closed", () => {
    expect(effectiveStatus(sub("pending", null), NOW, 7)).toBe("pending")
    expect(effectiveStatus(sub("expired", 10), NOW, 7)).toBe("expired")
    expect(effectiveStatus(sub("active", null), NOW, 7)).toBe("expired")
  })
  it("adds calendar months with end-of-month clamping", () => {
    expect(new Date(addMonthsUtc(Date.parse("2026-01-31T00:00:00Z"), 1)).toISOString()).toBe("2026-02-28T00:00:00.000Z")
    expect(new Date(addMonthsUtc(Date.parse("2026-12-15T00:00:00Z"), 1)).toISOString()).toBe("2027-01-15T00:00:00.000Z")
  })
  it("renewal extends from the current end; a plan change starts fresh from now (no proration)", () => {
    const end = new Date(NOW + 10 * DAY).toISOString()
    expect(nextPeriodEnd({ currentPeriodEnd: end, now: NOW, months: 1, sameTarget: true })).toBe(addMonthsUtc(NOW + 10 * DAY, 1))
    expect(nextPeriodEnd({ currentPeriodEnd: end, now: NOW, months: 1, sameTarget: false })).toBe(addMonthsUtc(NOW, 1))
    expect(nextPeriodEnd({ currentPeriodEnd: new Date(NOW - 20 * DAY).toISOString(), now: NOW, months: 1, sameTarget: true })).toBe(addMonthsUtc(NOW, 1))
  })
})

describe("roles, seats and invitations (pure rules)", () => {
  it("permission matrix", () => {
    expect(can("owner", "org.billing")).toBe(true)
    expect(can("admin", "org.billing")).toBe(false)
    expect(can("admin", "member.invite")).toBe(true)
    expect(can("staff", "member.invite")).toBe(false)
    expect(canManageMember("admin", "admin")).toBe(false)
    expect(canManageMember("admin", "owner")).toBe(false)
    expect(canManageMember("owner", "admin")).toBe(true)
    expect(canManageMember("staff", "staff")).toBe(false)
  })
  it("shows seat usage, counting pending invitations as taken", () => {
    expect(seatUsage({ seats: 25, members: 15, pendingInvitations: 3 }).label).toBe("18 of 25 seats used")
    expect(seatUsage({ seats: 5, members: 5, pendingInvitations: 0 }).available).toBe(0)
  })
  it("expiry and revocation change an invitation's state", () => {
    const base = { status: "pending" as const, expiresAt: new Date(NOW + DAY).toISOString() }
    expect(invitationState(base, NOW)).toBe("pending")
    expect(invitationState(base, NOW + 2 * DAY)).toBe("expired")
    expect(invitationState({ ...base, status: "revoked" as any }, NOW)).toBe("revoked")
  })
  it("parses bulk email lists, dropping duplicates and flagging bad entries", () => {
    const r = parseEmailList("A@x.com, a@x.com\nb@y.org; nope")
    expect(r.emails).toEqual(["a@x.com", "b@y.org"])
    expect(r.invalid).toEqual(["nope"])
  })
})

describe("validation", () => {
  const good = { email: " Me@Example.com ", password: "long-enough-pw", fullName: "Ada O", accountType: "individual", background: "medical", role: "laboratory" }
  it("accepts a valid individual sign-up and normalises the email", () => {
    const r = validateSignup(good)
    expect(r.ok && r.value.email).toBe("me@example.com")
  })
  it("rejects weak passwords, bad emails and mismatched roles", () => {
    expect(validateSignup({ ...good, password: "short" }).ok).toBe(false)
    expect(validateSignup({ ...good, email: "nope" }).ok).toBe(false)
    expect(validateSignup({ ...good, background: "non_medical", role: "laboratory" }).ok).toBe(false)
    expect(validateSignup(null).ok).toBe(false)
  })
  it("enterprise sign-up does not need a profile role", () => {
    expect(validateSignup({ ...good, accountType: "enterprise", background: undefined, role: undefined }).ok).toBe(true)
  })
  it("validates organisation details", () => {
    expect(validateOrganisation({ name: "City Lab", orgType: "laboratory" }).ok).toBe(true)
    expect(validateOrganisation({ name: "X", orgType: "laboratory" }).ok).toBe(false)
    expect(validateOrganisation({ name: "City Lab", orgType: "casino" }).ok).toBe(false)
  })
})

// ---------- in-memory organisation store (same contract as the Supabase one) ----------
function memoryStore(seed: { orgs: OrgRecord[]; members: Array<MemberRecord & { orgId: string }> }) {
  const orgs = new Map(seed.orgs.map((o) => [o.id, o]))
  const members = [...seed.members]
  const invites: Array<InviteRecord & { orgId: string; tokenHash: string; status: "pending" | "accepted" | "revoked" }> = []
  const audits: string[] = []
  let n = 0
  const store: OrgStore = {
    async getOrg(id) { return orgs.get(id) ?? null },
    async getMember(orgId, userId) { return members.find((m) => m.orgId === orgId && m.userId === userId) ?? null },
    async listMembers(orgId) { return members.filter((m) => m.orgId === orgId) },
    async listPendingInvites(orgId) { return invites.filter((i) => i.orgId === orgId && i.status === "pending" && Date.parse(i.expiresAt) > NOW) },
    async createOrg(input) { const id = `org${++n}`; orgs.set(id, { id, name: input.name, orgType: input.orgType, seats: 0, suspended: false, managedStatus: "none", plan: null }); members.push({ orgId: id, userId: input.ownerUserId, email: "", fullName: "", role: "owner", allSpecialties: true, specialties: [], joinedAt: "" }); return { id } },
    async createInvite(i): Promise<CreateInviteResult> {
      const org = orgs.get(i.orgId)!
      const pending = invites.filter((x) => x.orgId === i.orgId && x.status === "pending" && Date.parse(x.expiresAt) > NOW)
      if (members.some((m) => m.orgId === i.orgId && m.email === i.email)) return { ok: false, reason: "already_member" }
      if (pending.some((x) => x.email === i.email)) return { ok: false, reason: "duplicate_invite" }
      if (members.filter((m) => m.orgId === i.orgId).length + pending.length >= org.seats) return { ok: false, reason: "no_capacity" }
      const rec = { id: `inv${++n}`, orgId: i.orgId, email: i.email, role: i.role, allSpecialties: i.allSpecialties, specialties: i.specialties, expiresAt: i.expiresAt, tokenHash: i.tokenHash, status: "pending" as const }
      invites.push(rec)
      return { ok: true, invite: rec }
    },
    async revokeInvite(orgId, id) { const i = invites.find((x) => x.orgId === orgId && x.id === id && x.status === "pending"); if (!i) return false; i.status = "revoked"; return true },
    async removeMember(orgId, userId) { const k = members.findIndex((m) => m.orgId === orgId && m.userId === userId); if (k < 0) return false; members.splice(k, 1); return true },
    async updateMember(orgId, userId, patch) { const m = members.find((x) => x.orgId === orgId && x.userId === userId); if (!m) return false; Object.assign(m, patch); return true },
    async acceptInvite(input): Promise<AcceptResult> {
      const i = invites.find((x) => x.tokenHash === input.tokenHash)
      if (!i) return { ok: false, reason: "invalid" }
      if (i.status === "accepted") return { ok: false, reason: "used" }
      if (i.status === "revoked") return { ok: false, reason: "revoked" }
      if (Date.parse(i.expiresAt) <= NOW) return { ok: false, reason: "expired" }
      if (i.email !== input.email) return { ok: false, reason: "wrong_email" }
      if (members.some((m) => m.orgId === i.orgId && m.userId === input.userId)) return { ok: false, reason: "already_member" }
      members.push({ orgId: i.orgId, userId: input.userId, email: input.email, fullName: "", role: i.role, allSpecialties: i.allSpecialties, specialties: i.specialties, joinedAt: "" })
      i.status = "accepted"
      return { ok: true, orgId: i.orgId }
    },
    async audit(e) { audits.push(e.action) },
  }
  return { store, members, invites, audits }
}

const S: Settings = { graceDays: 7, invitationTtlHours: 168, now: NOW }
const orgPlan = plan({ plan: "specialty", specialties: ["laboratory", "pharmacy"] })
const mem = (orgId: string, userId: string, role: OrgRole, over: Partial<MemberRecord> = {}) => ({ orgId, userId, email: `${userId}@x.com`.toLowerCase(), fullName: userId, role, allSpecialties: true, specialties: [] as Specialty[], joinedAt: "", ...over })
const world = (seats = 3, p: PlanRecord | null = orgPlan) =>
  memoryStore({
    orgs: [
      { id: "A", name: "A Lab", orgType: "laboratory", seats, suspended: false, managedStatus: "none", plan: p },
      { id: "B", name: "B Lab", orgType: "laboratory", seats: 5, suspended: false, managedStatus: "none", plan: orgPlan },
    ],
    members: [mem("A", "ownerA", "owner"), mem("A", "adminA", "admin"), mem("A", "staffA", "staff"), mem("B", "ownerB", "owner")],
  })

describe("organisation onboarding", () => {
  it("creating an organisation makes the creator its owner", async () => {
    const w = world()
    const r = await (await import("./org-actions")).createOrganisation(w.store, { userId: "newbie" }, { name: "New Clinic", orgType: "clinic" })
    expect(r.ok).toBe(true)
    const m = await w.store.getMember((r as any).orgId, "newbie")
    expect(m?.role).toBe("owner")
  })
})

describe("invitations and seats", () => {
  it("owner invites within the plan, and each pending invitation reserves a seat", async () => {
    const w = world(4) // 3 members + 1 free seat
    const first = await inviteMembers(w.store, { userId: "ownerA" }, "A", { emails: "new1@x.com, new2@x.com", role: "staff", specialties: ["laboratory"] }, S)
    expect(first.ok && first.created.map((c) => c.email)).toEqual(["new1@x.com"])
    expect(first.ok && first.skipped[0]).toMatchObject({ email: "new2@x.com", reason: "No free seats." })
    const dash = await getDashboard(w.store, { userId: "ownerA" }, "A", S)
    expect(dash.ok && dash.seats.label).toBe("4 of 4 seats used")
  })
  it("never exceeds the seat limit under concurrent requests", async () => {
    const w = world(5) // 2 free seats
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => inviteMembers(w.store, { userId: "ownerA" }, "A", { emails: `p${i}@x.com`, role: "staff", specialties: ["laboratory"] }, S)))
    const created = results.reduce((n, r) => n + (r.ok ? r.created.length : 0), 0)
    expect(created).toBe(2)
    expect(w.members.filter((m) => m.orgId === "A").length + w.invites.filter((i) => i.status === "pending").length).toBe(5)
  })
  it("rejects duplicates and people who are already members", async () => {
    const w = world(10)
    await inviteMembers(w.store, { userId: "ownerA" }, "A", { emails: "dup@x.com", role: "staff", specialties: ["laboratory"] }, S)
    const again = await inviteMembers(w.store, { userId: "ownerA" }, "A", { emails: "dup@x.com, staffA@x.com", role: "staff", specialties: ["laboratory"] }, S)
    expect(again.ok && again.skipped.map((s) => s.reason)).toEqual(["Already invited.", "Already a member."])
  })
  it("refuses specialties outside the organisation plan, and roles the actor cannot hand out", async () => {
    const w = world(10)
    expect(await inviteMembers(w.store, { userId: "ownerA" }, "A", { emails: "x1@x.com", role: "staff", specialties: ["cardiology"] }, S)).toMatchObject({ ok: false, code: "forbidden" })
    expect(await inviteMembers(w.store, { userId: "adminA" }, "A", { emails: "x2@x.com", role: "admin", specialties: ["laboratory"] }, S)).toMatchObject({ ok: false, code: "forbidden" })
    expect(await inviteMembers(w.store, { userId: "staffA" }, "A", { emails: "x3@x.com", role: "staff", specialties: ["laboratory"] }, S)).toMatchObject({ ok: false, code: "forbidden" })
  })
  it("needs an active subscription to invite", async () => {
    const w = world(10, plan({ currentPeriodEnd: new Date(NOW - 30 * DAY).toISOString() }))
    expect(await inviteMembers(w.store, { userId: "ownerA" }, "A", { emails: "x@x.com", role: "staff", specialties: ["laboratory"] }, S)).toMatchObject({ ok: false, code: "subscription_inactive" })
  })
  it("a revoked invitation frees its seat and cannot be accepted", async () => {
    const w = world(4)
    const r = await inviteMembers(w.store, { userId: "ownerA" }, "A", { emails: "gone@x.com", role: "staff", specialties: ["laboratory"] }, S)
    const token = (r as any).created[0].token
    await revokeInvitation(w.store, { userId: "adminA" }, "A", w.invites[0].id)
    expect((await acceptInvitation(w.store, { userId: "u9", email: "gone@x.com" }, token))).toMatchObject({ ok: false })
    const again = await inviteMembers(w.store, { userId: "ownerA" }, "A", { emails: "next@x.com", role: "staff", specialties: ["laboratory"] }, S)
    expect(again.ok && again.created).toHaveLength(1)
  })
  it("accepting joins the organisation once, only with the invited email, and expired invitations fail", async () => {
    const w = world(4)
    const r = await inviteMembers(w.store, { userId: "ownerA" }, "A", { emails: "joiner@x.com", role: "staff", specialties: ["laboratory"] }, S)
    const token = (r as any).created[0].token
    expect(await acceptInvitation(w.store, { userId: "u1", email: "other@x.com" }, token)).toMatchObject({ ok: false })
    expect(await acceptInvitation(w.store, { userId: "u1", email: "Joiner@X.com" }, token)).toMatchObject({ ok: true, orgId: "A" })
    expect(await acceptInvitation(w.store, { userId: "u1", email: "joiner@x.com" }, token)).toMatchObject({ ok: false })
    w.invites[0].expiresAt = new Date(NOW - 1).toISOString()
    w.invites[0].status = "pending"
    expect(await acceptInvitation(w.store, { userId: "u2", email: "joiner@x.com" }, token)).toMatchObject({ ok: false })
    expect(hashInviteToken(token)).toBe(w.invites[0].tokenHash)
  })
  it("rejects malformed invitation tokens", async () => {
    expect(await acceptInvitation(world().store, { userId: "u", email: "u@x.com" }, "short")).toMatchObject({ ok: false, code: "invalid" })
  })
})

describe("membership, roles and cross-organisation safety", () => {
  it("someone outside an organisation gets not_found, never forbidden", async () => {
    const w = world()
    expect(await getDashboard(w.store, { userId: "ownerB" }, "A", S)).toMatchObject({ ok: false, code: "not_found" })
    expect(await inviteMembers(w.store, { userId: "ownerB" }, "A", { emails: "x@x.com", role: "staff", specialties: ["laboratory"] }, S)).toMatchObject({ ok: false, code: "not_found" })
    expect(await removeMember(w.store, { userId: "ownerB" }, "A", "staffA")).toMatchObject({ ok: false, code: "not_found" })
    expect(await setMemberSpecialties(w.store, { userId: "ownerB" }, "A", "staffA", { allSpecialties: true })).toMatchObject({ ok: false, code: "not_found" })
    expect(await revokeInvitation(w.store, { userId: "ownerB" }, "A", "any")).toMatchObject({ ok: false, code: "not_found" })
  })
  it("an owner of one organisation cannot touch another's members even by guessing ids", async () => {
    const w = world()
    expect(await removeMember(w.store, { userId: "ownerA" }, "B", "ownerB")).toMatchObject({ ok: false, code: "not_found" })
    expect(w.members.some((m) => m.userId === "ownerB")).toBe(true)
  })
  it("privilege escalation is blocked: admins cannot remove or edit admins or the owner; staff can manage nobody", async () => {
    const w = world()
    expect(await removeMember(w.store, { userId: "adminA" }, "A", "ownerA")).toMatchObject({ ok: false, code: "forbidden" })
    expect(await setMemberSpecialties(w.store, { userId: "adminA" }, "A", "ownerA", { allSpecialties: true })).toMatchObject({ ok: false, code: "forbidden" })
    expect(await removeMember(w.store, { userId: "staffA" }, "A", "adminA")).toMatchObject({ ok: false, code: "forbidden" })
    expect(await removeMember(w.store, { userId: "adminA" }, "A", "staffA")).toMatchObject({ ok: true })
  })
  it("removing a member releases the seat", async () => {
    const w = world(3)
    await removeMember(w.store, { userId: "ownerA" }, "A", "staffA")
    const r = await inviteMembers(w.store, { userId: "ownerA" }, "A", { emails: "fresh@x.com", role: "staff", specialties: ["laboratory"] }, S)
    expect(r.ok && r.created).toHaveLength(1)
  })
  it("assigning specialties is limited to the organisation's plan", async () => {
    const w = world()
    expect(await setMemberSpecialties(w.store, { userId: "adminA" }, "A", "staffA", { specialties: ["pharmacy"] })).toMatchObject({ ok: true })
    expect(w.members.find((m) => m.userId === "staffA")).toMatchObject({ allSpecialties: false, specialties: ["pharmacy"] })
    expect(await setMemberSpecialties(w.store, { userId: "adminA" }, "A", "staffA", { specialties: ["cardiology"] })).toMatchObject({ ok: false, code: "forbidden" })
    expect(await setMemberSpecialties(w.store, { userId: "adminA" }, "A", "staffA", { specialties: ["magic"] })).toMatchObject({ ok: false })
  })
  it("staff see only themselves and can leave; the owner cannot leave", async () => {
    const w = world()
    const d = await getDashboard(w.store, { userId: "staffA" }, "A", S)
    expect(d.ok && d.members).toHaveLength(1)
    expect(await leaveOrganisation(w.store, { userId: "staffA" }, "A")).toMatchObject({ ok: true })
    expect(await leaveOrganisation(w.store, { userId: "ownerA" }, "A")).toMatchObject({ ok: false, code: "forbidden" })
  })
  it("important changes are written to the audit log", async () => {
    const w = world()
    await removeMember(w.store, { userId: "ownerA" }, "A", "staffA")
    expect(w.audits).toContain("member.removed")
  })
})

// ---------- payments ----------
const SECRET = "sk_test_secret"
const sign = (body: string) => createHmac("sha512", SECRET).update(body).digest("hex")
function paymentWorld(verified: Partial<VerifiedTransaction> = {}, fail = false) {
  const claimed = new Set<string>()
  const applied = new Map<string, ApplyResult>()
  const audits: string[] = []
  let applyCalls = 0
  const store: PaymentStore = {
    async claimEvent(k) { if (claimed.has(k)) return false; claimed.add(k); return true },
    async releaseEvent(k) { claimed.delete(k) },
    async applyPaidOrder(i) {
      applyCalls++
      if (i.reference !== "clx_1") return { ok: false, reason: "unknown_reference" }
      if (i.amountMinor !== 250_000) return { ok: false, reason: "amount_mismatch" }
      const already = applied.has(i.reference)
      const r: ApplyResult = { ok: true, already, ownerKind: "user", ownerId: "u1" }
      applied.set(i.reference, r)
      return r
    },
    async audit(e) { audits.push(e.action) },
  }
  const provider: PaymentProvider = {
    async initialize() { return { authorizationUrl: "https://x" } },
    async verify(reference) { if (fail) throw new Error("down"); return { status: "success", amountMinor: 250_000, currency: "NGN", providerId: "777", reference, ...verified } },
  }
  return { store, provider, applied, audits, calls: () => applyCalls, claimed }
}
const body = JSON.stringify({ event: "charge.success", data: { id: 777, reference: "clx_1" } })

describe("payment webhook", () => {
  it("rejects missing or wrong signatures without touching anything", async () => {
    const w = paymentWorld()
    expect((await processPaystackWebhook({ rawBody: body, signature: null, secret: SECRET, ...w })).status).toBe(401)
    expect((await processPaystackWebhook({ rawBody: body, signature: "deadbeef", secret: SECRET, ...w })).status).toBe(401)
    expect((await processPaystackWebhook({ rawBody: body, signature: sign(body), secret: "other", ...w })).status).toBe(401)
    expect(w.calls()).toBe(0)
  })
  it("a signed charge.success is verified with the provider and activates the order", async () => {
    const w = paymentWorld()
    const r = await processPaystackWebhook({ rawBody: body, signature: sign(body), secret: SECRET, ...w })
    expect(r.status).toBe(200)
    expect(w.applied.get("clx_1")).toMatchObject({ ok: true, already: false })
  })
  it("duplicate deliveries are applied once", async () => {
    const w = paymentWorld()
    for (let i = 0; i < 3; i++) await processPaystackWebhook({ rawBody: body, signature: sign(body), secret: SECRET, ...w })
    expect(w.calls()).toBe(1)
  })
  it("even if the claim were lost, applying the same order twice is a no-op (store-level idempotency)", async () => {
    const w = paymentWorld()
    await processPaystackWebhook({ rawBody: body, signature: sign(body), secret: SECRET, ...w })
    w.claimed.clear()
    await processPaystackWebhook({ rawBody: body, signature: sign(body), secret: SECRET, ...w })
    expect(w.applied.get("clx_1")).toMatchObject({ already: true })
  })
  it("grants nothing when the provider says the payment did not succeed", async () => {
    const w = paymentWorld({ status: "failed" })
    await processPaystackWebhook({ rawBody: body, signature: sign(body), secret: SECRET, ...w })
    expect(w.calls()).toBe(0)
  })
  it("an amount that does not match the stored order is refused and audited", async () => {
    const w = paymentWorld({ amountMinor: 100 })
    const r = await processPaystackWebhook({ rawBody: body, signature: sign(body), secret: SECRET, ...w })
    expect(r.status).toBe(200)
    expect(w.applied.size).toBe(0)
    expect(w.audits).toContain("payment.amount_mismatch")
  })
  it("a provider outage answers 500 and releases the claim so the retry is processed", async () => {
    const w = paymentWorld({}, true)
    const r = await processPaystackWebhook({ rawBody: body, signature: sign(body), secret: SECRET, ...w })
    expect(r.status).toBe(500)
    expect(w.claimed.size).toBe(0)
  })
  it("ignores other event types after acknowledging them", async () => {
    const w = paymentWorld()
    const other = JSON.stringify({ event: "transfer.success", data: { id: 5, reference: "r" } })
    expect((await processPaystackWebhook({ rawBody: other, signature: sign(other), secret: SECRET, ...w })).status).toBe(200)
    expect(w.calls()).toBe(0)
  })
  it("rejects malformed bodies", async () => {
    const w = paymentWorld()
    expect((await processPaystackWebhook({ rawBody: "{not json", signature: sign("{not json"), secret: SECRET, ...w })).status).toBe(400)
  })
})

describe("guest allowance (3 calculations per device)", () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }
  it("counts nothing while enforcement is off or the session state is unknown", () => {
    const s = memory()
    expect(noteGuestCalculation(s).counted).toBe(false)
    writeSessionState(s, { enforced: false, signedIn: false })
    expect(noteGuestCalculation(s).counted).toBe(false)
    expect(readGuestCount(s)).toBe(0)
  })
  it("never counts a signed-in person", () => {
    const s = memory()
    writeSessionState(s, { enforced: true, signedIn: true })
    for (let i = 0; i < 6; i++) noteGuestCalculation(s)
    expect(readGuestCount(s)).toBe(0)
  })
  it("a guest gets exactly three, then is limited", () => {
    const s = memory()
    writeSessionState(s, { enforced: true, signedIn: false })
    const a = noteGuestCalculation(s)
    expect(a).toMatchObject({ counted: true, count: 1, remaining: 2, limited: false })
    expect(noteGuestCalculation(s)).toMatchObject({ count: 2, remaining: 1, limited: false })
    expect(noteGuestCalculation(s)).toMatchObject({ count: 3, remaining: 0, limited: true })
    expect(noteGuestCalculation(s)).toMatchObject({ counted: false, count: 3, limited: true })
    expect(GUEST_CALC_LIMIT).toBe(3)
  })
  it("limited only applies to guests with enforcement on", () => {
    expect(isGuestLimited({ enforced: true, signedIn: false }, 3)).toBe(true)
    expect(isGuestLimited({ enforced: true, signedIn: false }, 2)).toBe(false)
    expect(isGuestLimited({ enforced: true, signedIn: true }, 3)).toBe(false)
    expect(isGuestLimited({ enforced: false, signedIn: false }, 3)).toBe(false)
    expect(isGuestLimited(null, 3)).toBe(false)
  })
  it("ignores a tampered or broken counter", () => {
    const s = memory()
    s.setItem("clinexia-guest-calcs", "banana")
    expect(readGuestCount(s)).toBe(0)
    s.setItem("clinexia-guest-calcs", "999")
    expect(readGuestCount(s)).toBe(3)
  })
  it("storage that throws does not break calculating", () => {
    const broken = { getItem: () => { throw new Error("denied") }, setItem: () => { throw new Error("denied") } }
    expect(noteGuestCalculation(broken as any).counted).toBe(false)
  })
})

describe("where people land after signing in", () => {
  it("keeps same-site paths and rejects anything that could leave the site or loop", () => {
    expect(safeNextPath("/calculators/renal/egfr")).toBe("/calculators/renal/egfr")
    expect(safeNextPath("/")).toBe("/")
    expect(safeNextPath("https://evil.com")).toBeNull()
    expect(safeNextPath("//evil.com")).toBeNull()
    expect(safeNextPath("/\\evil.com")).toBeNull()
    expect(safeNextPath("/login")).toBeNull()
    expect(safeNextPath("/register?x=1")).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath("")).toBeNull()
  })
})

describe("which apps may call the account APIs from outside the website", () => {
  const prod = { NODE_ENV: "production" }
  it("trusts the Android app, the mobile site and any origin you add, and nothing else", () => {
    expect(isTrustedOrigin("https://localhost", prod)).toBe(true)
    expect(isTrustedOrigin("https://clinexia-mobile.vercel.app", prod)).toBe(true)
    expect(isTrustedOrigin("https://evil.example", prod)).toBe(false)
    expect(isTrustedOrigin("https://localhost.evil.example", prod)).toBe(false)
    expect(isTrustedOrigin(null, prod)).toBe(false)
    expect(isTrustedOrigin("https://app.partner.com", { ...prod, MOBILE_ALLOWED_ORIGINS: "https://app.partner.com/, https://x.y" })).toBe(true)
  })
  it("allows local development origins only outside production", () => {
    expect(isTrustedOrigin("http://localhost:3001", { NODE_ENV: "development" })).toBe(true)
    expect(isTrustedOrigin("http://10.0.2.2:3000", { NODE_ENV: "development" })).toBe(true)
    expect(isTrustedOrigin("http://localhost:3001", prod)).toBe(false)
  })
  it("answers with exact-origin headers, never a wildcard and never credentials", () => {
    const h = corsHeadersFor("https://localhost", prod)!
    expect(h["Access-Control-Allow-Origin"]).toBe("https://localhost")
    expect(h["Access-Control-Allow-Headers"]).toContain("Authorization")
    expect("Access-Control-Allow-Credentials" in h).toBe(false)
    expect(corsHeadersFor("https://evil.example", prod)).toBeNull()
  })
  it("covers the account, billing, campaign and feedback APIs but not admin or the payment webhook", () => {
    expect(corsPath("/api/account/login")).toBe(true)
    expect(corsPath("/api/billing/checkout")).toBe(true)
    expect(corsPath("/api/campaigns/active")).toBe(true)
    expect(corsPath("/api/feedback/config")).toBe(true)
    expect(corsPath("/api/analytics/presence")).toBe(true)
    expect(corsPath("/api/push/register")).toBe(true)
    expect(corsPath("/api/admin/push")).toBe(false)
    expect(corsPath("/api/admin/accounts")).toBe(false)
    expect(corsPath("/api/billing/webhook")).toBe(false)
    expect(corsPath("/account")).toBe(false)
  })
})

describe("linking devices to accounts (admin sees the real name and the whole history)", () => {
  it("shows the name typed at registration, otherwise the start of the email", () => {
    expect(accountNameFor("  Ada   Okafor ", "ada@x.com")).toBe("Ada Okafor")
    expect(accountNameFor("", "ada.okafor@x.com")).toBe("ada.okafor")
    expect(accountNameFor(null, "@x.com")).toBe("User")
    expect(accountNameFor("n".repeat(200), "a@x.com").length).toBe(80)
  })
  it("only accepts a real device id (a UUID), never anything that could be a query", () => {
    expect(isDeviceId("3f2b8c1e-5a6d-4e7f-9a10-b2c3d4e5f607")).toBe(true)
    expect(isDeviceId("3F2B8C1E-5A6D-4E7F-9A10-B2C3D4E5F607")).toBe(true)
    expect(isDeviceId("abc")).toBe(false)
    expect(isDeviceId('x" or 1=1')).toBe(false)
    expect(isDeviceId(undefined)).toBe(false)
  })
  const ev = (id: string, name: string, at: string) => ({ calculator_id: id, calculator_name: name, category: "renal", occurred_at: at })
  it("summarises the history: totals, most used, and the time span", () => {
    const events = [ev("egfr", "eGFR", "2026-10-03T10:00:00Z"), ev("egfr", "eGFR", "2026-10-02T10:00:00Z"), ev("bmi", "BMI", "2026-10-01T10:00:00Z")]
    const s = summariseHistory(events)
    expect(s.total).toBe(3)
    expect(s.top[0]).toEqual({ name: "eGFR", count: 2 })
    expect(s.firstAt).toBe("2026-10-01T10:00:00Z")
    expect(s.lastAt).toBe("2026-10-03T10:00:00Z")
    expect(s.capped).toBe(false)
  })
  it("handles an empty history and tells when the list was cut off", () => {
    expect(summariseHistory([])).toMatchObject({ total: 0, top: [], firstAt: null, lastAt: null })
    expect(summariseHistory(Array.from({ length: 5 }, () => ev("a", "A", "2026-10-01T00:00:00Z")), 5).capped).toBe(true)
  })
})

describe("telling the admin exactly what is missing in production", () => {
  it("names the SQL file for a missing table, column or function", () => {
    expect(missingSqlHint("Could not find the table 'public.app_campaigns' in the schema cache (PGRST205)")).toContain("supabase/campaigns.sql")
    expect(missingSqlHint("column billing_profiles.source does not exist")).toContain("supabase/billing-admin.sql")
    expect(missingSqlHint("relation billing_device_links does not exist")).toContain("supabase/billing-link.sql")
    expect(missingSqlHint("Could not find the table 'public.push_devices'")).toContain("supabase/push.sql")
    expect(missingSqlHint("relation billing_organisations does not exist")).toContain("supabase/billing.sql")
  })
  it("says nothing about errors that are not missing pieces", () => {
    expect(missingSqlHint("Supabase select failed (401): invalid key")).toBeNull()
    expect(missingSqlHint("network down")).toBeNull()
  })
  it("still points at the missing sign-in key before anything else", () => {
    expect(explainSetupError("SUPABASE_ANON_KEY is required")).toContain("SUPABASE_ANON_KEY")
  })
  it("summarises a check: required failures, optional gaps and which SQL files to run", () => {
    const s = summariseChecks([
      { group: "g", label: "a", ok: true, optional: false },
      { group: "g", label: "b", ok: false, optional: false, fix: "supabase/campaigns.sql" },
      { group: "g", label: "c", ok: false, optional: false, fix: "supabase/campaigns.sql" },
      { group: "g", label: "d", ok: false, optional: true, fix: "Add PAYSTACK_SECRET_KEY" },
      { group: "g", label: "e", ok: false, optional: false, fix: "Add SUPABASE_ANON_KEY" },
    ])
    expect(s).toMatchObject({ failed: 3, optionalMissing: 1, ready: false })
    expect(s.files).toEqual(["supabase/campaigns.sql"])
    expect(summariseChecks([{ group: "g", label: "a", ok: true, optional: false }]).ready).toBe(true)
  })
})
