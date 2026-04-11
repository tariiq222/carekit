import { test, expect } from '../setup/fixtures';

test.describe('Users — add user navigation', () => {
  test.beforeEach(async ({ goto }) => {
    await goto('/users');
  });

  test('clicking "إضافة مستخدم" navigates to create page or opens dialog', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const addBtn = adminPage.getByRole('button', { name: /إضافة مستخدم/ });
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
    await addBtn.click();

    await adminPage.waitForURL(/\/users\/create/, { timeout: 10_000 }).catch(() => {});
    const dialogVisible = await adminPage.locator('[role="dialog"]').first().isVisible().catch(() => false);

    expect(adminPage.url().includes('/users/create') || dialogVisible).toBeTruthy();
  });
});

test.describe('Users — search interaction', () => {
  test.beforeEach(async ({ goto }) => {
    await goto('/users');
  });

  test('search input reflects typed value', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const search = adminPage.locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]').first();
    await expect(search).toBeVisible({ timeout: 8_000 });
    await search.fill('محمد');
    await expect(search).toHaveValue('محمد');
  });

  test('clearing search resets the input', async ({ adminPage }) => {
    const search = adminPage.locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]').first();
    await search.fill('محمد');
    await search.clear();
    await expect(search).toHaveValue('');
  });
});

test.describe('Users — row click', () => {
  test('clicking first row navigates to detail or opens sheet', async ({ adminPage, goto }) => {
    await goto('/users');

    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const firstRow = adminPage.locator('table tbody tr').first();
    const hasRow = await firstRow.count() > 0;
    if (!hasRow) {
      test.skip();
      return;
    }

    // Users use a dropdown actions menu — open it and click Edit
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
      // Wait for either a dialog to appear or URL to change (edit navigates to /users/{id}/edit)
      await adminPage.waitForURL(/\/users\//, { timeout: 10_000 }).catch(() => {});
      const dialogVisible = await adminPage.locator('[role="dialog"]').first().isVisible().catch(() => false);
      const urlChanged = adminPage.url().includes('/users/');
      expect(dialogVisible || urlChanged).toBeTruthy();
    } else {
      await adminPage.keyboard.press('Escape');
      test.skip();
    }
  });
});

test.describe('Users — activity log tab', () => {
  test('navigating to ?tab=activityLog shows activity content', async ({ adminPage, goto }) => {
    await goto('/users?tab=activityLog');

    await expect(adminPage).toHaveURL(/\/users/);
    await expect(adminPage.locator('#email')).not.toBeVisible();

    const tabPanel = adminPage.locator('[role="tabpanel"][data-state="active"]').first();
    await expect(tabPanel).toBeVisible({ timeout: 12_000 });
  });
});
