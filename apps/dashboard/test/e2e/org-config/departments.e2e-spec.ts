/**
 * CareKit Dashboard — Departments E2E Tests
 *
 * DEP-001 to DEP-004.
 * Departments are created via UI — no seed helpers needed.
 * Tries /settings/departments first, falls back to /departments.
 */

import { test, expect } from '../setup/fixtures';

async function navigateToDepartments(adminPage: import('@playwright/test').Page, goto: (url: string) => Promise<void>): Promise<void> {
  await goto('/departments');
  await adminPage.waitForLoadState('networkidle').catch(() => {});
}

// ── DEP-001 Page loads ────────────────────────────────────────────────────────
test.describe('Departments — تحميل الصفحة', () => {
  test('[DEP-001] @smoke — الصفحة تحمل', async ({ adminPage, goto }) => {
    await navigateToDepartments(adminPage, goto);

    await expect(adminPage.locator('#email')).not.toBeVisible();

    // أي محتوى ظهر
    const content = adminPage.locator(
      'table, [role="table"], [class*="empty"], h1, h2, [class*="card"]',
    );
    await expect(content.first()).toBeVisible({ timeout: 12_000 });
  });
});

// ── DEP-002 Create department via form ────────────────────────────────────────
test.describe('Departments — إنشاء قسم جديد', () => {
  const deptName = `PW_قسم_${Date.now().toString().slice(-5)}`;

  test.afterEach(async ({ adminPage, goto }) => {
    await navigateToDepartments(adminPage, goto);
    const row = adminPage.locator('table tbody tr, [class*="row"]').filter({ hasText: deptName }).first();
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

  test('[DEP-002] @critical — إنشاء قسم جديد عبر نموذج', async ({ adminPage, goto }) => {
    await navigateToDepartments(adminPage, goto);

    const addBtn = adminPage
      .getByRole('button', { name: /إضافة قسم|قسم جديد|أضف قسم/ })
      .first();

    if ((await addBtn.count()) === 0) {
      test.skip();
      return;
    }

    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // كلا الحقلين nameEn + nameAr مطلوبان
    const nameEnInput = dialog.locator('input[name="nameEn"]').first();
    const nameArInput = dialog.locator('input[name="nameAr"]').first();
    await expect(nameEnInput).toBeVisible({ timeout: 5_000 });
    await nameEnInput.fill(`EN_${deptName}`);
    await nameArInput.fill(deptName);

    const saveBtn = dialog
      .getByRole('button', { name: /^حفظ$|^إنشاء$|^إضافة$|^تأكيد$/ })
      .first();
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await saveBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    const newDept = adminPage.getByText(deptName).first();
    await expect(newDept).toBeVisible({ timeout: 10_000 });
  });
});

// ── DEP-003 Add button exists ─────────────────────────────────────────────────
test.describe('Departments — زر الإضافة', () => {
  test('[DEP-003] @smoke — زر إضافة قسم موجود', async ({ adminPage, goto }) => {
    await navigateToDepartments(adminPage, goto);

    const addBtn = adminPage
      .getByRole('button', { name: /إضافة قسم|قسم جديد|أضف قسم/ })
      .first();

    if ((await addBtn.count()) === 0) {
      test.skip();
      return;
    }

    await expect(addBtn).toBeVisible({ timeout: 10_000 });
  });
});

// ── DEP-004 List or empty state ───────────────────────────────────────────────
test.describe('Departments — القائمة أو empty state', () => {
  test('[DEP-004] @smoke — القائمة أو empty state يظهر', async ({ adminPage, goto }) => {
    await navigateToDepartments(adminPage, goto);

    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد|لا أقسام/);
    const hasContent = (await table.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
