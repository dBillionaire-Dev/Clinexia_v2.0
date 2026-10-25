import { describe, expect, it, vi } from "vitest"
import { buildReadyMessage, buildResultMessage, isTrustedParentMessage, parsePrefillMessage, postToParent } from "./embed-bridge"

const result = { value: 77.2, unit: "mL/min", display: "77.2 mL/min" }

describe("postToParent", () => {
  it("posts only to the specific allowlisted origin, never '*'", () => {
    const parent = { postMessage: vi.fn() }
    const msg = buildResultMessage("creatinine-clearance", "1.0.0", result)
    expect(postToParent(parent, "https://emr.example.org", msg)).toBe(true)
    expect(parent.postMessage).toHaveBeenCalledWith(
      { source: "clinexia", type: "result", calculatorId: "creatinine-clearance", version: "1.0.0", result },
      "https://emr.example.org",
    )
  })
  it("sends nothing without a known parent origin or when given '*'", () => {
    const parent = { postMessage: vi.fn() }
    expect(postToParent(parent, null, buildReadyMessage("bmi"))).toBe(false)
    expect(postToParent(parent, "*", buildReadyMessage("bmi"))).toBe(false)
    expect(postToParent(null, "https://a.org", buildReadyMessage("bmi"))).toBe(false)
    expect(parent.postMessage).not.toHaveBeenCalled()
  })
})

describe("isTrustedParentMessage", () => {
  const win = {}
  it("requires both the allowlisted origin and the real parent window", () => {
    expect(isTrustedParentMessage({ origin: "https://a.org", source: win }, "https://a.org", win)).toBe(true)
    expect(isTrustedParentMessage({ origin: "https://evil.org", source: win }, "https://a.org", win)).toBe(false)
    expect(isTrustedParentMessage({ origin: "https://a.org", source: {} }, "https://a.org", win)).toBe(false)
    expect(isTrustedParentMessage({ origin: "https://a.org", source: win }, null, win)).toBe(false)
    expect(isTrustedParentMessage({ origin: "null", source: null }, "https://a.org", null)).toBe(false)
  })
})

describe("parsePrefillMessage", () => {
  it("accepts { type: 'prefill', values } and keeps only strings and finite numbers", () => {
    expect(parsePrefillMessage({ type: "prefill", values: { age: 54, sex: "male", bad: {}, nan: NaN, flag: true } })).toEqual({
      values: { age: "54", sex: "male" },
      calculate: false,
    })
    expect(parsePrefillMessage({ type: "prefill", values: { age: 1 }, calculate: true })?.calculate).toBe(true)
    expect(parsePrefillMessage({ type: "prefill", values: { age: 1 }, calculate: "1" })?.calculate).toBe(false)
  })
  it("rejects other shapes", () => {
    for (const bad of [null, undefined, "x", 3, [], {}, { type: "result" }, { type: "prefill" }, { type: "prefill", values: [] }, { type: "prefill", values: "x" }]) {
      expect(parsePrefillMessage(bad)).toBeNull()
    }
  })
})
