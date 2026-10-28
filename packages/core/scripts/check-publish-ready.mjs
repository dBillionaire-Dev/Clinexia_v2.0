// Runs before `npm publish` (prepublishOnly). Refuses until the open decisions are made. Nothing here publishes anything.
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const dir = join(dirname(fileURLToPath(import.meta.url)), "..")
const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
const problems = []
if (pkg.private) problems.push('package.json still has "private": true. Remove it only when you have decided to publish.')
if (!pkg.license || /^(UNLICENSED|SEE LICENSE.*|TODO.*|)$/i.test(pkg.license)) problems.push('package.json "license" is still a placeholder. Choosing the licence is a Decision needed (docs/integration/FINDINGS.md).')
if (!existsSync(join(dir, "dist/esm/index.js"))) problems.push("dist/ is missing: run the build first.")
if (problems.length) {
  console.error("@clinexia/core is not ready to publish:\n - " + problems.join("\n - "))
  process.exit(1)
}
console.log("@clinexia/core looks publish-ready.")
