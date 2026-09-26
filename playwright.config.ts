import { defineConfig, devices } from "@playwright/test";

// E2E against the local stack: `pnpm db:start`, then `pnpm e2e`.
// Uses the installed Google Chrome (no browser download needed).
const PORT = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: "tests",
  testMatch: /(e2e|visual)\/.*\.spec\.ts$/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "ipad-landscape",
      use: { ...devices["iPad Pro 11 landscape"], channel: "chrome", defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { APP_URL: `http://localhost:${PORT}`, NEXT_DIST_DIR: ".next-e2e" },
  },
});
