/**
 * CareKit Dashboard — Notifications Page E2E Tests
 */

import { test, expect } from '../setup/fixtures';

test.describe('Notifications page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/notifications');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/notifications/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('الإشعارات').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows mark all read button or notification list', async ({ adminPage }) => {
    const markAllRead = adminPage.getByText('تحديد الكل كمقروء');
    const notifList = adminPage.locator('[class*="notification"], [class*="list"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد/);
    const hasContent =
      (await markAllRead.count() > 0) ||
      (await notifList.count() > 0) ||
      (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
