import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.ts",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "test-results/browser",
  use: {
    ...devices["Desktop Chrome"],
    channel: process.env.TEST_BROWSER || "msedge",
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 1040 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: '"' + process.execPath + '" scripts/run-framework.mjs dev',
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
