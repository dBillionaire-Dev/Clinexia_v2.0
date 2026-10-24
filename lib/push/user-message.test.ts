import { describe, expect, it } from "vitest"
import { composeAdminMessageEmail } from "../billing/emails"
import { validateUserMessage } from "./validate"

describe("private admin message", () => {
  it("needs a title and a message", () => {
    expect(validateUserMessage({ title: "", body: "x" })).toMatchObject({ ok: false })
    expect(validateUserMessage({ title: "x", body: "  " })).toMatchObject({ ok: false })
    expect(validateUserMessage(null)).toMatchObject({ ok: false })
  })
  it("keeps paragraphs and line breaks, strips control characters, and limits length", () => {
    const r = validateUserMessage({ title: "Hello\u0000there", body: "Line one\r\nLine two\n\n\n\nNew paragraph\u0007" })
    expect(r).toEqual({ ok: true, value: { title: "Hello there", body: "Line one\nLine two\n\nNew paragraph" } })
    const long = validateUserMessage({ title: "t".repeat(200), body: "b".repeat(900) })
    expect(long.ok && long.value.title.length).toBe(65)
    expect(long.ok && long.value.body.length).toBe(500)
  })
  it("the email carries the text, escapes markup and keeps paragraphs", () => {
    const e = composeAdminMessageEmail({ name: "Ada", title: "Your <plan>", body: "First <b>line</b>\nsecond\n\nNew paragraph", url: "https://x.test/account" })
    expect(e.subject).toBe("Your <plan>")
    expect(e.text).toContain("Hello Ada,")
    expect(e.text).toContain("First <b>line</b>")
    expect(e.html).toContain("First &lt;b&gt;line&lt;/b&gt;<br>second")
    expect(e.html).not.toContain("<b>line</b>")
    expect(e.html).toContain("https://x.test/account")
  })
})
