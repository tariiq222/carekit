/**
 * CareKit Dashboard — Whitelabel Page E2E Tests
 *
 * The /white-label route has tabs: العلامة التجارية (Branding), الدفع (Payment), التكاملات (Integrations)
 */

import { test, expect } from '../setup/fixtures';

test.describe('Whitelabel page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/white-label');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/white-label/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('وايت ليبل').first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders tab navigation', async ({ adminPage }) => {
    const tabList = adminPage.locator('[role="tablist"]');
    await expect(tabList.first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows branding tab by default', async ({ adminPage }) => {
    await expect(adminPage.getByText('العلامة التجارية').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows payment tab', async ({ adminPage }) => {
    await expect(adminPage.getByText('الدفع').first()).toBeVisible({ timeout: 12_000 });
  });
});
