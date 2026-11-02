import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { calculators } from "./registry"

function serviceWorkerText() {
  return readFileSync(resolve(process.cwd(), "public/service-worker.js"), "utf8")
}

describe("service worker route coverage", () => {
  it("contains every registered calculator route", () => {
    const source = serviceWorkerText()
    for (const calculator of calculators) {
      expect(source).toContain(`/calculators/${calculator.category}/${calculator.id}`)
    }
  })

  it("uses the current cache generation", () => {
    expect(serviceWorkerText()).toContain('const CACHE_VERSION = "v6"')
  })
})
