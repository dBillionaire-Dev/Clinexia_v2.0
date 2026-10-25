import { describe, expect, it } from "vitest"
import { DEFAULT_RATE_LIMIT_PER_MINUTE, configuredLimit, createRateLimiter } from "./rate-limit"

describe("configuredLimit", () => {
  it("defaults to 60 and reads API_RATE_LIMIT_PER_MINUTE", () => {
    expect(DEFAULT_RATE_LIMIT_PER_MINUTE).toBe(60)
    expect(configuredLimit({})).toBe(60)
    expect(configuredLimit({ API_RATE_LIMIT_PER_MINUTE: "120" })).toBe(120)
  })
  it("ignores invalid values", () => {
    for (const bad of ["0", "-5", "abc", "1.5", "", "999999999"]) expect(configuredLimit({ API_RATE_LIMIT_PER_MINUTE: bad }), bad).toBe(60)
  })
})

describe("createRateLimiter", () => {
  it("allows N calls per rolling minute, then refuses with a Retry-After", () => {
    let t = 1_000_000
    const rl = createRateLimiter({ limit: () => 3, now: () => t })
    const d1 = rl.check("k")
    expect([d1.allowed, d1.remaining, d1.limit]).toEqual([true, 2, 3])
    expect(rl.check("k").allowed).toBe(true)
    expect(rl.check("k").remaining).toBe(0)
    t += 10_000
    const blocked = rl.check("k")
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfter).toBeGreaterThan(0)
    expect(blocked.retryAfter <= 60).toBe(true)
    expect(blocked.resetAt).toBe(Math.ceil((1_000_000 + 60_000) / 1000))
  })
  it("frees up after the window", () => {
    let t = 0
    const rl = createRateLimiter({ limit: () => 1, now: () => t })
    expect(rl.check("k").allowed).toBe(true)
    expect(rl.check("k").allowed).toBe(false)
    t = 60_001
    expect(rl.check("k").allowed).toBe(true)
  })
  it("counts each key separately, and refused calls do not extend the block", () => {
    let t = 0
    const rl = createRateLimiter({ limit: () => 1, now: () => t })
    expect(rl.check("a").allowed).toBe(true)
    expect(rl.check("b").allowed).toBe(true)
    expect(rl.check("a").allowed).toBe(false)
    t = 30_000
    expect(rl.check("a").allowed).toBe(false)
    t = 60_001
    expect(rl.check("a").allowed).toBe(true)
  })
})
