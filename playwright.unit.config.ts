import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: ["rules.spec.ts", "workflow.spec.ts", "rubric.spec.ts"],
  workers: 1,
  reporter: "list",
  outputDir: "test-results/unit",
});
