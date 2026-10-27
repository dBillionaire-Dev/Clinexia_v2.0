import { describe, expect, it } from "vitest"
import { SMART_SCOPES_EHR, SMART_SCOPES_STANDALONE, isAllowedIss, normaliseIss, parseAllowedIss, parseThresholds, smartScopes } from "./config"

describe("scopes (kept minimal)", () => {
  it("EHR launch asks for exactly the documented scopes", () => {
    expect(SMART_SCOPES_EHR).toBe("launch openid fhirUser patient/Patient.read patient/Observation.read")
    expect(smartScopes(false)).toBe(SMART_SCOPES_EHR)
  })
  it("standalone launch swaps launch for launch/patient and asks for nothing else", () => {
    expect(SMART_SCOPES_STANDALONE).toBe("launch/patient openid fhirUser patient/Patient.read patient/Observation.read")
    expect(smartScopes(true).split(" ").filter((s) => !SMART_SCOPES_EHR.split(" ").includes(s))).toEqual(["launch/patient"])
  })
  it("never asks for write, user-wide or offline access", () => {
    for (const s of [SMART_SCOPES_EHR, SMART_SCOPES_STANDALONE]) expect(s).not.toMatch(/write|\.\*|user\/|system\/|offline_access|\.cruds/)
  })
})

describe("FHIR server allowlist (iss)", () => {
  it("normalises https servers and drops a trailing slash", () => {
    expect(normaliseIss("https://fhir.example.org/r4/")).toBe("https://fhir.example.org/r4")
    expect(normaliseIss(" https://FHIR.example.org:8443/a/b ")).toBe("https://fhir.example.org:8443/a/b")
  })
  it("refuses plain http (except localhost), credentials, queries, fragments and junk", () => {
    for (const bad of ["http://fhir.example.org/r4", "https://u:p@fhir.example.org", "https://fhir.example.org/r4?x=1", "https://fhir.example.org/#a", "javascript:alert(1)", "", null, undefined, "not a url"]) {
      expect(normaliseIss(bad as string | null | undefined), String(bad)).toBeNull()
    }
    expect(normaliseIss("http://localhost:8080/fhir")).toBe("http://localhost:8080/fhir")
  })
  it("parses a comma separated list and refuses everything when it is empty", () => {
    expect(parseAllowedIss("https://a.org/fhir, https://b.org/r4/,https://a.org/fhir,http://c.org/x,bad")).toEqual(["https://a.org/fhir", "https://b.org/r4"])
    expect(isAllowedIss("https://a.org/fhir/", ["https://a.org/fhir"])).toBe(true)
    expect(isAllowedIss("https://evil.org/fhir", ["https://a.org/fhir"])).toBe(false)
    expect(isAllowedIss("https://a.org/fhir.evil.com", ["https://a.org/fhir"])).toBe(false)
    expect(isAllowedIss("https://a.org/fhir", [])).toBe(false)
  })
})

describe("staleness thresholds from the environment", () => {
  it("defaults to 30 days creatinine, 365 days height, 90 other", () => {
    expect(parseThresholds({})).toEqual({ creatinineDays: 30, heightDays: 365, otherDays: 90 })
  })
  it("reads valid whole numbers and ignores the rest", () => {
    expect(parseThresholds({ creatinine: "14", height: "730", other: "60" })).toEqual({ creatinineDays: 14, heightDays: 730, otherDays: 60 })
    expect(parseThresholds({ creatinine: "0", height: "abc", other: "-3" })).toEqual({ creatinineDays: 30, heightDays: 365, otherDays: 90 })
  })
})
