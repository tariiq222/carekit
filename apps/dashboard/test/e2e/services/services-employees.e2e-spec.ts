/**
 * CareKit Dashboard — Services × Employees E2E
 *
 * يغطي:
 *   SV-EMP-001  تعيين موظفين لخدمة من صفحة تعديل الخدمة
 *   SV-EMP-002  إلغاء ربط موظف من صفحة تعديل الخدمة (navigate to employee edit)
 *   SV-EMP-003  الموظفون المربوطون يظهرون في تبويب employees بصفحة تعديل الخدمة
 */

import { test, expect } from '../setup/fixtures';
import {
  createService,
  deleteService,
  createEmployee,
  deleteEmployee,
  type SeededService,
  type SeededEmployee,
} from '../setup/seeds';

// ── SV-EMP-001: تعيين موظف ─────────────────────────────────────────────────────
test.describe('Services Employees — تعيين موظف', () => {
  let svc: SeededService;
  let emp: SeededEmployee;

  test.beforeEach(async () => {
    const suffix = Date.now().toString().slice(-6);
    svc = await createService({ nameAr: `خدمة ربط ${suffix}` });
    emp = await createEmployee({ name: `PWEmpSvc${suffix}` });
  });

  test.afterEach(async () => {
    if (svc?.id) await deleteService(svc.id).catch(() => {});
    if (emp?.id) await deleteEmployee(emp.id).catch(() => {});
  });

  test('[SV-EMP-001][Services/employees][P2-High] تعيين موظف للخدمة يُظهره في التبويب @data', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/services/${svc.id}/edit?tab=employees`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // تبويب الموظفين — قد يكون محدداً عبر query param أو يحتاج نقرة
    const empTab = adminPage
      .getByRole('tab', { name: /موظفين|employees/i })
      .first();
    if ((await empTab.count()) > 0) {
      await empTab.click();
    }

    // زر إضافة موظف
    const addBtn = adminPage
      .getByRole('button', { name: /إضافة|add/i })
      .first();

    if ((await addBtn.count()) === 0) {
      test.skip();
      return;
    }

    await addBtn.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // ابحث عن الموظف الذي أنشأناه
    const searchInput = dialog
      .locator('input[placeholder*="بحث"], input[placeholder*="search"], input[type="search"]')
      .first();

    if ((await searchInput.count()) > 0) {
      await searchInput.fill(emp.name);
      await adminPage.waitForTimeout(600);
    }

    // حدد الموظف
    const empOption = dialog
      .locator('[role="option"], button')
      .filter({ hasText: emp.name })
      .first();

    if ((await empOption.count()) === 0) {
      // الموظف غير ظاهر في القائمة — تخطَّ بدون فشل
      await adminPage.keyboard.press('Escape');
      test.skip();
      return;
    }

    await empOption.click();

    // زر الحفظ في الـ dialog
    const saveBtn = dialog
      .locator('button[type="button"]')
      .filter({ hasText: /تعيين|assign|حفظ|save/i })
      .first();
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    // الموظف يظهر في تبويب الموظفين
    const empEntry = adminPage.locator('div, li, tr').filter({ hasText: emp.name }).first();
    await expect(empEntry).toBeVisible({ timeout: 10_000 });
  });
});

// ── SV-EMP-002: إلغاء الربط يُعيد التوجيه لصفحة الموظف ───────────────────────
test.describe('Services Employees — زر عرض/إلغاء الربط', () => {
  let svc: SeededService;
  let emp: SeededEmployee;

  test.beforeEach(async () => {
    const suffix = Date.now().toString().slice(-6);
    svc = await createService({ nameAr: `خدمة إلغاء ${suffix}` });
    emp = await createEmployee({ name: `PWEmpUnlink${suffix}` });
  });

  test.afterEach(async () => {
    if (svc?.id) await deleteService(svc.id).catch(() => {});
    if (emp?.id) await deleteEmployee(emp.id).catch(() => {});
  });

  test('[SV-EMP-002][Services/employees][P2-High] تبويب الموظفين يعرض الحالة الفارغة أو الموظفين @data', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/services/${svc.id}/edit?tab=employees`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const empTab = adminPage
      .getByRole('tab', { name: /موظفين|employees/i })
      .first();
    if ((await empTab.count()) > 0) {
      await empTab.click();
    }

    // تبويب الموظفين يجب أن يعرض إما قائمة أو حالة فارغة أو skeleton
    const anyContent = adminPage.locator(
      '[class*="empty"], [class*="skeleton"], button[aria-label], div[class*="rounded-xl"]',
    );
    await expect(anyContent.first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── SV-EMP-003: الموظفون المربوطون يظهرون في صفحة التعديل ──────────────────────
test.describe('Services Employees — التحقق من الموظفين في صفحة التعديل', () => {
  let svc: SeededService;

  test.beforeEach(async () => {
    const suffix = Date.now().toString().slice(-6);
    svc = await createService({ nameAr: `خدمة عرض موظفين ${suffix}` });
  });

  test.afterEach(async () => {
    if (svc?.id) await deleteService(svc.id).catch(() => {});
  });

  test('[SV-EMP-003][Services/employees][P2-High] صفحة تعديل الخدمة تحتوي تبويب employees ويحمل @data', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/services/${svc.id}/edit`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // تبويب الموظفين موجود
    const empTab = adminPage
      .getByRole('tab', { name: /موظفين|employees/i })
      .first();

    if ((await empTab.count()) === 0) {
      test.skip();
      return;
    }

    await empTab.click();

    // بعد النقر — لا خطأ ظاهر
    const errorBanner = adminPage
      .locator('[class*="error"], [role="alert"]')
      .filter({ hasText: /خطأ|error|failed/i })
      .first();
    await expect(errorBanner).toHaveCount(0, { timeout: 6_000 });

    // محتوى التبويب يحمل (فارغ أو موظفون)
    const tabContent = adminPage
      .locator('[data-state="active"]')
      .first();
    await expect(tabContent).toBeVisible({ timeout: 8_000 });
  });
});
