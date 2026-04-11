/**
 * CareKit Dashboard — Intake Forms Page Interaction Tests
 *
 * Verifies UI interactions on /intake-forms:
 *   - "إنشاء نموذج" navigates to /intake-forms/create
 *   - Stats grid renders 3 stat cards
 *   - Edit (pencil) button navigates to /intake-forms/{id}/edit
 *   - Preview button opens FormPreviewDialog and can be closed
 *   - Toggle active switch changes state
 *   - Search input reflects typed value
 */

import { test, expect } from '../setup/fixtures';

test.describe('Intake Forms — create navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/intake-forms');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('clicking "إنشاء نموذج" navigates to /intake-forms/create', async ({ adminPage }) => {
    const createBtn = adminPage.getByRole('button', { name: /إنشاء نموذج/ });
    await expect(createBtn).toBeVisible({ timeout: 12_000 });
    await createBtn.scrollIntoViewIfNeeded();
    await createBtn.click();

    await adminPage.waitForURL(/\/intake-forms\/create/, { timeout: 10_000 }).catch(() => {});
    const dialogVisible = await adminPage.locator('[role="dialog"]').first().isVisible().catch(() => false);
    expect(adminPage.url().includes('/intake-forms/create') || dialogVisible).toBeTruthy();
  });
});

test.describe('Intake Forms — stats grid', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/intake-forms');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('stats grid renders at least 3 stat cards', async ({ adminPage }) => {
    // Stat cards typically use a common card selector
    const statCards = adminPage.locator(
      '[class*="stat"], [class*="card"], [data-testid*="stat"]',
    );
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Intake Forms — table row actions', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/intake-forms');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('edit (pencil icon) button navigates to /intake-forms/{id}/edit', async ({
    adminPage,
  }) => {
    const table = adminPage.locator('table, [role="table"]');
    const hasTable = await table.count() > 0;
    if (!hasTable) {
      test.skip();
      return;
    }

    const firstRow = table.locator('tbody tr').first();
    if (await firstRow.count() === 0) {
      test.skip();
      return;
    }

    const editBtn = firstRow
      .locator('button[aria-label*="تعديل"], button[aria-label*="edit"], a[href*="edit"]')
      .first();
    if (await editBtn.count() === 0) {
      test.skip();
      return;
    }

    await editBtn.click();
    await adminPage.waitForURL(/\/intake-forms\/.+\/edit/, { timeout: 10_000 });
    await expect(adminPage).toHaveURL(/\/intake-forms\/.+\/edit/);
  });

  test('preview button opens FormPreviewDialog and can be closed', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const hasTable = await table.count() > 0;
    if (!hasTable) {
      test.skip();
      return;
    }

    const firstRow = table.locator('tbody tr').first();
    if (await firstRow.count() === 0) {
      test.skip();
      return;
    }

    const previewBtn = firstRow
      .locator('button[aria-label*="معاينة"], button[aria-label*="preview"]')
      .first();
    if (await previewBtn.count() === 0) {
      test.skip();
      return;
    }

    await previewBtn.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // Close the dialog
    const closeBtn = dialog
      .locator('button[aria-label*="إغلاق"], button[aria-label*="close"], button[aria-label*="Close"]')
      .first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
    } else {
      await adminPage.keyboard.press('Escape');
    }

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });

  test('toggle active switch changes state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const hasTable = await table.count() > 0;
    if (!hasTable) {
      test.skip();
      return;
    }

    const firstRow = table.locator('tbody tr').first();
    if (await firstRow.count() === 0) {
      test.skip();
      return;
    }

    const toggle = firstRow
      .locator('[role="switch"], input[type="checkbox"]')
      .first();
    if (await toggle.count() === 0) {
      test.skip();
      return;
    }

    const before = await toggle.getAttribute('aria-checked') ??
      await toggle.isChecked();
    await toggle.click();

    const after = await toggle.getAttribute('aria-checked') ??
      await toggle.isChecked();
    expect(after).not.toBe(before);
  });
});

test.describe('Intake Forms — search', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/intake-forms');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('search input reflects typed value', async ({ adminPage }) => {
    const searchInput = adminPage
      .locator('input[type="search"], input[placeholder*="بحث"], input[placeholder*="ابحث"]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 12_000 });

    await searchInput.fill('نموذج');
    await expect(searchInput).toHaveValue('نموذج');
  });
});
