/**
 * CareKit Dashboard — Intake Forms Page E2E Tests
 */

import { test, expect } from '../setup/fixtures';

test.describe('Intake Forms page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/intake-forms');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/intake-forms/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('نماذج الاستيعاب').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows create form button', async ({ adminPage }) => {
    await expect(adminPage.getByText('إنشاء نموذج').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows search input', async ({ adminPage }) => {
    const searchInput = adminPage.locator('input[placeholder*="بحث"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders forms list or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const cards = adminPage.locator('[class*="card"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد/);
    const hasContent = (await table.count() > 0) || (await cards.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
