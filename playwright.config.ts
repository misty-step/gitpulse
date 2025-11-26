import { defineConfig, devices } from "@playwright/test";

// Use unique port to avoid conflicts with other projects on localhost:3000
const PORT = process.env.PORT ?? "3010";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `PORT=${PORT} pnpm dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // 2 minutes for Next.js + Convex startup
  },
});
