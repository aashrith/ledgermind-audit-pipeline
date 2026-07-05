import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Targets the running stack (docker compose → http://localhost:8080, or the
 * Vite dev server → http://localhost:5173 via E2E_BASE_URL).
 *
 * CDP mode: set E2E_CDP_URL (e.g. http://localhost:9222) to drive an already-open Chrome
 * over the DevTools Protocol instead of launching a managed browser — see fixtures.ts.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
