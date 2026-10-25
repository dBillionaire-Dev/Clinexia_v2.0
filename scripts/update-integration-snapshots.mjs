// Regenerates the generated integration files from the calculators' CURRENT behaviour:
//   lib/calculators/test-vector-data.ts  and  docs/integration/reference-gaps.md
// Run it only after you have bumped the formula version of anything you changed on purpose (see docs/integration/CHANGELOG.md),
// then read the git diff: every changed entry must correspond to a bump and a changelog entry.
//
//   pnpm integration:snapshots
import { spawnSync } from "node:child_process"

const result = spawnSync("pnpm", ["exec", "vitest", "run", "lib/calculators/test-vectors.test.ts", "lib/calculators/versions.test.ts"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, UPDATE_TEST_VECTORS: "1", UPDATE_REFERENCE_GAPS: "1" },
})
if (result.status === 0) {
  console.log("\nRegenerated. Review: git diff lib/calculators/test-vector-data.ts docs/integration/reference-gaps.md")
}
process.exit(result.status ?? 1)
