/**
 * CareKit Dashboard — Invoices Page E2E Tests
 *
 * The /invoices page includes a ZATCA tab (ZATCA is embedded here, not a separate route).
 */

import { test, expect } from '../setup/fixtures';

test.describe('Invoices page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/invoices');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/invoices/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('الفواتير').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows search input', async ({ adminPage }) => {
    const searchInput = adminPage.locator('input[placeholder*="بحث"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders invoices table or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد/);
    const hasContent = (await table.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});

test.describe('ZATCA tab via /invoices?tab=zatca', () => {
  test('navigates to ZATCA tab from redirect URL', async ({ adminPage, goto }) => {
    await goto('/invoices?tab=zatca');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // ZATCA tab content should be visible
    await expect(adminPage.getByText('التوافق مع فاتورة').first()).toBeVisible({ timeout: 12_000 });
  });
});
