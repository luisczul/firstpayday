import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/schedule/**", "lib/money/**", "lib/billing/access.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: { branches: 100, lines: 100, functions: 100, statements: 100 },
    },
  },
});
