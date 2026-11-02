// clinexia-upgrade:phase7 tests — the logo geometry and the image files that carry it.
import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { LOGO_BLUE, LOGO_CENTERLINE, LOGO_OUTLINE } from "./logo-path"

const root = process.cwd()
const png = (rel: string) => {
  const b = readFileSync(resolve(root, rel))
  expect(b.subarray(0, 8).toString("hex"), rel).toBe("89504e470d0a1a0a")
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] }
}
const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

describe("logo geometry", () => {
  it("is one closed outline of plain line segments", () => {
    expect(LOGO_OUTLINE).toMatch(/^M[\d. L-]+Z$/)
    expect(LOGO_OUTLINE.match(/M/g)).toHaveLength(1)
  })
  it("sits centred in the 512 box with the traced size (326.6 x 294)", () => {
    const n = nums(LOGO_OUTLINE), xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    expect(Math.abs((x0 + x1) / 2 - 256)).toBeLessThan(0.6)
    expect(Math.abs((y0 + y1) / 2 - 256)).toBeLessThan(0.6)
    expect(x1 - x0).toBeGreaterThan(325); expect(x1 - x0).toBeLessThan(328)
    expect(y1 - y0).toBeGreaterThan(292); expect(y1 - y0).toBeLessThan(296)
  })
  it("has a centre line that stays inside the mark's box", () => {
    for (const v of nums(LOGO_CENTERLINE)) { expect(v).toBeGreaterThan(90); expect(v).toBeLessThan(425) }
  })
  it("uses the brand blue from the supplied logo", () => expect(LOGO_BLUE).toBe("#0059e9"))
})

describe("logo image files", () => {
  const expectSize = (rel: string, size: number) => { if (existsSync(resolve(root, rel))) { const p = png(rel); expect([p.w, p.h], rel).toEqual([size, size]) } }
  it("app icons have the sizes the manifest declares", () => {
    expectSize("public/icon-192x192.png", 192)
    expectSize("public/icon-512x512.png", 512)
    expectSize("public/icon-maskable-192x192.png", 192)
    expectSize("public/icon-maskable-512x512.png", 512)
    expectSize("public/apple-touch-icon.png", 180)
  })
  it("the any-purpose icons keep their transparency (RGBA), the Apple icon is opaque (RGB)", () => {
    for (const f of ["public/icon-192x192.png", "public/icon-512x512.png"]) if (existsSync(resolve(root, f))) expect(png(f).colorType, f).toBe(6)
    if (existsSync(resolve(root, "public/apple-touch-icon.png"))) expect(png("public/apple-touch-icon.png").colorType).toBe(2)
  })
  it("favicon.ico carries 16, 32 and 48 pixel images", () => {
    const f = resolve(root, "public/favicon.ico")
    if (!existsSync(f)) return
    const b = readFileSync(f), n = b.readUInt16LE(4)
    const sizes = Array.from({ length: n }, (_, i) => b[6 + i * 16] || 256).sort((a, c) => a - c)
    expect(sizes).toEqual([16, 32, 48])
  })
  it("Android launcher icons have the standard sizes", () => {
    const dens: Record<string, number> = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
    for (const [d, s] of Object.entries(dens)) {
      expectSize(`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, s)
      expectSize(`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, s)
      expectSize(`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, (s / 48) * 108)
    }
  })
})
