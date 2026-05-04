/**
 * Playwright configuration for apps/admin (super-admin SaaS control plane).
 *
 * Prerequisites (run separately before `pnpm e2e`):
 *   1. Backend must be running:  npm run dev:backend  (port 5100)
 *   2. Docker stack (DB/Redis):  npm run docker:up
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
    baseURL: process.env.PW_ADMIN_URL ?? 'http://localhost:5104',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm --filter admin dev',
    port: 5104,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // CaptchaField auto-issues "dev-bypass" when this key is absent,
      // keeping the submit button enabled without real hCaptcha.
      NEXT_PUBLIC_HCAPTCHA_SITE_KEY: '',
    },
  },
});
