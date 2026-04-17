import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "playwright/test";
import { getPlaywrightDatabasePath } from "./playwright.database-path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPort = 4173;
const backendPort = 8010;
const testDatabasePath = getPlaywrightDatabasePath();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  globalTeardown: "./playwright.global-teardown.ts",
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  webServer: [
    {
      command: "../backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010",
      cwd: path.resolve(__dirname, "../backend"),
      url: `http://127.0.0.1:${backendPort}/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        AI_PROVIDER: "mock",
        BACKEND_CORS_ORIGINS: `http://127.0.0.1:${frontendPort}`,
        DATABASE_URL: `sqlite:///${testDatabasePath}`,
        JWT_SECRET_KEY: "playwright-secret-key-for-local-e2e-tests"
      }
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      cwd: __dirname,
      url: `http://127.0.0.1:${frontendPort}`,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `http://127.0.0.1:${backendPort}`
      }
    }
  ]
});
