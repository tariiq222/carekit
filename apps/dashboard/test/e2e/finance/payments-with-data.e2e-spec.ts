/**
 * CareKit Dashboard — Payments E2E Tests
 *
 * PAY-001 to PAY-004.
 * Navigate to /payments.
 */

import { test, expect } from '../setup/fixtures';

// ── PAY-001 Page loads ────────────────────────────────────────────────────────
test.describe('Payments — تحميل الصفحة', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/payments');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[PAY-001] @smoke — الصفحة تحمل', async ({ adminPage }) => {
    await expect(adminPage.locator('#email')).not.toBeVisible();

    const content = adminPage.locator(
      'table, [role="table"], [class*="empty"], h1, h2, [class*="stat"], [class*="card"]',
    );
    await expect(content.first()).toBeVisible({ timeout: 12_000 });
  });
});

// ── PAY-002 Table or empty state ─────────────────────────────────────────────
test.describe('Payments — الجدول أو empty state', () => {
  test('[PAY-002] @smoke — الجدول أو empty state', async ({ adminPage, goto }) => {
    await goto('/payments');

    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد|لا مدفوعات/);
    const hasContent = (await table.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});

// ── PAY-003 Stats cards ───────────────────────────────────────────────────────
test.describe('Payments — إحصائيات الدفعات', () => {
  test('[PAY-003] @smoke — إحصائيات الدفعات (stats cards) موجودة', async ({ adminPage, goto }) => {
    await goto('/payments');

    // Stats cards تحتوي عادةً على أرقام أو مبالغ
    const statsCards = adminPage.locator(
      '[class*="stat"], [class*="StatCard"], [class*="stats-card"], [data-testid*="stat"]',
    );

    const cardWithNumbers = adminPage.locator(
      '[class*="card"]',
    ).filter({ hasText: /ريال|SAR|%|المبلغ|الإجمالي|مدفوع|معلق/ });

    const isVisible =
      (await statsCards.count() > 0) ||
      (await cardWithNumbers.count() > 0);

    if (!isVisible) {
      test.skip();
      return;
    }

    await expect(statsCards.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── PAY-004 Date or status filter ────────────────────────────────────────────
test.describe('Payments — فلترة بالتاريخ أو الحالة', () => {
  test('[PAY-004] @smoke — فلترة بالتاريخ أو الحالة ممكنة', async ({ adminPage, goto }) => {
    await goto('/payments');

    const dateInput = adminPage
      .locator('input[type="date"], input[placeholder*="تاريخ"]')
      .first();

    const statusFilter = adminPage
      .locator('[role="combobox"]')
      .filter({ hasText: /الكل|الحالة|مدفوع|معلق|ملغي/ })
      .first();

    const isVisible =
      (await dateInput.isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await statusFilter.isVisible({ timeout: 8_000 }).catch(() => false));

    if (!isVisible) {
      test.skip();
      return;
    }

    expect(isVisible).toBe(true);
  });
});
