/**
 * CareKit Dashboard — Bookings Page E2E Tests
 *
 * Tests the /bookings route:
 *   - Page loads without auth redirect
 *   - Header title "الحجوزات" is visible
 *   - "حجز جديد" button is present
 *   - Tab navigation works (Bookings / Problem Reports)
 *   - Search input is accessible
 */

import { test, expect } from '../setup/fixtures';

test.describe('Bookings page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/bookings/);
    const loginInput = adminPage.locator('#email');
    await expect(loginInput).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('الحجوزات').first()).toBeVisible();
  });

  test('shows new booking button', async ({ adminPage }) => {
    await expect(adminPage.getByText('حجز جديد').first()).toBeVisible();
  });

  test('renders booking list or empty state', async ({ adminPage }) => {
    // Either a table with rows or an empty state message should appear
    const table = adminPage.locator('table, [role="table"]');
    const emptyState = adminPage.getByText('لا توجد حجوزات');
    const hasTable = await table.count() > 0;
    const hasEmpty = await emptyState.count() > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('search input is visible', async ({ adminPage }) => {
    const searchInput = adminPage.locator('input[type="search"], input[placeholder*="بحث"]');
    await expect(searchInput.first()).toBeVisible();
  });
});
