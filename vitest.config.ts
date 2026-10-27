import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@clinexia/core": path.resolve(__dirname, "packages/core/src"),
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "**/.clinexia-backup/**", "packages/core/dist"],
  },
})
