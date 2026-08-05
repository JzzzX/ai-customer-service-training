import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "company-stack-foundation.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:8006",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command:
        "APP_ENV=test DATABASE_URL=sqlite+pysqlite:///./company-stack-e2e.db backend/.venv/bin/python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8005",
      url: "http://127.0.0.1:8005/api/v1/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm --prefix frontend run dev -- --host 127.0.0.1 --port 8006",
      url: "http://127.0.0.1:8006/migration/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
