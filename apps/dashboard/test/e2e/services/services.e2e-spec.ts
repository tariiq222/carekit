/**
 * CareKit Dashboard — Services Page E2E Tests
 *
 * Tests the /services route:
 *   - Page loads without auth redirect
 *   - Title "الخدمات" is visible
 *   - Add service button is present
 *   - Search input is accessible
 *   - Service list or empty state renders
 */

import { test, expect } from '../setup/fixtures';

test.describe('Services page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/services/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('الخدمات').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows add service button', async ({ adminPage }) => {
    await expect(adminPage.getByText('إضافة خدمة').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows search input', async ({ adminPage }) => {
    const searchInput = adminPage.locator('input[placeholder*="ابحث"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders services list or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const cards = adminPage.locator('[class*="card"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد/);
    const hasContent = (await table.count() > 0) || (await cards.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
