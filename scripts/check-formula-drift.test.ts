import { describe, expect, it } from "vitest"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { compareFolders, normalise } from "./check-formula-drift.mjs"

function folder(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "drift-"))
  for (const [rel, text] of Object.entries(files)) {
    const p = join(dir, rel)
    mkdirSync(join(p, ".."), { recursive: true })
    writeFileSync(p, text)
  }
  return dir
}

describe("check-formula-drift", () => {
  it("treats line endings and trailing whitespace as the same", () => {
    expect(normalise("a  \r\nb\r\n\r\n")).toBe(normalise("a\nb\n"))
  })

  it("--ignore-imports ignores single-line imports and re-exports only", () => {
    const a = 'import { x } from "./a"\nexport * from "./b"\nconst y = 1\n'
    const b = 'import { x } from "@/lib/a"\nconst y = 1\n'
    expect(normalise(a)).not.toBe(normalise(b))
    expect(normalise(a, { ignoreImports: true })).toBe(normalise(b, { ignoreImports: true }))
    expect(normalise("const y = 1\n", { ignoreImports: true })).not.toBe(normalise("const y = 2\n", { ignoreImports: true }))
  })

  it("reports identical, differing (with the first differing line), missing and extra files", () => {
    const web = folder({ "a.ts": "const a = 1\n", "defs/b.ts": "const rate = 0.5\nconst z = 2\n", "only-web.ts": "x\n", "a.test.ts": "ignored", "test-vector-data.ts": "ignored" })
    const mobile = folder({ "a.ts": "const a = 1\r\n", "defs/b.ts": "const rate = 0.6\nconst z = 2\n", "only-mobile.ts": "y\n", "notes.md": "ignored" })
    const r = compareFolders(web, mobile)
    expect(r.identical).toEqual(["a.ts"])
    expect(r.differing.length).toBe(1)
    expect(r.differing[0]).toMatchObject({ file: "defs/b.ts", line: 1, web: "const rate = 0.5", other: "const rate = 0.6" })
    expect(r.onlyInWeb).toEqual(["only-web.ts"])
    expect(r.onlyInOther).toEqual(["only-mobile.ts"])
  })

  it("two identical folders have no drift", () => {
    const files = { "a.ts": "1\n", "d/b.ts": "2\n" }
    const r = compareFolders(folder(files), folder(files))
    expect([r.differing.length, r.onlyInWeb.length, r.onlyInOther.length, r.identical.length]).toEqual([0, 0, 0, 2])
  })
})
