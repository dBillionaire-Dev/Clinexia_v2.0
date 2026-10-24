import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"

/**
 * Structural guard for the "no PHI" rule on the embed path. It cannot prove runtime behaviour, so it is paired with the
 * manual network-tab check in docs/integration/embed.md. It fails if someone wires analytics, history or usage tracking
 * into the embed route or the integration helpers.
 */
const root = process.cwd()
const read = (p: string) => readFileSync(resolve(root, p), "utf8")
const FORBIDDEN = [/@\/lib\/analytics/, /track-calculation/, /use-history/, /recently-used/, /calculation_events/, /analytics-sync/]

const embedFiles = [
  "app/embed/[category]/[id]/page.tsx",
  "components/embed/embed-calculator.tsx",
  ...readdirSync(resolve(root, "lib/integration"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join("lib/integration", f)),
]

describe("embed path stays free of analytics and local persistence", () => {
  for (const file of embedFiles) {
    it(`${file} does not import analytics, history or usage tracking`, () => {
      const src = read(file)
      for (const pattern of FORBIDDEN) expect(src, `${file} matches ${pattern}`).not.toMatch(pattern)
    })
  }

  it("the runner skips usage + history (which fires analytics) when embedded", () => {
    const src = read("components/calculators/calculator-runner.tsx")
    expect(src).toMatch(/if \(!embed\) \{\s*recordUsage\(definition\.id\)\s*await saveResultToHistory\(parsed, finalResult\)\s*\}/)
  })

  it("the site chrome that syncs analytics is not rendered on /embed", () => {
    const layout = read("app/layout.tsx")
    expect(layout).toMatch(/<SiteChrome>\s*<AnalyticsSync \/>\s*<\/SiteChrome>/)
    expect(layout).toMatch(/<SiteChrome>\s*<UpdateWatcher \/>\s*<\/SiteChrome>/)
    expect(read("components/site-chrome.tsx")).toContain("isEmbedPath")
  })

  it("the service worker never caches /embed or calculator URLs that carry a query string", () => {
    const sw = read("public/service-worker.js")
    expect(sw).toContain('/embed/')
    expect(sw).toMatch(/requestUrl\.search/)
  })
})
