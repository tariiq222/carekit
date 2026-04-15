/**
 * CareKit Dashboard — Notifications Sidebar Badge E2E Tests (Playwright)
 *
 * Test IDs: NT-UI-005, NT-UI-006, NT-UI-007
 *
 * Covers: header badge appearance after seeding, mark-read via card click,
 * and mark-all-read button clearing the badge.
 *
 * Seed helpers write directly to Postgres — no backend routes involved.
 * TanStack Query polls unread count every 30s; timeouts are set to 35s.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  seedNotification,
  clearNotifications,
  closeSeedPool,
} from '../setup/seed-notification';

const ADMIN_EMAIL = process.env['TEST_ADMIN_EMAIL'] ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env['TEST_ADMIN_PASSWORD'] ?? 'Admin@1234';

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('#email', { timeout: 20_000 });
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  // Wait until the login form is gone (AuthProvider has loaded the user)
  await page
    .waitForFunction(() => !document.querySelector('#email'), null, { timeout: 15_000 })
    .catch(() => {});
}

test.describe('Notifications sidebar badge', () => {
  test.beforeEach(async () => {
    await clearNotifications();
  });

  test.afterEach(async () => {
    await clearNotifications();
  });

  test.afterAll(async () => {
    await closeSeedPool();
  });

  test('[NT-UI-005][Notifications/sidebar-badge][P1-High] Sidebar badge يظهر العدد بعد إشعار جديد', async ({ page }) => {
    await login(page);
    const badge = page.getByTestId('notifications-badge');
    await expect(badge).toHaveCount(0);

    await seedNotification({ title: 'إشعار UI' });

    await expect(badge).toBeVisible({ timeout: 35_000 });
    await expect(badge).toHaveText(/^1$/);
  });

  test('[NT-UI-006][Notifications/mark-read-ui][P1-High] فتح صفحة الإشعارات + النقر يُخفي البادج', async ({ page }) => {
    await seedNotification();
    await login(page);

    const badge = page.getByTestId('notifications-badge');
    await expect(badge).toBeVisible({ timeout: 35_000 });

    await page.goto('/notifications');
    await page.getByTestId('notification-card').first().click();

    await expect(badge).toHaveCount(0, { timeout: 35_000 });
  });

  test('[NT-UI-007][Notifications/mark-all-read-ui][P2-Medium] mark all as read يصفّر البادج', async ({ page }) => {
    await seedNotification();
    await seedNotification();
    await seedNotification();
    await login(page);

    const badge = page.getByTestId('notifications-badge');
    await expect(badge).toBeVisible({ timeout: 35_000 });
    await expect(badge).toHaveText(/^3$/);

    await page.goto('/notifications');
    await page.getByTestId('mark-all-read').click();

    await expect(badge).toHaveCount(0, { timeout: 35_000 });
  });
});
