/**
 * Playwright configuration for apps/dashboard (per-tenant clinic).
 *
 * Prerequisites (run separately before `pnpm e2e`):
 *   1. Backend must be running:  npm run dev:backend  (port 5100)
 *   2. Docker stack (DB/Redis):  npm run docker:up
 *
 * The webServer block below spawns the Next.js dev server automatically
 * (or reuses an already-running one in non-CI mode).
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.PW_DASHBOARD_URL ?? 'http://localhost:5103',
    headless: true,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // globalSetup / globalTeardown are wired here for future persona pre-seeding.
  // D1 tests the login form directly and does not need pre-seeded storageState,
  // so we skip global-setup to avoid triggering the login-rate-limiter on dev.
  // Uncomment when D2+ tests use `test.use({ storageState })` patterns.
  // globalSetup: require.resolve('@deqah/test-helpers-pw/global-setup'),
  // globalTeardown: require.resolve('@deqah/test-helpers-pw/global-teardown'),

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm --filter dashboard dev',
    port: 5103,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // Tell the dashboard there is no real hCaptcha sitekey in test mode.
      // The CaptchaField component detects NEXT_PUBLIC_HCAPTCHA_SITE_KEY
      // being absent (or the test key) and auto-issues "dev-bypass" so the
      // submit button is never disabled.
      NEXT_PUBLIC_HCAPTCHA_SITE_KEY: '',
    },
  },
});
