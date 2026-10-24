import { afterEach, describe, expect, it, vi } from "vitest"
import { setUserMetadata } from "./admin-users"
import { avatarFromMetadata, avatarPublicUrl, decodeAvatar, MAX_AVATAR_BYTES } from "./avatar"
import { changePassword } from "./session"
import { validateProfileUpdate } from "./validation"

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const env = () => { vi.stubEnv("SUPABASE_URL", "https://x.supabase.co"); vi.stubEnv("SUPABASE_ANON_KEY", "anon"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service") }
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
const jpeg = (n: number) => { const b = Buffer.alloc(n, 7); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; return b }

describe("which photo is shown", () => {
  it("an uploaded photo beats a Google one; Google's avatar_url or picture is next; otherwise none", () => {
    expect(avatarFromMetadata({ clinexia_avatar: "https://s/up.jpg", avatar_url: "https://g/a.jpg" })).toEqual({ url: "https://s/up.jpg", source: "upload" })
    expect(avatarFromMetadata({ avatar_url: "https://g/a.jpg", picture: "https://g/p.jpg" })).toEqual({ url: "https://g/a.jpg", source: "google" })
    expect(avatarFromMetadata({ picture: "https://g/p.jpg" })).toEqual({ url: "https://g/p.jpg", source: "google" })
    expect(avatarFromMetadata({})).toBeNull()
    expect(avatarFromMetadata(null)).toBeNull()
  })
  it("never shows anything that is not a plain https address", () => {
    expect(avatarFromMetadata({ clinexia_avatar: "javascript:alert(1)", avatar_url: "http://insecure/a.jpg", picture: "https://ok/p.jpg\" onerror=\"x" })).toBeNull()
  })
  it("builds the public address of a stored photo", () => {
    expect(avatarPublicUrl("https://x.supabase.co/", "u1", 5)).toBe("https://x.supabase.co/storage/v1/object/public/avatars/u1.jpg?v=5")
  })
})

describe("uploaded photo checks", () => {
  it("accepts a real JPEG up to 2 MB, with or without the data: prefix", () => {
    expect(decodeAvatar(jpeg(5000).toString("base64")).ok).toBe(true)
    expect(decodeAvatar(`data:image/jpeg;base64,${jpeg(5000).toString("base64")}`).ok).toBe(true)
    expect(decodeAvatar(jpeg(MAX_AVATAR_BYTES).toString("base64")).ok).toBe(true)
  })
  it("refuses over 2 MB, non-JPEG bytes, bad text and nothing", () => {
    expect(decodeAvatar(jpeg(MAX_AVATAR_BYTES + 1).toString("base64"))).toMatchObject({ ok: false, error: "The photo must be 2 MB or smaller." })
    expect(decodeAvatar(Buffer.alloc(3000, 1).toString("base64")).ok).toBe(false)
    expect(decodeAvatar(Buffer.from("<svg onload=alert(1)>".repeat(30)).toString("base64")).ok).toBe(false)
    expect(decodeAvatar("not base64 !!").ok).toBe(false)
    expect(decodeAvatar("").ok).toBe(false)
    expect(decodeAvatar(undefined).ok).toBe(false)
  })
})

describe("editing details", () => {
  it("an individual keeps name, background and a matching role", () => {
    expect(validateProfileUpdate({ fullName: " Ada Obi ", background: "medical", role: "pharmacy" }, "individual")).toMatchObject({ ok: true, value: { fullName: "Ada Obi", background: "medical", role: "pharmacy" } })
    expect(validateProfileUpdate({ fullName: "A", background: "medical", role: "x" }, "individual")).toMatchObject({ ok: false })
    expect(validateProfileUpdate({ fullName: "Ada Obi", background: "medical", role: "not-a-role" }, "individual")).toMatchObject({ ok: false })
    expect(validateProfileUpdate({ fullName: "Ada Obi" }, "individual")).toMatchObject({ ok: false })
  })
  it("an organisation administrator only has a name", () => {
    expect(validateProfileUpdate({ fullName: "Ada Obi" }, "enterprise")).toEqual({ ok: true, value: { fullName: "Ada Obi" } })
  })
})

describe("password change", () => {
  it("checks the current password, sets the new one, then ends every session", async () => {
    env()
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string, init: any) => {
      calls.push(`${init.method} ${url.replace("https://x.supabase.co/auth/v1/", "")}`)
      return url.includes("grant_type=password") ? res(200, { access_token: "tok", refresh_token: "r" }) : res(200, {})
    })
    expect(await changePassword("a@b.com", "old-password-1", "new-password-2")).toEqual({ ok: true })
    expect(calls).toEqual(["POST token?grant_type=password", "PUT user", "POST logout?scope=global"])
  })
  it("a wrong current password changes nothing", async () => {
    env()
    const calls: string[] = []
    vi.stubGlobal("fetch", async (_u: string, init: any) => { calls.push(init.method); return res(400, { error_code: "invalid_credentials" }) })
    expect(await changePassword("a@b.com", "wrong", "new-password-2")).toEqual({ ok: false, reason: "wrong" })
    expect(calls).toEqual(["POST"])
  })
  it("reports same and weak passwords", async () => {
    env()
    const mk = (code: string) => async (url: string) => (url.includes("grant_type=password") ? res(200, { access_token: "tok" }) : url.endsWith("/user") ? res(422, { error_code: code }) : res(200, {}))
    vi.stubGlobal("fetch", mk("same_password")); expect(await changePassword("a@b.com", "x", "y")).toEqual({ ok: false, reason: "same" })
    vi.stubGlobal("fetch", mk("weak_password")); expect(await changePassword("a@b.com", "x", "y")).toEqual({ ok: false, reason: "weak" })
  })
})

describe("saving profile fields at Supabase", () => {
  it("keeps the other fields, sets one, removes one", async () => {
    env()
    const sent: any[] = []
    vi.stubGlobal("fetch", async (_u: string, init: any) => {
      if (init.method === "PUT") { sent.push(JSON.parse(init.body)); return res(200, {}) }
      return res(200, { user_metadata: { full_name: "Ada", clinexia_avatar: "https://old", avatar_url: "https://g/a.jpg" } })
    })
    await setUserMetadata("11111111-1111-4111-8111-111111111111", { full_name: "Ada Obi", clinexia_avatar: null })
    expect(sent[0]).toEqual({ user_metadata: { full_name: "Ada Obi", avatar_url: "https://g/a.jpg" } })
  })
})
