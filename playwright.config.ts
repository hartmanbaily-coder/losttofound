import { defineConfig, devices } from "@playwright/test";

const host = process.env.PLAYWRIGHT_HOST || "127.0.0.1";
const port = process.env.PLAYWRIGHT_PORT || "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  webServer: {
    command: `npm run dev -- --hostname ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
