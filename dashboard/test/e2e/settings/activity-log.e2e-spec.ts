/**
 * CareKit Dashboard — Activity Log Page E2E Tests
 */

import { test, expect } from '../setup/fixtures';

test.describe('Activity Log page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/activity-log');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    // /activity-log redirects to /users?tab=activityLog
    await expect(adminPage).toHaveURL(/\/activity-log|\/users/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('سجل النشاط').first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders activity log list or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const logItems = adminPage.locator('[class*="log"], [class*="activity"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد/);
    const hasContent =
      (await table.count() > 0) ||
      (await logItems.count() > 0) ||
      (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
