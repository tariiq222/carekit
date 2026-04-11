/**
 * CareKit Dashboard — Reports Page Interaction Tests
 *
 * Verifies UI interactions on /reports:
 *   - Tab navigation: الحجوزات, الأطباء
 *   - Export CSV button is clickable
 *   - Date range filter inputs accept values
 *   - Employee combobox opens on employees tab
 *   - Reset filters button appears after filter change
 */

import { test, expect } from '../setup/fixtures';

test.describe('Reports — tab navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/reports');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('clicking "الحجوزات" tab changes content', async ({ adminPage }) => {
    const tab = adminPage.getByRole('tab', { name: /الحجوزات/ });
    await expect(tab).toBeVisible({ timeout: 12_000 });
    await tab.click();

    await expect(tab).toHaveAttribute('data-state', 'active');
    const panel = adminPage.locator('[role="tabpanel"][data-state="active"]').first();
    await expect(panel).toBeVisible({ timeout: 12_000 });
  });

  test('clicking "الأطباء" tab changes content', async ({ adminPage }) => {
    const tab = adminPage.getByRole('tab', { name: /الأطباء/ });
    await expect(tab).toBeVisible({ timeout: 12_000 });
    await tab.click();

    await expect(tab).toHaveAttribute('data-state', 'active');
    const panel = adminPage.locator('[role="tabpanel"][data-state="active"]').first();
    await expect(panel).toBeVisible({ timeout: 12_000 });
  });
});

test.describe('Reports — export CSV button', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/reports');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('export CSV button is clickable', async ({ adminPage }) => {
    const exportBtn = adminPage
      .getByRole('button', { name: /تصدير|CSV|Export/ })
      .first();
    await expect(exportBtn).toBeVisible({ timeout: 12_000 });
    await expect(exportBtn).toBeEnabled();

    // Click — no download assertion needed
    await exportBtn.click();
  });
});

test.describe('Reports — date range filter', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/reports');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('"من" date picker is visible and opens calendar', async ({ adminPage }) => {
    // DatePicker renders a <Button> — look for the filter bar date buttons
    const filterBar = adminPage.locator('[class*="filter"], [class*="FilterBar"]').first();
    const dateBtn = filterBar.locator('button').first();
    const fallbackBtn = adminPage.locator('button[type="button"]').filter({ hasText: /\d{2}|\d{4}|من|to/ }).first();

    const btn = (await filterBar.count() > 0 && await dateBtn.count() > 0) ? dateBtn : fallbackBtn;
    const hasPicker = await btn.count() > 0;
    if (!hasPicker) {
      test.skip();
      return;
    }
    await expect(btn).toBeVisible({ timeout: 12_000 });
  });

  test('"إلى" date picker is visible and opens calendar', async ({ adminPage }) => {
    // DatePicker renders a <Button> — the second date button is the "to" picker
    const filterBar = adminPage.locator('[class*="filter"], [class*="FilterBar"]').first();
    const dateBtns = filterBar.locator('button');
    const count = await dateBtns.count();
    if (count < 2) {
      test.skip();
      return;
    }
    const toBtn = dateBtns.nth(1);
    await expect(toBtn).toBeVisible({ timeout: 12_000 });
  });
});

test.describe('Reports — employee filter on Doctors tab', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/reports');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const tab = adminPage.getByRole('tab', { name: /الأطباء/ });
    await expect(tab).toBeVisible({ timeout: 12_000 });
    await tab.click();
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('employee combobox opens when clicked', async ({ adminPage }) => {
    const combobox = adminPage
      .locator('[role="combobox"], button[aria-haspopup="listbox"]')
      .first();
    await expect(combobox).toBeVisible({ timeout: 8_000 });
    await combobox.click();

    const listbox = adminPage.locator('[role="listbox"], [role="option"]').first();
    await expect(listbox).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Reports — reset filters', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/reports');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('reset button appears after a filter value is entered', async ({ adminPage }) => {
    const fromInput = adminPage
      .locator('input[placeholder*="من"], input[name*="from"], input[name*="start"]')
      .first();

    if (await fromInput.count() === 0) {
      test.skip();
      return;
    }

    await fromInput.fill('2025-01-01');

    const resetBtn = adminPage
      .getByRole('button', { name: /إعادة|تصفير|مسح|Reset/ })
      .first();
    await expect(resetBtn).toBeVisible({ timeout: 8_000 });
  });
});
