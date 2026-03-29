import { test, expect } from '../setup/fixtures';

test.describe('Gift Cards — add navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/gift-cards');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('clicking add button navigates to /gift-cards/create or opens dialog', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const addBtn = adminPage
      .getByRole('button', { name: /بطاقة هدية جديدة|إضافة بطاقة هدية/ })
      .first();
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
    await addBtn.click();

    await adminPage.waitForURL(/\/gift-cards\/create/, { timeout: 10_000 }).catch(() => {});
    const dialogVisible = await adminPage.locator('[role="dialog"]').first().isVisible().catch(() => false);

    expect(adminPage.url().includes('/gift-cards/create') || dialogVisible).toBeTruthy();
  });
});

test.describe('Gift Cards — search interaction', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/gift-cards');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('search input reflects typed value', async ({ adminPage }) => {
    const search = adminPage.locator('input[placeholder*="بحث"], input[type="search"]').first();
    await expect(search).toBeVisible({ timeout: 12_000 });
    await search.fill('هدية');
    await expect(search).toHaveValue('هدية');
  });

  test('clearing search resets the input', async ({ adminPage }) => {
    const search = adminPage.locator('input[placeholder*="بحث"], input[type="search"]').first();
    await search.fill('هدية');
    await search.clear();
    await expect(search).toHaveValue('');
  });
});

test.describe('Gift Cards — create form', () => {
  test('create page renders form inputs', async ({ adminPage, goto }) => {
    await goto('/gift-cards/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const inputs = adminPage.locator('form input, input[name]');
    await expect(inputs.first()).toBeVisible({ timeout: 8_000 });
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test('create page has a submit button', async ({ adminPage, goto }) => {
    await goto('/gift-cards/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const submitBtn = adminPage
      .locator('form button[type="submit"]')
      .or(adminPage.getByRole('button', { name: /إنشاء|حفظ|إضافة/ }))
      .first();
    await expect(submitBtn).toBeVisible();
  });
});
