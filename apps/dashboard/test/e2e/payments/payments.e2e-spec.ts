/**
 * CareKit Dashboard — Payments Page E2E Tests
 */

import { test, expect } from '../setup/fixtures';

test.describe('Payments page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/payments');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/payments/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('المدفوعات').first()).toBeVisible();
  });

  test('shows search input', async ({ adminPage }) => {
    const searchInput = adminPage.locator('input[placeholder*="بحث"]');
    await expect(searchInput.first()).toBeVisible();
  });

  test('renders payments table or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد/);
    const hasContent = (await table.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
