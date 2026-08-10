import { defineConfig, devices } from "@playwright/test";
import { config as loadEnvironment } from "dotenv";

loadEnvironment({ path: ".env.local", quiet: true });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["line"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: "pnpm e2e:prepare && pnpm dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          env: {
            ...process.env,
            SQLITE_PATH: ".tmp/learner-lite-e2e.sqlite",
            AUTH_SECRET: "learner-lite-e2e-secret-should-never-be-used-in-production",
            SCENARIO_AI_MODE: "mock",
            E2E_LEARNER_EMAIL: "learner.one@example.test",
            E2E_LEARNER_PASSWORD: "learner-pass-1",
            E2E_SECOND_LEARNER_EMAIL: "learner.two@example.test",
            E2E_SECOND_LEARNER_PASSWORD: "learner-pass-2",
            E2E_DISABLED_LEARNER_EMAIL: "disabled@example.test",
            E2E_DISABLED_LEARNER_PASSWORD: "learner-pass-3",
          },
        },
      }),
});
