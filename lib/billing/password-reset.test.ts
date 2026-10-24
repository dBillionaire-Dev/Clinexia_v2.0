import { afterEach, describe, expect, it, vi } from "vitest"
import { generateRecoveryToken } from "./admin-users"
import { composePasswordChangedEmail, composePasswordResetEmail } from "./emails"
import { createResetLink, requestPasswordReset, sendPasswordChangedNotice, validNewPassword, validResetToken, type ResetDeps } from "./password-reset"
import { completePasswordReset } from "./session"

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const env = () => { vi.stubEnv("SUPABASE_URL", "https://x.supabase.co"); vi.stubEnv("SUPABASE_ANON_KEY", "anon"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service") }
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("input checks", () => {
  it("token and password shapes", () => {
    expect([validResetToken("a".repeat(56)), validResetToken("short"), validResetToken("a b".repeat(10)), validResetToken(5)]).toEqual([true, false, false, false])
    expect([validNewPassword("1234567890"), validNewPassword("123456789"), validNewPassword("x".repeat(129)), validNewPassword(null)]).toEqual([true, false, false, false])
  })
})

describe("reset emails", () => {
  it("the reset email carries the link and says to ignore it if unrequested", () => {
    const e = composePasswordResetEmail({ name: "Ada", link: "https://x.test/account/reset?token=abc" })
    expect(e.subject).toBe("Reset your Clinexia password")
    expect(e.text).toContain("https://x.test/account/reset?token=abc")
    expect(e.text).toContain("If you did not ask for this")
    expect(e.html).toContain("Choose a new password")
  })
  it("the changed notice points to sign-in", () => {
    expect(composePasswordChangedEmail({ name: "", url: "https://x.test/login" }).text).toContain("https://x.test/login")
  })
})

describe("requesting a reset", () => {
  const deps = (over: Partial<ResetDeps> = {}) => {
    const send = vi.fn(async () => "sent" as const)
    return { send, d: { generate: async () => ({ userId: "u1", tokenHash: "T".repeat(56) }), isSuspended: async () => false, nameOf: async () => "Ada", send, ...over } as ResetDeps }
  }
  it("sends the link for an existing account", async () => {
    const { d, send } = deps()
    expect(await requestPasswordReset("a@b.com", "https://x.test", d)).toBe("sent")
    expect(send).toHaveBeenCalledTimes(1)
    const m = (send.mock.calls[0] as any)[0]
    expect(m.to).toBe("a@b.com")
    expect(m.text).toContain(`https://x.test/account/reset?token=${"T".repeat(56)}`)
  })
  it("says exactly why nothing was sent, and never throws", async () => {
    const a = deps({ generate: async () => null }); expect(await requestPasswordReset("a@b.com", "https://x.test", a.d)).toBe("no_account"); expect(a.send).not.toHaveBeenCalled()
    const b = deps({ isSuspended: async () => true }); expect(await requestPasswordReset("a@b.com", "https://x.test", b.d)).toBe("suspended"); expect(b.send).not.toHaveBeenCalled()
    const c = deps({ generate: async () => { throw new Error("down") } }); expect(await requestPasswordReset("a@b.com", "https://x.test", c.d)).toBe("email_failed")
    const f = deps({ send: vi.fn(async () => "failed" as const) as any }); expect(await requestPasswordReset("a@b.com", "https://x.test", f.d)).toBe("email_failed")
  })
  it("an administrator can reset a suspended account, and can get the link to hand over", async () => {
    const s = deps({ isSuspended: async () => true })
    expect(await requestPasswordReset("a@b.com", "https://x.test", s.d, { adminAction: true })).toBe("sent")
    expect(await createResetLink("a@b.com", "https://x.test", { generate: async () => ({ userId: "u", tokenHash: "T".repeat(56) }) })).toBe(`https://x.test/account/reset?token=${"T".repeat(56)}`)
    expect(await createResetLink("none@b.com", "https://x.test", { generate: async () => null })).toBeNull()
  })
  it("the changed notice is best effort", async () => {
    const send = vi.fn(async () => { throw new Error("x") })
    await expect(sendPasswordChangedNotice("a@b.com", "https://x.test", { send } as any)).resolves.toBeUndefined()
    const none = vi.fn()
    await sendPasswordChangedNotice("", "https://x.test", { send: none } as any)
    expect(none).not.toHaveBeenCalled()
  })
})

describe("talking to Supabase", () => {
  it("makes a token without sending Supabase's own email", async () => {
    env()
    const f = vi.fn(async () => res(200, { id: "u1", hashed_token: "H".repeat(56), action_link: "https://x" }))
    vi.stubGlobal("fetch", f)
    expect(await generateRecoveryToken("a@b.com")).toEqual({ userId: "u1", tokenHash: "H".repeat(56) })
    const [url, init] = f.mock.calls[0] as any
    expect(url).toBe("https://x.supabase.co/auth/v1/admin/generate_link")
    expect(JSON.parse(init.body)).toEqual({ type: "recovery", email: "a@b.com" })
    vi.stubGlobal("fetch", async () => res(404, { error_code: "user_not_found" }))
    expect(await generateRecoveryToken("nobody@b.com")).toBeNull()
  })
  it("finishes a reset: verify, set the password, sign out everywhere", async () => {
    env()
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string, init: any) => {
      calls.push(`${init.method} ${url.replace("https://x.supabase.co/auth/v1/", "")}`)
      if (url.endsWith("/verify")) return res(200, { access_token: "tok", user: { email: "a@b.com" } })
      return res(200, {})
    })
    expect(await completePasswordReset("T".repeat(56), "a-long-new-password")).toEqual({ ok: true, email: "a@b.com" })
    expect(calls).toEqual(["POST verify", "PUT user", "POST logout?scope=global"])
  })
  it("an expired or used token is 'invalid' and the password is never set", async () => {
    env()
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string, init: any) => { calls.push(init.method); return res(403, { error_code: "otp_expired" }) })
    expect(await completePasswordReset("T".repeat(56), "a-long-new-password")).toEqual({ ok: false, reason: "invalid" })
    expect(calls).toEqual(["POST"])
  })
  it("same-as-old and weak passwords are reported distinctly", async () => {
    env()
    const mk = (code: string) => async (url: string) => (url.endsWith("/verify") ? res(200, { access_token: "tok", user: { email: "a@b.com" } }) : url.endsWith("/user") ? res(422, { error_code: code }) : res(200, {}))
    vi.stubGlobal("fetch", mk("same_password")); expect(await completePasswordReset("T".repeat(56), "x".repeat(12))).toEqual({ ok: false, reason: "same" })
    vi.stubGlobal("fetch", mk("weak_password")); expect(await completePasswordReset("T".repeat(56), "x".repeat(12))).toEqual({ ok: false, reason: "weak" })
  })
})
