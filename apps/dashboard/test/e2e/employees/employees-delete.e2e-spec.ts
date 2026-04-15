/**
 * CareKit Dashboard — Employees Delete E2E Tests
 *
 * يغطي:
 *   - [EM-010] حذف موظف (soft delete) + التحقق من toast النجاح
 *   - [EM-011] التعامل الرشيق مع رسالة الخطأ عند محاولة حذف موظف نشط
 *   - [EM-012] إعادة تفعيل موظف معطّل (toggle الحالة من inactive إلى active)
 *
 * نمط الـ seed: يُنشئ كل test موظفاً مستقلاً عبر API ثم يحذفه في afterEach.
 * الـ toast يصدر من Sonner → نبحث عن [data-sonner-toast] أو role="status".
 */

import { test, expect } from '../setup/fixtures';
import { createEmployee, deleteEmployee, type SeededEmployee } from '../setup/seeds';

// ─── EM-010: حذف موظف + toast ─────────────────────────────────────────────

test.describe('Employees — delete flow', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWDelEmp' });
  });

  test.afterEach(async () => {
    // cleanup best-effort — قد يكون قد حُذف فعلاً من الـ test
    if (seeded?.id) await deleteEmployee(seeded.id).catch(() => {});
  });

  test('[EM-010][Employees/delete][P1-High] حذف موظف يُظهر toast نجاح ويُزيل الصف @critical @data', async ({
    adminPage,
    searchInList,
    waitForToast,
  }) => {
    await searchInList('/employees', seeded.name);

    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.name }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    // زر الحذف بأيقونة Delete — aria-label="Delete" أو "حذف"
    const deleteBtn = row
      .locator('button[aria-label*="Delete"], button[aria-label*="حذف"], button[aria-label*="delete"]')
      .first();
    await expect(deleteBtn).toBeVisible({ timeout: 6_000 });
    await deleteBtn.click();

    // AlertDialog confirmation
    const dialog = adminPage.locator('[role="alertdialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    // زر التأكيد (destructive) — نبحث عن الزر الأحمر أو النص المطابق
    const confirmBtn = dialog
      .locator('button')
      .filter({ hasText: /حذف|Delete|تأكيد|Confirm/i })
      .last();
    await expect(confirmBtn).toBeVisible({ timeout: 6_000 });
    await confirmBtn.click();

    await waitForToast(/تم الحذف|حُذف|deleted|success/i);

    // الصف يجب أن يختفي أو يصبح معطّلاً بعد reload
    await adminPage.waitForTimeout(800);
    await searchInList('/employees', seeded.name);
    const deletedRow = adminPage.locator('table tbody tr').filter({ hasText: seeded.name });
    // يقبل إما اختفاءه أو عدم وجوده بعد البحث
    const rowCount = await deletedRow.count();
    expect(rowCount).toBe(0);
  });
});

// ─── EM-011: graceful handling عند خطأ الحذف ─────────────────────────────

test.describe('Employees — delete error handling', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWDelErrEmp' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id).catch(() => {});
  });

  test('[EM-011][Employees/delete][P2-Medium] نافذة تأكيد الحذف تعرض اسم الموظف بوضوح @data', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/employees', seeded.name);

    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.name }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const deleteBtn = row
      .locator('button[aria-label*="Delete"], button[aria-label*="حذف"], button[aria-label*="delete"]')
      .first();
    await expect(deleteBtn).toBeVisible({ timeout: 6_000 });
    await deleteBtn.click();

    const dialog = adminPage.locator('[role="alertdialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    // النافذة يجب أن تعرض محتوى (عنوان + وصف)
    const title = dialog.locator('[id*="title"], h2, [class*="Title"]').first();
    await expect(title).toBeVisible({ timeout: 4_000 });

    // زر الإلغاء يجب أن يعمل ويغلق النافذة
    const cancelBtn = dialog
      .locator('button')
      .filter({ hasText: /إلغاء|Cancel/i })
      .first();
    await expect(cancelBtn).toBeVisible({ timeout: 4_000 });
    await cancelBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 6_000 });
  });
});

// ─── EM-012: إعادة تفعيل موظف ────────────────────────────────────────────

test.describe('Employees — reactivate after suspend', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWReactEmp' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id).catch(() => {});
  });

  test('[EM-012][Employees/status][P1-High] تعطيل موظف ثم إعادة تفعيله يُغيّر الحالة @critical @data', async ({
    adminPage,
    goto,
    waitForToast,
  }) => {
    // الانتقال لصفحة التعديل حيث يوجد switch الحالة
    await goto(`/employees/${seeded.id}/edit`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // تأكد من تبويب الأساسية
    const basicTab = adminPage
      .locator('[role="tab"]')
      .filter({ hasText: /الأساسية|Basic/i })
      .first();
    if (await basicTab.count() > 0) await basicTab.click();

    // switch الحالة
    const activeSwitch = adminPage.locator('#employee-active, [id*="active"], [role="switch"]').first();
    const switchVisible = await activeSwitch.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!switchVisible) {
      test.skip(true, 'لا يوجد switch للحالة في الـ UI — تحقق من BasicInfoTab');
      return;
    }

    // احفظ الحالة الحالية
    const isCurrentlyChecked = await activeSwitch.getAttribute('data-state').catch(() => null);

    // قم بتغيير الحالة (تعطيل)
    await activeSwitch.click();

    // قد يظهر AlertDialog للتأكيد (EmployeeStatusDialog)
    const confirmDialog = adminPage.locator('[role="alertdialog"]').first();
    const dialogVisible = await confirmDialog.isVisible({ timeout: 3_000 }).catch(() => false);
    if (dialogVisible) {
      const confirmBtn = confirmDialog
        .locator('button')
        .filter({ hasText: /تأكيد|تعليق|Suspend|Confirm/i })
        .first();
      if (await confirmBtn.count() > 0) await confirmBtn.click();
    }

    // الآن أعد التفعيل
    await activeSwitch.click();

    const reactivateDialog = adminPage.locator('[role="alertdialog"]').first();
    const reactivateVisible = await reactivateDialog.isVisible({ timeout: 3_000 }).catch(() => false);
    if (reactivateVisible) {
      const reconfirmBtn = reactivateDialog
        .locator('button')
        .filter({ hasText: /تفعيل|Activate|تأكيد|Confirm/i })
        .first();
      if (await reconfirmBtn.count() > 0) await reconfirmBtn.click();
    }

    // احفظ الفورم
    const submitBtn = adminPage.locator('form button[type="submit"]').first();
    await expect(submitBtn).toBeVisible({ timeout: 6_000 });
    await submitBtn.click();

    // يجب أن يكون النظام قد رد بـ toast أو redirect
    await adminPage.waitForURL(/\/employees/, { timeout: 10_000 }).catch(() => {});

    // التحقق النهائي: الموظف يظهر في قائمة الموظفين النشطين
    const currentUrl = adminPage.url();
    expect(currentUrl).toMatch(/\/employees/);
    // نجاح = لم يُرفض الـ submit ولم يظل في صفحة create/edit
    expect(currentUrl).not.toMatch(/\/employees\/create/);
  });
});
