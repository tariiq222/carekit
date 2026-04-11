/**
 * CareKit Dashboard — Clients Page Interaction Tests
 *
 * Verifies UI interactions on /clients:
 *   - "إضافة مريض" navigates to /clients/create
 *   - Create form renders input fields and back button works
 *   - Search input reflects typed value
 *   - Row click opens client detail sheet
 */

import { test, expect } from '../setup/fixtures';

test.describe('Clients — add client navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/clients');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('clicking "إضافة مريض" navigates to /clients/create', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const addBtn = adminPage.getByRole('button', { name: /إضافة مريض/ });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();

    await adminPage.waitForURL(/\/clients\/create/, { timeout: 10_000 }).catch(() => {});
    const dialogVisible = await adminPage.locator('[role="dialog"]').first().isVisible().catch(() => false);
    expect(adminPage.url().includes('/clients/create') || dialogVisible).toBeTruthy();
  });
});

test.describe('Clients — create form', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/clients/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('create form renders input fields', async ({ adminPage }) => {
    // At least one input must be present on the form
    const inputs = adminPage.locator('form input');
    await expect(inputs.first()).toBeVisible({ timeout: 8_000 });
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test('form has a submit button', async ({ adminPage }) => {
    const submitBtn = adminPage.locator(
      'form button[type="submit"], form button:has-text("إضافة مريض")',
    ).first();
    await expect(submitBtn).toBeVisible();
  });

  test('cancel button navigates back to client list', async ({ adminPage }) => {
    const cancelBtn = adminPage.getByRole('button', { name: /إلغاء|Cancel/ }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 12_000 });
    await cancelBtn.click();

    await adminPage.waitForURL(/\/clients(?!\/create)/, { timeout: 10_000 });
    await expect(adminPage).toHaveURL(/\/clients/);
    await expect(adminPage).not.toHaveURL(/\/clients\/create/);
  });

  test('phone field exists and accepts input', async ({ adminPage }) => {
    // PhoneInput renders <input type="tel"> with placeholder "5XXXXXXXX" (no name attr)
    const phoneInput = adminPage
      .locator('input[type="tel"], input[name="phone"], input[placeholder*="جوال"]')
      .first();
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('501234567');
    // PhoneInput strips leading zero and the value will reflect digits only
    const val = await phoneInput.inputValue();
    expect(val.length).toBeGreaterThan(0);
  });
});

test.describe('Clients — search interaction', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/clients');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('search input reflects typed value', async ({ adminPage }) => {
    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 12_000 });

    await searchInput.fill('أحمد');
    await expect(searchInput).toHaveValue('أحمد');
  });

  test('clearing search resets the input', async ({ adminPage }) => {
    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    await searchInput.fill('أحمد');
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });
});

test.describe('Clients — row click opens detail sheet', () => {
  test('clicking a client row opens the detail sheet', async ({ adminPage, goto }) => {
    await goto('/clients');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const table = adminPage.locator('table, [role="table"]');
    const emptyTitle = adminPage.locator('[class*="empty"], h3').filter({ hasText: /لا يوجد/ });

    const hasTable = await table.count() > 0;
    const hasEmpty = await emptyTitle.count() > 0;

    if (!hasTable || hasEmpty) {
      test.skip();
      return;
    }

    const firstRow = table.locator('tbody tr').first();
    if (await firstRow.count() === 0) {
      test.skip();
      return;
    }

    // Clients table uses a <button> in the first cell to trigger the detail sheet
    const rowBtn = firstRow.locator('button').first();
    if (await rowBtn.count() === 0) {
      // Fall back to clicking the row itself
      await firstRow.click();
    } else {
      await rowBtn.click();
    }

    // Expect a sheet/dialog to open
    const sheet = adminPage.locator('[role="dialog"]').first();
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
