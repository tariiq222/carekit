/**
 * CareKit Dashboard — Services Page Interaction Tests
 *
 * Verifies UI interactions on /services:
 *   - "الخدمات" tab is active by default
 *   - "الفئات" tab click changes visible content
 *   - "إضافة خدمة" navigates to /services/create
 *   - On categories tab: "إضافة فئة" opens CreateCategoryDialog
 *   - Dialog close button works
 *   - Search per-tab reflects typed value
 */

import { test, expect } from '../setup/fixtures';

test.describe('Services — default tab state', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('"الخدمات" tab is active by default', async ({ adminPage }) => {
    const servicesTab = adminPage.getByRole('tab', { name: /الخدمات/ }).first();
    await expect(servicesTab).toBeVisible({ timeout: 12_000 });
    await expect(servicesTab).toHaveAttribute('data-state', 'active');
  });

  test('"الفئات" tab exists', async ({ adminPage }) => {
    const categoriesTab = adminPage.getByRole('tab', { name: /الفئات/ });
    await expect(categoriesTab).toBeVisible({ timeout: 12_000 });
  });
});

test.describe('Services — tab switching', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('clicking "الفئات" tab activates it and changes content', async ({ adminPage }) => {
    const categoriesTab = adminPage.getByRole('tab', { name: /الفئات/ });
    await expect(categoriesTab).toBeVisible({ timeout: 12_000 });
    await categoriesTab.click();

    await expect(categoriesTab).toHaveAttribute('data-state', 'active');

    // The services tab should no longer be active
    const servicesTab = adminPage.getByRole('tab', { name: /الخدمات/ }).first();
    await expect(servicesTab).toHaveAttribute('data-state', 'inactive');
  });

  test('switching back to "الخدمات" tab works', async ({ adminPage }) => {
    // Switch to categories
    await adminPage.getByRole('tab', { name: /الفئات/ }).click();
    // Switch back to services
    const servicesTab = adminPage.getByRole('tab', { name: /الخدمات/ }).first();
    await servicesTab.click();
    await expect(servicesTab).toHaveAttribute('data-state', 'active');
  });
});

test.describe('Services — add service navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('"إضافة خدمة" button navigates to /services/create when on services tab', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    // Ensure we are on services tab
    const servicesTab = adminPage.getByRole('tab', { name: /الخدمات/ }).first();
    await servicesTab.click();

    const addBtn = adminPage.getByRole('button', { name: /إضافة خدمة/ });
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
    await addBtn.click();

    await adminPage.waitForURL(/\/services\/create/, { timeout: 10_000 }).catch(() => {});
    await expect(adminPage).toHaveURL(/\/services\/create/);
  });
});

test.describe('Services — categories tab: add category dialog', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // Switch to categories tab
    await adminPage.getByRole('tab', { name: /الفئات/ }).click();
    await adminPage.waitForTimeout(300); // allow tab content to render
  });

  test('"إضافة فئة" button opens CreateCategoryDialog', async ({ adminPage }) => {
    const addCategoryBtn = adminPage.getByRole('button', { name: /إضافة فئة/ });
    await expect(addCategoryBtn).toBeVisible({ timeout: 12_000 });
    await addCategoryBtn.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });
  });

  test('category dialog close button dismisses dialog', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /إضافة فئة/ }).click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    const closeBtn = dialog
      .locator('button[aria-label*="إغلاق"], button[aria-label*="close"], button[aria-label*="Close"]')
      .first();

    const cancelBtn = dialog.getByRole('button', { name: /إلغاء|Cancel/ }).first();

    const hasClose = await closeBtn.count() > 0;
    if (hasClose) {
      await closeBtn.click();
    } else {
      await cancelBtn.click();
    }

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });

  test('pressing Escape closes category dialog', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /إضافة فئة/ }).click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    await adminPage.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Services — search per tab', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('search input on services tab reflects typed value', async ({ adminPage }) => {
    const servicesTab = adminPage.getByRole('tab', { name: /الخدمات/ }).first();
    await servicesTab.click();

    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 12_000 });

    await searchInput.fill('تنظيف');
    await expect(searchInput).toHaveValue('تنظيف');
  });

  test('search input on categories tab reflects typed value', async ({ adminPage }) => {
    await adminPage.getByRole('tab', { name: /الفئات/ }).click();
    await adminPage.waitForTimeout(300);

    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 12_000 });

    await searchInput.fill('عام');
    await expect(searchInput).toHaveValue('عام');
  });

  test('search input clears correctly', async ({ adminPage }) => {
    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    await searchInput.fill('test');
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });
});
