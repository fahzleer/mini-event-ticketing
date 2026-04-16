/// <reference types="node" />
import { defineConfig, devices } from "@playwright/test"

/**
 * E2E test configuration for mini-event-ticketing.
 *
 * Required env vars:
 *   BASE_URL   — frontend URL  (default: https://events.lightningshot.co)
 *   API_URL    — backend URL   (default: https://mini-event-ticketing-api.up.railway.app)
 *
 * Run:
 *   bun run test:e2e
 *   BASE_URL=http://localhost:5173 API_URL=http://localhost:3000 bun run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // concurrent test requires sequential execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "https://events.lightningshot.co",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
