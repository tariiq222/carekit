/**
 * CareKit Dashboard — Gift Cards Page E2E Tests
 */

import { test, expect } from '../setup/fixtures';

test.describe('Gift Cards page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/gift-cards');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/gift-cards/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('بطاقات الهدايا').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows add gift card button', async ({ adminPage }) => {
    const addButton = adminPage.getByText(/بطاقة هدية جديدة|إضافة بطاقة هدية/);
    await expect(addButton.first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows search input', async ({ adminPage }) => {
    const searchInput = adminPage.locator('input[placeholder*="بحث"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders gift card list or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد/);
    const hasContent = (await table.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
