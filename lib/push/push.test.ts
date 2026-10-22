import { createVerify, generateKeyPairSync } from "node:crypto"
import { describe, expect, it } from "vitest"
import { buildJwt, buildMessage, parseServiceAccount, sendOne, sendToDevices, type ServiceAccount } from "./fcm"
import { validatePush, validPushToken } from "./validate"
import { markSeen, parseSeen, unseen } from "./inbox"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } })
const sa: ServiceAccount = { client_email: "svc@proj.iam.gserviceaccount.com", private_key: privateKey, project_id: "proj" }
const TOKEN = "d".repeat(40)

describe("notification settings", () => {
  it("needs a title and a message, and limits their length", () => {
    expect(validatePush({ title: "", body: "x", audience: "everyone" }).ok).toBe(false)
    expect(validatePush({ title: "x", body: " ", audience: "everyone" }).ok).toBe(false)
    const r = validatePush({ title: "a".repeat(200), body: "b".repeat(900), audience: "everyone" })
    expect(r.ok && r.value.title.length).toBe(65)
    expect(r.ok && r.value.body.length).toBe(240)
  })
  it("accepts in-app and https links only", () => {
    expect(validatePush({ title: "t", body: "b", url: "/account", audience: "everyone" }).ok).toBe(true)
    expect(validatePush({ title: "t", body: "b", url: "https://x.com/a", audience: "guests" }).ok).toBe(true)
    expect(validatePush({ title: "t", body: "b", url: "javascript:alert(1)", audience: "everyone" }).ok).toBe(false)
    expect(validatePush({ title: "t", body: "b", url: "//evil.com", audience: "everyone" }).ok).toBe(false)
  })
  it("needs a known audience", () => {
    expect(validatePush({ title: "t", body: "b", audience: "everybody" }).ok).toBe(false)
    expect(validatePush({ title: "t", body: "b", audience: "signed_in" }).ok).toBe(true)
  })
  it("only accepts sensible device tokens", () => {
    expect(validPushToken(TOKEN)).toBe(true)
    expect(validPushToken("short")).toBe(false)
    expect(validPushToken(`${TOKEN} OR 1=1`)).toBe(false)
    expect(validPushToken(undefined)).toBe(false)
  })
})

describe("signing in to Google for notifications", () => {
  it("builds a correctly signed token", () => {
    const jwt = buildJwt(sa, 1_700_000_000)
    const [h, c, s] = jwt.split(".")
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" })
    const claims = JSON.parse(Buffer.from(c, "base64url").toString())
    expect(claims).toMatchObject({ iss: sa.client_email, iat: 1_700_000_000, exp: 1_700_003_600, aud: "https://oauth2.googleapis.com/token" })
    expect(claims.scope).toContain("firebase.messaging")
    expect(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true)
  })
  it("reads the key file as JSON or base64, and rejects anything else", () => {
    const json = JSON.stringify({ client_email: sa.client_email, private_key: privateKey, project_id: "proj" })
    expect(parseServiceAccount(json)?.project_id).toBe("proj")
    expect(parseServiceAccount(Buffer.from(json).toString("base64"))?.client_email).toBe(sa.client_email)
    expect(parseServiceAccount("junk")).toBeNull()
    expect(parseServiceAccount(undefined)).toBeNull()
    expect(parseServiceAccount('{"client_email":"x"}')).toBeNull()
  })
})

describe("sending", () => {
  it("builds the message with the link as data", () => {
    expect(buildMessage(TOKEN, { title: "Hi", body: "There", url: "/account" })).toEqual({ message: { token: TOKEN, notification: { title: "Hi", body: "There" }, data: { url: "/account" }, android: { priority: "HIGH" } } })
    expect(buildMessage(TOKEN, { title: "Hi", body: "There" }).message.data).toEqual({})
  })
  const fakeFetch = (handler: (token: string) => { status: number; text?: string }) => (async (_url: string, init: any) => {
    const r = handler(JSON.parse(init.body).message?.token)
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.text ?? "", json: async () => ({ access_token: "tok", expires_in: 3600 }) }
  }) as any
  it("tells a delivered notification from a dead device from a temporary failure", async () => {
    expect(await sendOne(sa, "t", TOKEN, { title: "a", body: "b" }, fakeFetch(() => ({ status: 200 })))).toBe("sent")
    expect(await sendOne(sa, "t", TOKEN, { title: "a", body: "b" }, fakeFetch(() => ({ status: 404, text: "UNREGISTERED" })))).toBe("unregistered")
    expect(await sendOne(sa, "t", TOKEN, { title: "a", body: "b" }, fakeFetch(() => ({ status: 503 })))).toBe("failed")
    expect(await sendOne(sa, "t", TOKEN, { title: "a", body: "b" }, (async () => { throw new Error("offline") }) as any)).toBe("failed")
  })
  it("counts sent, failed and removed across many phones", async () => {
    const tokens = Array.from({ length: 25 }, (_, i) => `${"t".repeat(30)}${i}`)
    const fetchImpl = fakeFetch((t) => (t.endsWith("3") ? { status: 404, text: "UNREGISTERED" } : t.endsWith("7") ? { status: 500 } : { status: 200 }))
    const r = await sendToDevices(sa, tokens, { title: "a", body: "b" }, (async (url: string, init: any) => (String(url).includes("oauth2") ? { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) } : fetchImpl(url, init))) as any)
    expect(r.sent + r.failed + r.unregistered.length).toBe(25)
    expect(r.unregistered.length).toBe(3)
    expect(r.failed).toBe(2) // tokens ending in 7: 7 and 17
    expect(r.sent).toBe(20)
  })
})

describe("notifications that last until the person closes them", () => {
  it("carries the message id so the app knows what it already showed", () => {
    expect(buildMessage(TOKEN, { title: "a", body: "b", url: "/x", id: "m1" }).message.data).toEqual({ url: "/x", id: "m1" })
    expect(buildMessage(TOKEN, { title: "a", body: "b", id: "m1" }).message.data).toEqual({ id: "m1" })
  })
  const msg = (id: string, at: string) => ({ id, title: id, body: "", url: "", createdAt: at })
  const NOW = Date.parse("2026-11-10T12:00:00Z")
  it("shows each notification until it is closed, oldest first, and never twice", () => {
    const list = [msg("b", "2026-11-09T10:00:00Z"), msg("a", "2026-11-08T10:00:00Z")]
    expect(unseen(list, [], NOW).map((m) => m.id)).toEqual(["a", "b"])
    expect(unseen(list, markSeen([], "a"), NOW).map((m) => m.id)).toEqual(["b"])
    expect(unseen(list, ["a", "b"], NOW)).toEqual([])
  })
  it("drops notifications older than a week", () => {
    expect(unseen([msg("old", "2026-10-01T00:00:00Z")], [], NOW)).toEqual([])
  })
  it("keeps a bounded, safe list of what was seen", () => {
    expect(parseSeen("junk")).toEqual([])
    expect(parseSeen('[1,"a"]')).toEqual(["a"])
    let seen: string[] = []
    for (let i = 0; i < 80; i++) seen = markSeen(seen, `m${i}`)
    expect(seen.length).toBe(50)
    expect(markSeen(["a"], "a")).toEqual(["a"])
  })
})
