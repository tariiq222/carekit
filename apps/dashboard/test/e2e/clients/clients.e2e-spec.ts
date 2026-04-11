/**
 * CareKit Dashboard — Clients Page E2E Tests
 *
 * Tests the /clients route:
 *   - Page loads without auth redirect
 *   - Title "المرضى" is visible
 *   - Add client button is present
 *   - Search input is accessible
 *   - Client list or empty state renders
 */

import { test, expect } from '../setup/fixtures';

test.describe('Clients page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/clients');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/clients/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('المرضى').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows add client button', async ({ adminPage }) => {
    await expect(adminPage.getByText('إضافة مريض').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows search input', async ({ adminPage }) => {
    const searchInput = adminPage.locator('input[placeholder*="ابحث"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders client list or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText('لا يوجد مرضى');
    const hasContent = (await table.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
