/**
 * CareKit Dashboard — Users Page E2E Tests
 */

import { test, expect } from '../setup/fixtures';

test.describe('Users page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/users');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/users/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('المستخدمون والأدوار').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows add user button', async ({ adminPage }) => {
    await expect(adminPage.getByText('إضافة مستخدم').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows search input', async ({ adminPage }) => {
    const searchInput = adminPage.locator('input[placeholder*="ابحث"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders user list or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد/);
    const hasContent = (await table.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
