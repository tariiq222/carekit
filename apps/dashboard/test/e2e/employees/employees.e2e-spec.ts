/**
 * CareKit Dashboard — Employees Page E2E Tests
 *
 * Tests the /employees route:
 *   - Page loads without auth redirect
 *   - Title "الأطباء" is visible
 *   - Add employee button is present
 *   - Search input is accessible
 *   - Employee list or empty state renders
 */

import { test, expect } from '../setup/fixtures';

test.describe('Employees page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/employees');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/employees/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('الأطباء').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows add employee button', async ({ adminPage }) => {
    await expect(adminPage.getByText('إضافة طبيب').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows search input', async ({ adminPage }) => {
    const searchInput = adminPage.locator('input[placeholder*="ابحث"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders employee list or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const cards = adminPage.locator('[class*="card"], [class*="grid"]');
    const hasContent = (await table.count() > 0) || (await cards.count() > 0);
    expect(hasContent).toBe(true);
  });
});
