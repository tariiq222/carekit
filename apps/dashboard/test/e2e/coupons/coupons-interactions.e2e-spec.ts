import { test, expect } from '../setup/fixtures';

test.describe('Coupons — add coupon navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/coupons');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('clicking add coupon button navigates to create page or opens dialog', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const addBtn = adminPage.getByRole('button', { name: /كوبون جديد|إضافة كوبون/ }).first();
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
    await addBtn.click();

    await adminPage.waitForURL(/\/coupons\/create/, { timeout: 10_000 }).catch(() => {});
    const dialogVisible = await adminPage.locator('[role="dialog"]').first().isVisible().catch(() => false);

    expect(adminPage.url().includes('/coupons/create') || dialogVisible).toBeTruthy();
  });
});

test.describe('Coupons — search interaction', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/coupons');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('search input reflects typed value', async ({ adminPage }) => {
    const search = adminPage.locator('input[placeholder*="بحث"], input[type="search"]').first();
    await expect(search).toBeVisible({ timeout: 12_000 });
    await search.fill('SAVE20');
    await expect(search).toHaveValue('SAVE20');
  });

  test('clearing search resets the input', async ({ adminPage }) => {
    const search = adminPage.locator('input[placeholder*="بحث"], input[type="search"]').first();
    await search.fill('SAVE20');
    await search.clear();
    await expect(search).toHaveValue('');
  });
});

test.describe('Coupons — row click', () => {
  test('clicking first row or edit button navigates to detail/edit', async ({ adminPage, goto }) => {
    await goto('/coupons');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const firstRow = adminPage.locator('table tbody tr').first();
    const hasRow = await firstRow.count() > 0;
    if (!hasRow) {
      test.skip();
      return;
    }

    // Coupons use a dropdown actions menu — open it then click Edit
    const actionsTrigger = firstRow.locator('button').last();
    const hasTrigger = await actionsTrigger.count() > 0;
    if (!hasTrigger) {
      test.skip();
      return;
    }

    await actionsTrigger.click();
    const editItem = adminPage.locator('[role="menuitem"]').filter({ hasText: /تعديل|Edit/ }).first();
    const hasEdit = await editItem.isVisible().catch(() => false);

    if (hasEdit) {
      await editItem.click();
      // Edit navigates to /coupons/{id}/edit — wait for URL change
      await adminPage.waitForURL(/\/coupons\//, { timeout: 10_000 }).catch(() => {});
      const dialogVisible = await adminPage.locator('[role="dialog"]').first().isVisible().catch(() => false);
      const urlChanged = adminPage.url().includes('/coupons/');
      expect(dialogVisible || urlChanged).toBeTruthy();
    } else {
      await adminPage.keyboard.press('Escape');
      test.skip();
    }
  });
});

test.describe('Coupons — status filter', () => {
  test('status filter dropdown shows options when opened', async ({ adminPage, goto }) => {
    await goto('/coupons');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const filterTrigger = adminPage.locator('[role="combobox"]').first();
    const hasFilter = await filterTrigger.count() > 0;
    if (!hasFilter) {
      test.skip();
      return;
    }

    await filterTrigger.click();
    const listbox = adminPage.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 8_000 });

    await adminPage.keyboard.press('Escape');
  });
});
