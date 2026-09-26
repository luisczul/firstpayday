import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests against the local Supabase stack (pnpm db:start).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: { include: ["tests/rls/**/*.test.ts"], environment: "node", testTimeout: 20_000, fileParallelism: false },
});
