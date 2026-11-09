import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    passWithNoTests: true,
    // Route handlers are exercised by the Playwright e2e suite; Vitest gates lib/.
    coverage: {
      provider: "v8",
      include: ["lib/**"],
      thresholds: { lines: 80, statements: 80 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "tests/unit/**/*.test.ts",
            "tests/components/**/*.test.tsx",
          ],
          setupFiles: ["tests/setup.unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          pool: "forks",
          poolOptions: {
            forks: { singleFork: true },
          },
          testTimeout: 30000,
          hookTimeout: 30000,
          setupFiles: ["tests/setup.integration.ts"],
        },
      },
    ],
  },
});
