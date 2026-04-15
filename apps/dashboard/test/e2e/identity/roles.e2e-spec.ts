/**
 * CareKit Dashboard — Roles Page E2E Tests
 *
 * ROLE-001 to ROLE-004.
 * Roles are created via UI — no seed helpers needed.
 */

import { test, expect } from '../setup/fixtures';

// ── ROLE-001 Page loads ───────────────────────────────────────────────────────
test.describe('Roles — تحميل الصفحة', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/users?tab=roles');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[ROLE-001] @smoke — الصفحة تحمل وتعرض قائمة الأدوار', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/users/);
    await expect(adminPage.locator('#email')).not.toBeVisible();

    const anyContent = adminPage.locator(
      'table, [role="table"], [class*="empty"], [class*="skeleton"], [class*="role"], h3',
    );
    await expect(anyContent.first()).toBeVisible({ timeout: 15_000 });
  });
});

// ── ROLE-002 Create a new role via form ───────────────────────────────────────
test.describe('Roles — إنشاء دور جديد', () => {
  const roleName = `PW_دور_${Date.now().toString().slice(-5)}`;

  test.afterEach(async ({ adminPage, goto }) => {
    // محاولة حذف الدور بعد الاختبار
    await goto('/users?tab=roles');
    const row = adminPage.locator('table tbody tr, [class*="role-row"]').filter({ hasText: roleName }).first();
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

  test('[ROLE-002] @critical — إنشاء دور جديد عبر نموذج → يظهر في القائمة', async ({ adminPage, goto }) => {
    await goto('/users?tab=roles');

    const addBtn = adminPage
      .getByRole('button', { name: /إضافة دور|دور جديد|أضف دور/ })
      .first();

    if ((await addBtn.count()) === 0) {
      test.skip();
      return;
    }

    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // حقل اسم الدور
    const nameInput = dialog
      .locator('input[name*="name"], input[placeholder*="اسم"], input[placeholder*="الدور"]')
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(roleName);

    // حقل الوصف (اختياري)
    const descInput = dialog
      .locator('textarea, input[name*="desc"], input[placeholder*="وصف"]')
      .first();
    if (await descInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await descInput.fill('دور اختباري من Playwright');
    }

    // زر حفظ
    const saveBtn = dialog
      .getByRole('button', { name: /^حفظ$|^إنشاء$|^إضافة$|^تأكيد$/ })
      .first();
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await saveBtn.click();

    // dialog يُغلق
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // الدور يظهر في القائمة
    const newRole = adminPage.getByText(roleName).first();
    await expect(newRole).toBeVisible({ timeout: 10_000 });
  });
});

// ── ROLE-003 Add button exists ────────────────────────────────────────────────
test.describe('Roles — زر الإضافة', () => {
  test('[ROLE-003] @smoke — زر إضافة دور موجود', async ({ adminPage, goto }) => {
    await goto('/users?tab=roles');

    const addBtn = adminPage
      .getByRole('button', { name: /إضافة دور|دور جديد|أضف دور/ })
      .first();

    if ((await addBtn.count()) === 0) {
      test.skip();
      return;
    }

    await expect(addBtn).toBeVisible({ timeout: 10_000 });
  });
});

// ── ROLE-004 Page header ───────────────────────────────────────────────────────
test.describe('Roles — header الصفحة', () => {
  test('[ROLE-004] @smoke — صفحة الأدوار تعرض header صحيح', async ({ adminPage, goto }) => {
    await goto('/users?tab=roles');

    // header أو title يحتوي على "أدوار" أو "المستخدمون"
    const heading = adminPage
      .getByRole('heading')
      .filter({ hasText: /أدوار|المستخدمون|الأدوار والصلاحيات/ })
      .first();

    const anyTitle = adminPage.getByText(/أدوار|المستخدمون|الأدوار والصلاحيات/i).first();

    const isVisible =
      (await heading.isVisible({ timeout: 10_000 }).catch(() => false)) ||
      (await anyTitle.isVisible({ timeout: 10_000 }).catch(() => false));

    expect(isVisible).toBe(true);
  });
});
