/**
 * CareKit Dashboard — Branding Page E2E Tests
 *
 * The /branding route has tabs: العلامة التجارية (Branding), الدفع (Payment), التكاملات (Integrations)
 */

import { test, expect } from '../setup/fixtures';

test.describe('Branding page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/branding');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/branding/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('العلامة التجارية').first()).toBeVisible({ timeout: 12_000 });
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
