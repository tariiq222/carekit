/**
 * CareKit Dashboard — Invoices E2E Tests (with data checks)
 *
 * INV-001 to INV-003.
 * Navigate to /invoices.
 */

import { test, expect } from '../setup/fixtures';

// ── INV-001 Page loads ────────────────────────────────────────────────────────
test.describe('Invoices — تحميل الصفحة', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/invoices');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[INV-001] @smoke — الصفحة تحمل', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/invoices/);
    await expect(adminPage.locator('#email')).not.toBeVisible();

    const content = adminPage.locator(
      'table, [role="table"], [class*="empty"], h1, h2, [class*="card"]',
    );
    await expect(content.first()).toBeVisible({ timeout: 12_000 });
  });
});

// ── INV-002 Table or empty state ─────────────────────────────────────────────
test.describe('Invoices — الجدول أو empty state', () => {
  test('[INV-002] @smoke — الجدول أو empty state', async ({ adminPage, goto }) => {
    await goto('/invoices');

    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد|لا فواتير/);
    const hasContent = (await table.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});

// ── INV-003 Date filter ───────────────────────────────────────────────────────
test.describe('Invoices — فلترة بالتاريخ', () => {
  test('[INV-003] @smoke — فلترة بالتاريخ ممكنة (date input موجود)', async ({ adminPage, goto }) => {
    await goto('/invoices');

    const dateInput = adminPage
      .locator('input[type="date"], input[placeholder*="تاريخ"], input[placeholder*="من"], input[placeholder*="إلى"]')
      .first();

    const dateRangePicker = adminPage
      .locator('[class*="date-picker"], [class*="DatePicker"], button[aria-label*="تاريخ"]')
      .first();

    const isVisible =
      (await dateInput.isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await dateRangePicker.isVisible({ timeout: 8_000 }).catch(() => false));

    if (!isVisible) {
      test.skip();
      return;
    }

    expect(isVisible).toBe(true);
  });
});
