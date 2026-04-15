/**
 * Playwright Global Setup — CareKit Dashboard
 *
 * Logs in as super_admin and saves browser storage state so all tests
 * can start already authenticated without re-logging in.
 *
 * The login form uses:
 *   - input#email
 *   - input#password
 *   - button[type="submit"]
 *
 * After login the AuthProvider stores the accessToken in memory
 * (localStorage key: 'carekit_access_token') and sets a cookie for refresh.
 */

import { test as setup } from '@playwright/test';
import { AUTH_STATE_PATH } from '../../../playwright.config';

const ADMIN_EMAIL = process.env['TEST_ADMIN_EMAIL'] ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env['TEST_ADMIN_PASSWORD'] ?? 'Admin@1234';

setup('authenticate as super_admin', async ({ page }) => {
  await page.goto('/');

  // Wait for login form (AuthGate renders it when user is null)
  await page.waitForSelector('#email', { timeout: 15_000 });

  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait until the dashboard content loads (auth succeeded)
  // The dashboard home page renders a heading or nav — wait for navigation
  await page.waitForURL('/', { timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 });

  // Verify we are logged in: the login form should no longer be visible
  const loginForm = await page.$('#email');
  if (loginForm) {
    throw new Error('Login form still visible after login — authentication failed');
  }

  // Save auth state (cookies + localStorage)
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
