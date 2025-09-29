import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const rootDir = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      lines: 70,
      functions: 70,
      statements: 70,
      branches: 60,
      include: ["lib/server/**/*.ts", "app/api/report/route.ts"],
    },
    include: ["tests/**/*.test.ts"],
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "."),
    },
  },
})
