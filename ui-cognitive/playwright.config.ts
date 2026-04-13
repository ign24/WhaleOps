import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const projectDir = __dirname;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `bash -lc 'cd "${projectDir}" && PORT=3000 node .next/standalone/server.js'`,
    env: {
      ...process.env,
      NODE_PATH: `${projectDir}/node_modules`,
      USERS_FILE_PATH: `${projectDir}/data/users.json`,
      AUTH_URL: "http://127.0.0.1:3000",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "ci-secret",
    },
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
});
