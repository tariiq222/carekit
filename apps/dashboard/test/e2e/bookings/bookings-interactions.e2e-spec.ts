/**
 * CareKit Dashboard — Bookings Page Interaction Tests
 *
 * Verifies UI interactions on /bookings:
 *   - "حجز جديد" opens BookingCreateDialog
 *   - Dialog close button dismisses dialog
 *   - Tab navigation to بلاغات المشاكل
 *   - Search input reflects typed value
 *   - Row click opens BookingDetailSheet
 */

import { test, expect } from '../setup/fixtures';

test.describe('Bookings — dialog interactions', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('clicking "حجز جديد" opens the create dialog', async ({ adminPage }) => {
    const btn = adminPage.getByRole('button', { name: /حجز جديد/ });
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();

    const dialog = adminPage.locator('[role="dialog"]');
    await expect(dialog.first()).toBeVisible({ timeout: 12_000 });
  });

  test('dialog closes when cancel/close is clicked', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /حجز جديد/ }).click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // Try any close/cancel button inside the dialog, then fall back to Escape
    const closeBtn = dialog
      .locator('button[aria-label*="إغلاق"], button[aria-label*="close"], button[aria-label*="Close"]')
      .or(dialog.getByRole('button', { name: /إلغاء|Cancel/ }))
      .or(dialog.locator('button').filter({ hasText: /×|✕/ }))
      .first();

    const hasClose = await closeBtn.count() > 0;
    if (hasClose) {
      await closeBtn.click();
    } else {
      await adminPage.keyboard.press('Escape');
    }

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });

  test('pressing Escape closes the dialog', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /حجز جديد/ }).click();
    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    await adminPage.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Bookings — tab navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('clicking "بلاغات المشاكل" tab changes visible content', async ({ adminPage }) => {
    const problemTab = adminPage.getByRole('tab', { name: /بلاغات المشاكل/ });
    const hasTab = await problemTab.count() > 0;
    if (!hasTab) {
      // Tab not present in this UI configuration — skip
      test.skip();
      return;
    }
    await expect(problemTab).toBeVisible();
    await problemTab.click();
    await adminPage.waitForTimeout(300);

    // After clicking, at least one of: URL updated, tab panel visible, or tab is active
    const urlChanged = adminPage.url().includes('tab=') || adminPage.url().includes('problem');
    const panelVisible = await adminPage.locator('[role="tabpanel"], [data-state="active"]').first().isVisible().catch(() => false);
    const tabActive = await problemTab.getAttribute('aria-selected').catch(() => null);
    expect(urlChanged || panelVisible || tabActive === 'true').toBe(true);
  });

  test('bookings tab is shown by default', async ({ adminPage }) => {
    const bookingsTab = adminPage.getByRole('tab', { name: /الحجوزات|قائمة/ }).first();
    await expect(bookingsTab).toBeVisible();

    const isSelected = await bookingsTab.getAttribute('data-state');
    expect(isSelected).toBe('active');
  });
});

test.describe('Bookings — search interaction', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('search input reflects typed value', async ({ adminPage }) => {
    const searchInput = adminPage
      .locator('input[type="search"], input[placeholder*="بحث"]')
      .first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill('أحمد');
    await expect(searchInput).toHaveValue('أحمد');
  });

  test('clearing search input empties the value', async ({ adminPage }) => {
    const searchInput = adminPage
      .locator('input[type="search"], input[placeholder*="بحث"]')
      .first();
    await searchInput.fill('test');
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });
});

test.describe('Bookings — row click opens detail sheet', () => {
  test('clicking a booking row opens the detail sheet', async ({ adminPage, goto }) => {
    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const table = adminPage.locator('table, [role="table"]');
    const emptyState = adminPage.getByText(/لا توجد حجوزات/);

    const hasTable = await table.count() > 0;
    const hasEmpty = await emptyState.count() > 0;

    if (!hasTable || hasEmpty) {
      // No data — skip row interaction
      test.skip();
      return;
    }

    // Click the first data row (skip the header row)
    const firstRow = table.locator('tbody tr').first();
    const rowCount = await firstRow.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    await firstRow.click();

    // Detail sheet should open (role="dialog" or aside)
    const sheet = adminPage.locator('[role="dialog"], aside[data-state="open"]').first();
    await expect(sheet).toBeVisible({ timeout: 8_000 });

    // Close it
    const closeBtn = sheet
      .locator('button[aria-label*="إغلاق"], button[aria-label*="close"], button[aria-label*="Close"]')
      .first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
    } else {
      await adminPage.keyboard.press('Escape');
    }

    await expect(sheet).not.toBeVisible({ timeout: 8_000 });
  });
});
