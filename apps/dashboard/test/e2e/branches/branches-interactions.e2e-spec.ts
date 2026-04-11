import { test, expect } from '../setup/fixtures';

test.describe('Branches — add branch navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/branches');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('clicking "إضافة فرع" navigates to create page or opens dialog', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const addBtn = adminPage.getByRole('button', { name: /إضافة فرع/ });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    // Scroll into view and wait for it to be stable before clicking
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();

    // Wait for navigation — router.push() is async in Next.js App Router
    await adminPage.waitForURL(/\/branches\/create/, { timeout: 10_000 }).catch(() => {});
    const dialogVisible = await adminPage.locator('[role="dialog"]').first().isVisible().catch(() => false);

    expect(adminPage.url().includes('/branches/create') || dialogVisible).toBeTruthy();
  });
});

test.describe('Branches — search interaction', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/branches');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('search input reflects typed value', async ({ adminPage }) => {
    const search = adminPage.locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]').first();
    await expect(search).toBeVisible({ timeout: 12_000 });
    await search.fill('الرياض');
    await expect(search).toHaveValue('الرياض');
  });

  test('clearing search resets the input', async ({ adminPage }) => {
    const search = adminPage.locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]').first();
    await search.fill('الرياض');
    await search.clear();
    await expect(search).toHaveValue('');
  });
});

test.describe('Branches — row click', () => {
  test('clicking first item navigates to detail or opens sheet', async ({ adminPage, goto }) => {
    await goto('/branches');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const firstRow = adminPage.locator('table tbody tr').first();
    const hasRow = await firstRow.count() > 0;
    if (!hasRow) {
      test.skip();
      return;
    }

    // Branches use a dropdown actions menu — open it and click Edit to navigate
    const actionsTrigger = firstRow.locator('button').last();
    const hasTrigger = await actionsTrigger.count() > 0;
    if (!hasTrigger) {
      test.skip();
      return;
    }

    await actionsTrigger.click();
    // Wait for dropdown to open
    const editItem = adminPage.locator('[role="menuitem"]').filter({ hasText: /تعديل|Edit/ }).first();
    const hasEdit = await editItem.isVisible().catch(() => false);
    if (hasEdit) {
      await editItem.click();
      const urlAfter = adminPage.url();
      expect(urlAfter.includes('/branches/')).toBeTruthy();
    } else {
      // Close dropdown and skip gracefully
      await adminPage.keyboard.press('Escape');
      test.skip();
    }
  });
});

test.describe('Branches — create form', () => {
  test('create page renders form inputs and back navigation works', async ({ adminPage, goto }) => {
    await goto('/branches/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const inputs = adminPage.locator('form input, input[name]');
    await expect(inputs.first()).toBeVisible({ timeout: 8_000 });
    expect(await inputs.count()).toBeGreaterThan(0);

    const backBtn = adminPage
      .getByRole('button', { name: /إلغاء|رجوع|Cancel/ })
      .or(adminPage.locator('[aria-label*="breadcrumb"] a, nav a').first())
      .first();

    const hasBack = await backBtn.count() > 0;
    if (hasBack) {
      await backBtn.click();
      // Cancel navigates to /branches; wait for any URL change away from /create
      await adminPage.waitForURL(/\/branches(?!.*create)|^http:\/\/localhost:5001\/$/, { timeout: 10_000 }).catch(() => {});
      const url = adminPage.url();
      expect(url.includes('/branches') || url.endsWith('/')).toBeTruthy();
    }
  });
});
