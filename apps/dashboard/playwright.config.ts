import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * CareKit Dashboard — Playwright E2E Configuration
 *
 * Runs against the Next.js dev server on :5103.
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
    baseURL: 'http://localhost:5103',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    /**
     * smoke  — تحميل الصفحات، عناصر أساسية. يعمل على كل PR. (~2 دقيقة)
     * critical — المسار الأساسي end-to-end. يعمل قبل كل deploy. (~10 دقائق)
     * full   — كل الاختبارات. يعمل nightly.
     *
     * تشغيل مشروع معين:
     *   npx playwright test --project=smoke
     *   npx playwright test --project=critical
     *   npx playwright test --project=full
     */
    {
      name: 'smoke',
      grep: /@smoke/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'critical',
      grep: /@critical/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'full',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // webServer disabled — we run backend + dashboard manually in separate shells
  // for the local test run so we can control env vars (TEST DB, test Redis port).
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5103',
  //   reuseExistingServer: true,
  //   timeout: 120_000,
  // },
});
