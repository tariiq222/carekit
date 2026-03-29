/**
 * CareKit Dashboard — Settings Page E2E Tests
 *
 * Settings has tabs: General, Booking, Cancellation, Notifications, Working Hours, ZATCA, Email Templates
 */

import { test, expect } from '../setup/fixtures';

test.describe('Settings page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/settings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/settings/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('الإعدادات').first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders tab navigation', async ({ adminPage }) => {
    // Settings has multiple tabs — tab list should be present
    const tabList = adminPage.locator('[role="tablist"]');
    await expect(tabList.first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows notifications tab', async ({ adminPage }) => {
    await expect(adminPage.getByText('الإشعارات').first()).toBeVisible({ timeout: 12_000 });
  });
});
