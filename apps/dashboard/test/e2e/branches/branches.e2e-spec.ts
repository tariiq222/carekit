/**
 * CareKit Dashboard — Branches Page E2E Tests
 *
 * Tests the /branches route:
 *   - Page loads without auth redirect
 *   - Title "الفروع" is visible
 *   - Add branch button is present
 *   - Search input is accessible
 *   - Branch list or empty state renders
 */

import { test, expect } from '../setup/fixtures';

test.describe('Branches page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/branches');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/branches/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('الفروع').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows add branch button', async ({ adminPage }) => {
    await expect(adminPage.getByText('إضافة فرع').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows search input', async ({ adminPage }) => {
    const searchInput = adminPage.locator('input[placeholder*="ابحث"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders branches list or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const cards = adminPage.locator('[class*="card"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد/);
    const hasContent = (await table.count() > 0) || (await cards.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
