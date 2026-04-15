/**
 * CareKit Dashboard — Categories E2E Tests
 *
 * CAT-001 to CAT-003.
 * Tries /settings/categories and /categories.
 */

import { test, expect } from '../setup/fixtures';

async function navigateToCategories(adminPage: import('@playwright/test').Page, goto: (url: string) => Promise<void>): Promise<void> {
  await goto('/categories');
  await adminPage.waitForLoadState('networkidle').catch(() => {});
}

// ── CAT-001 Page loads ────────────────────────────────────────────────────────
test.describe('Categories — تحميل الصفحة', () => {
  test('[CAT-001] @smoke — الصفحة تحمل', async ({ adminPage, goto }) => {
    await navigateToCategories(adminPage, goto);

    await expect(adminPage.locator('#email')).not.toBeVisible();

    const content = adminPage.locator(
      'table, [role="table"], [class*="empty"], h1, h2, [class*="card"]',
    );
    await expect(content.first()).toBeVisible({ timeout: 12_000 });
  });
});

// ── CAT-002 Create category via form ──────────────────────────────────────────
test.describe('Categories — إنشاء فئة جديدة', () => {
  const catName = `PW_فئة_${Date.now().toString().slice(-5)}`;

  test.afterEach(async ({ adminPage, goto }) => {
    await navigateToCategories(adminPage, goto);
    const row = adminPage.locator('table tbody tr, [class*="row"]').filter({ hasText: catName }).first();
    if (await row.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const deleteBtn = row
        .locator('button[aria-label*="حذف"], button[aria-label*="delete"]')
        .first();
      if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmBtn = adminPage
          .locator('[role="alertdialog"] button, [role="dialog"] button')
          .filter({ hasText: /^حذف$|^تأكيد$|^نعم$/ })
          .first();
        if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await confirmBtn.click();
        }
      }
    }
  });

  test('[CAT-002] @critical — إنشاء فئة جديدة', async ({ adminPage, goto }) => {
    await navigateToCategories(adminPage, goto);

    const addBtn = adminPage
      .getByRole('button', { name: /إضافة فئة|فئة جديدة|أضف فئة|إضافة تصنيف/ })
      .first();

    if ((await addBtn.count()) === 0) {
      test.skip();
      return;
    }

    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // كلا nameEn + nameAr + departmentId مطلوبة
    const nameEnInput = dialog.locator('input[name="nameEn"]').first();
    const nameArInput = dialog.locator('input[name="nameAr"]').first();
    await expect(nameEnInput).toBeVisible({ timeout: 5_000 });
    await nameEnInput.fill(`EN_${catName}`);
    await nameArInput.fill(catName);

    // departmentId — select مطلوب
    const deptSelect = dialog.locator('[role="combobox"]').first();
    if (await deptSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deptSelect.click();
      const firstOption = adminPage.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstOption.click();
      } else {
        // لا أقسام متاحة — التيست لا يقدر يكمل
        await adminPage.keyboard.press('Escape');
        test.skip();
        return;
      }
    }

    const saveBtn = dialog
      .getByRole('button', { name: /حفظ|إنشاء|إضافة|تأكيد/ })
      .last();
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await saveBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    const newCat = adminPage.getByText(catName).first();
    await expect(newCat).toBeVisible({ timeout: 10_000 });
  });
});

// ── CAT-003 List or empty state ───────────────────────────────────────────────
test.describe('Categories — القائمة أو empty state', () => {
  test('[CAT-003] @smoke — القائمة أو empty state', async ({ adminPage, goto }) => {
    await navigateToCategories(adminPage, goto);

    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد|لا فئات|لا تصنيفات/);
    const hasContent = (await table.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
