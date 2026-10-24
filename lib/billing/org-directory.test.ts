import { describe, expect, it, vi } from "vitest"
import type { MemberRecord, OrgRecord, OrgStore } from "./org-actions"
import { addPeople, authoriseMemberPasswordReset, cleanGroupName, createGroup, deleteGroup, parsePeopleCsv, setMemberDisabled, setMemberGroup, MAX_GROUPS, type AccountService, type DirectoryStore, type GroupRecord } from "./org-directory"

const NOW = Date.parse("2026-11-01T00:00:00Z")
const settings = { graceDays: 7, invitationTtlHours: 72, now: NOW }
const member = (userId: string, role: MemberRecord["role"], extra: Partial<MemberRecord> = {}): MemberRecord => ({ userId, email: `${userId}@x.com`, fullName: userId, role, allSpecialties: true, specialties: [], joinedAt: "2026-01-01", ...extra })
const org = (over: Partial<OrgRecord> = {}): OrgRecord => ({ id: "o1", name: "City Lab", orgType: "laboratory", seats: 5, suspended: false, managedStatus: "none", plan: { plan: "all_access", specialties: [], seats: 5, status: "active", currentPeriodEnd: new Date(NOW + 20 * 86_400_000).toISOString(), cancelAtPeriodEnd: false } as any, ...over })

function stores(members: MemberRecord[], o: OrgRecord = org(), free = 10) {
  const audits: string[] = []
  const orgStore = { getOrg: async () => o, getMember: async (_: string, id: string) => members.find((m) => m.userId === id) ?? null, audit: async (e: any) => { audits.push(e.action) } } as unknown as OrgStore
  let groups: GroupRecord[] = []
  let seats = free
  const provisioned: string[] = []
  const dir: DirectoryStore = {
    listGroups: async () => groups,
    createGroup: async (_, name) => (groups.some((g) => g.name.toLowerCase() === name.toLowerCase()) ? { ok: false, reason: "duplicate" } : (groups = [...groups, { id: `g${groups.length + 1}`, name, members: 0 }], { ok: true, id: `g${groups.length}` })),
    renameGroup: async () => "ok",
    deleteGroup: async (_, id) => { const had = groups.some((g) => g.id === id); groups = groups.filter((g) => g.id !== id); return had },
    setMemberGroup: vi.fn(async () => true),
    setMemberDisabled: vi.fn(async () => true),
    provisionMember: async (i) => (seats <= 0 ? { ok: false, reason: "no_capacity" } : (seats--, provisioned.push(i.userId), { ok: true })),
  }
  const removed: string[] = []
  let n = 0
  const existing = new Set<string>(["taken@x.com"])
  const accounts: AccountService = {
    create: async (email) => (existing.has(email) ? { ok: false, reason: "exists" } : (existing.add(email), { ok: true, userId: `new${++n}` })),
    remove: async (id) => { removed.push(id) },
  }
  return { orgStore, dir, accounts, audits, provisioned, removed }
}

describe("groups", () => {
  it("only owners and admins manage groups; staff and strangers cannot", async () => {
    const s = stores([member("own", "owner"), member("adm", "admin"), member("stf", "staff")])
    expect((await createGroup(s.orgStore, s.dir, { userId: "own" }, "o1", "Lab")).ok).toBe(true)
    expect((await createGroup(s.orgStore, s.dir, { userId: "adm" }, "o1", "Ward")).ok).toBe(true)
    expect(await createGroup(s.orgStore, s.dir, { userId: "stf" }, "o1", "X")).toMatchObject({ ok: false, code: "forbidden" })
    expect(await createGroup(s.orgStore, s.dir, { userId: "nobody" }, "o1", "X")).toMatchObject({ ok: false, code: "not_found" })
  })
  it("names are cleaned, unique, and limited in number", async () => {
    expect(cleanGroupName("  Lab   One ")).toBe("Lab One")
    expect(cleanGroupName("")).toBeNull()
    expect(cleanGroupName("x".repeat(61))).toBeNull()
    const s = stores([member("own", "owner")])
    await createGroup(s.orgStore, s.dir, { userId: "own" }, "o1", "Lab")
    expect(await createGroup(s.orgStore, s.dir, { userId: "own" }, "o1", "lab")).toMatchObject({ ok: false, code: "conflict" })
    const many = stores([member("own", "owner")])
    for (let i = 0; i < MAX_GROUPS; i++) await createGroup(many.orgStore, many.dir, { userId: "own" }, "o1", `G${i}`)
    expect(await createGroup(many.orgStore, many.dir, { userId: "own" }, "o1", "One more")).toMatchObject({ ok: false, code: "conflict" })
  })
  it("deleting a group needs the right to manage; a missing group is not found", async () => {
    const s = stores([member("own", "owner"), member("stf", "staff")])
    expect(await deleteGroup(s.orgStore, s.dir, { userId: "stf" }, "o1", "g1")).toMatchObject({ ok: false, code: "forbidden" })
    expect(await deleteGroup(s.orgStore, s.dir, { userId: "own" }, "o1", "g1")).toMatchObject({ ok: false, code: "not_found" })
  })
})

describe("members: group, disable, password", () => {
  const all = [member("own", "owner"), member("adm", "admin"), member("adm2", "admin"), member("stf", "staff", { managed: true }), member("self", "staff")]
  it("admins manage staff only; the owner manages admins and staff; nobody manages the owner", async () => {
    const s = stores(all)
    expect((await setMemberDisabled(s.orgStore, s.dir, { userId: "adm" }, "o1", "stf", true)).ok).toBe(true)
    expect(await setMemberDisabled(s.orgStore, s.dir, { userId: "adm" }, "o1", "adm2", true)).toMatchObject({ ok: false, code: "forbidden" })
    expect((await setMemberDisabled(s.orgStore, s.dir, { userId: "own" }, "o1", "adm", true)).ok).toBe(true)
    expect(await setMemberDisabled(s.orgStore, s.dir, { userId: "adm" }, "o1", "own", true)).toMatchObject({ ok: false, code: "forbidden" })
    expect(await setMemberDisabled(s.orgStore, s.dir, { userId: "own" }, "o1", "own", true)).toMatchObject({ ok: false, code: "forbidden" })
  })
  it("a disabled member can no longer manage anything", async () => {
    const s = stores([member("own", "owner"), member("adm", "admin", { disabled: true }), member("stf", "staff")])
    expect(await setMemberDisabled(s.orgStore, s.dir, { userId: "adm" }, "o1", "stf", true)).toMatchObject({ ok: false, code: "not_found" })
  })
  it("a group must exist to be assigned", async () => {
    const s = stores(all)
    await createGroup(s.orgStore, s.dir, { userId: "own" }, "o1", "Lab")
    expect((await setMemberGroup(s.orgStore, s.dir, { userId: "own" }, "o1", "stf", "g1")).ok).toBe(true)
    expect(await setMemberGroup(s.orgStore, s.dir, { userId: "own" }, "o1", "stf", "zzz")).toMatchObject({ ok: false, code: "not_found" })
    expect((await setMemberGroup(s.orgStore, s.dir, { userId: "own" }, "o1", "stf", null)).ok).toBe(true)
  })
  it("the organisation resets passwords only for accounts it created", async () => {
    const s = stores(all)
    expect(await authoriseMemberPasswordReset(s.orgStore, { userId: "own" }, "o1", "stf")).toEqual({ ok: true, email: "stf@x.com" })
    expect(await authoriseMemberPasswordReset(s.orgStore, { userId: "own" }, "o1", "self")).toMatchObject({ ok: false, code: "forbidden" })
    expect(await authoriseMemberPasswordReset(s.orgStore, { userId: "adm" }, "o1", "adm2")).toMatchObject({ ok: false, code: "forbidden" })
  })
})

describe("adding people", () => {
  const rows = [{ name: "Ada Obi", email: "ADA@x.com" }, { name: "Bayo K", email: "bayo@x.com", group: "Laboratory" }]
  it("creates accounts, makes new groups from names, and reports each person", async () => {
    const s = stores([member("own", "owner")])
    const r = await addPeople(s.orgStore, s.dir, s.accounts, { userId: "own" }, "o1", { rows }, settings)
    expect(r).toMatchObject({ ok: true })
    if (!r.ok) return
    expect(r.results.map((x) => x.status)).toEqual(["created", "created"])
    expect(r.created.map((c) => c.email)).toEqual(["ada@x.com", "bayo@x.com"])
    expect((await s.dir.listGroups("o1")).map((g) => g.name)).toEqual(["Laboratory"])
  })
  it("an existing Clinexia account is never pulled in: it must be invited", async () => {
    const s = stores([member("own", "owner")])
    const r = await addPeople(s.orgStore, s.dir, s.accounts, { userId: "own" }, "o1", { rows: [{ name: "Taken Person", email: "taken@x.com" }] }, settings)
    expect(r.ok && r.results[0].status).toBe("has_account")
    expect(s.provisioned).toEqual([])
  })
  it("with no free seat the account is removed again and nothing is left behind", async () => {
    const s = stores([member("own", "owner")], org(), 1)
    const r = await addPeople(s.orgStore, s.dir, s.accounts, { userId: "own" }, "o1", { rows }, settings)
    expect(r.ok && r.results.map((x) => x.status)).toEqual(["created", "no_capacity"])
    expect(s.removed).toEqual(["new2"])
  })
  it("bad rows, repeated emails and roles above the actor are refused, others still go through", async () => {
    const s = stores([member("adm", "admin")])
    const r = await addPeople(s.orgStore, s.dir, s.accounts, { userId: "adm" }, "o1", { rows: [{ name: "A", email: "bad" }, { name: "Cee Dee", email: "c@x.com", role: "admin" }, { name: "Eve Fay", email: "e@x.com" }, { name: "Eve Fay", email: "E@x.com" }] }, settings)
    expect(r.ok && r.results.map((x) => x.status)).toEqual(["invalid", "invalid", "created", "duplicate"])
  })
  it("needs permission, an active plan, and at most 50 rows", async () => {
    const staff = stores([member("stf", "staff")])
    expect(await addPeople(staff.orgStore, staff.dir, staff.accounts, { userId: "stf" }, "o1", { rows }, settings)).toMatchObject({ ok: false, code: "forbidden" })
    const expired = stores([member("own", "owner")], org({ plan: null }))
    expect(await addPeople(expired.orgStore, expired.dir, expired.accounts, { userId: "own" }, "o1", { rows }, settings)).toMatchObject({ ok: false, code: "subscription_inactive" })
    const s = stores([member("own", "owner")])
    const big = Array.from({ length: 51 }, (_, i) => ({ name: `Person ${i}`, email: `p${i}@x.com` }))
    expect(await addPeople(s.orgStore, s.dir, s.accounts, { userId: "own" }, "o1", { rows: big }, settings)).toMatchObject({ ok: false, code: "invalid" })
  })
})

describe("spreadsheet text", () => {
  it("reads headers in any order, quotes, and different separators", () => {
    expect(parsePeopleCsv('Email;Name;Group\nada@x.com;"Obi, Ada";Lab\n').rows).toEqual([{ name: "Obi, Ada", email: "ada@x.com", group: "Lab" }])
    expect(parsePeopleCsv("name,email,role\r\nAda,a@x.com,admin\r\n").rows).toEqual([{ name: "Ada", email: "a@x.com", role: "admin" }])
  })
  it("explains what is wrong", () => {
    expect(parsePeopleCsv("name,email").error).toMatch(/at least one person/)
    expect(parsePeopleCsv("a,b\n1,2").error).toMatch(/columns name and email/)
  })
})
