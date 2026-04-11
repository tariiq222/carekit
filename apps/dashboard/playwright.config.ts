import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * CareKit Dashboard — Playwright E2E Configuration
 *
 * Runs against the Next.js dev server on :5001.
 * Auth state is persisted to a file by global-setup and reused across tests.
 *
 * Usage:
 *   npm run test:e2e          — headless run
 *   npm run test:e2e -- --ui  — visual mode
 *   npm run test:e2e -- --debug
 */

export const AUTH_STATE_PATH = path.join(__dirname, 'test/e2e/setup/.auth/admin.json');

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.e2e-spec.ts',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  outputDir: 'test-results',

  use: {
    baseURL: 'http://localhost:5001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'global-setup',
      testMatch: '**/setup/global-setup.ts',
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_PATH,
      },
      dependencies: ['global-setup'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5001',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
