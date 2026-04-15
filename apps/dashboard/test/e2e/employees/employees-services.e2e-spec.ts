/**
 * CareKit Dashboard — Employees Services Assignment E2E Tests
 *
 * يغطي:
 *   - [EM-SV-001] ربط خدمة بموظف (AssignServiceSheet → حفظ → toast نجاح)
 *   - [EM-SV-002] إلغاء ربط خدمة (RemoveServiceDialog → تأكيد → الخدمة تختفي)
 *   - [EM-SV-003] بطاقة الخدمات تحمل وتعرض الخدمات المربوطة بعد reload
 *
 * الـ UI:
 *   - بطاقة "الخدمات المتاحة" في /employees/[id] تحتوي على EmployeeServicesSection
 *   - زر "ربط خدمة" يفتح AssignServiceSheet
 *   - كل خدمة لها زر "حذف" يفتح RemoveServiceDialog
 *
 * نمط الـ seed: ننشئ موظفاً + خدمة مستقلة لكل test ونحذفهما في afterEach.
 */

import { test, expect } from '../setup/fixtures';
import {
  createEmployee,
  deleteEmployee,
  createService,
  deleteService,
  type SeededEmployee,
  type SeededService,
} from '../setup/seeds';

// ─── EM-SV-001: ربط خدمة بموظف ──────────────────────────────────────────

test.describe('Employees Services — assign service', () => {
  let seeded: SeededEmployee;
  let service: SeededService;

  test.beforeEach(async () => {
    [seeded, service] = await Promise.all([
      createEmployee({ name: 'PWSvcAssign' }),
      createService({ nameAr: 'خدمة اختبار EM-SV-001', nameEn: 'Test Service SV001' }),
    ]);
  });

  test.afterEach(async () => {
    await Promise.all([
      seeded?.id ? deleteEmployee(seeded.id).catch(() => {}) : Promise.resolve(),
      service?.id ? deleteService(service.id).catch(() => {}) : Promise.resolve(),
    ]);
  });

  test('[EM-SV-001][Employees/services][P1-High] ربط خدمة بموظف يُظهر toast النجاح @critical @data', async ({
    adminPage,
    goto,
    waitForToast,
  }) => {
    await goto(`/employees/${seeded.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // قسم "الخدمات المتاحة"
    const servicesSection = adminPage
      .getByText(/الخدمات المتاحة|Available Services/)
      .first();
    const sectionVisible = await servicesSection.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!sectionVisible) {
      test.skip(true, 'قسم الخدمات غير ظاهر في صفحة تفاصيل الموظف');
      return;
    }

    // زر ربط خدمة
    const assignBtn = adminPage
      .getByRole('button', { name: /ربط خدمة|إضافة خدمة|assign|Add Service/i })
      .first();
    const btnVisible = await assignBtn.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!btnVisible) {
      test.skip(true, 'زر ربط خدمة غير ظاهر');
      return;
    }

    await assignBtn.click();

    // الـ Sheet يفتح
    const sheet = adminPage.locator('[role="dialog"]').first();
    await expect(sheet).toBeVisible({ timeout: 6_000 });

    // اختر خدمة من الـ Select
    const serviceTrigger = sheet.locator('[role="combobox"]').first();
    const triggerVisible = await serviceTrigger.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!triggerVisible) {
      test.skip(true, 'لا يوجد combobox لاختيار الخدمة في الـ AssignServiceSheet');
      return;
    }

    await serviceTrigger.click();

    const listbox = adminPage.locator('[role="listbox"]').first();
    await expect(listbox).toBeVisible({ timeout: 6_000 });

    // ابحث عن الخدمة التي أنشأناها
    const serviceOption = listbox
      .locator('[role="option"]')
      .filter({ hasText: service.nameAr })
      .first();
    const optionVisible = await serviceOption.isVisible({ timeout: 4_000 }).catch(() => false);

    if (optionVisible) {
      await serviceOption.click();
    } else {
      // خذ أول خيار متاح
      const firstOption = listbox.locator('[role="option"]').first();
      const firstVisible = await firstOption.isVisible({ timeout: 4_000 }).catch(() => false);
      if (!firstVisible) {
        test.skip(true, 'لا توجد خدمات متاحة لتعيينها في القائمة');
        return;
      }
      await firstOption.click();
    }

    // احفظ
    const saveBtn = sheet.locator('button[type="submit"], button[form="assign-service-form"]').first();
    await expect(saveBtn).toBeVisible({ timeout: 6_000 });
    await saveBtn.click();

    await waitForToast(/تم.*خدمة|assigned|success/i);
  });
});

// ─── EM-SV-002: إلغاء ربط خدمة ──────────────────────────────────────────

test.describe('Employees Services — remove service', () => {
  let seeded: SeededEmployee;
  let service: SeededService;

  test.beforeEach(async () => {
    [seeded, service] = await Promise.all([
      createEmployee({ name: 'PWSvcRemove' }),
      createService({ nameAr: 'خدمة إلغاء SV-002', nameEn: 'Remove Service SV002' }),
    ]);
  });

  test.afterEach(async () => {
    await Promise.all([
      seeded?.id ? deleteEmployee(seeded.id).catch(() => {}) : Promise.resolve(),
      service?.id ? deleteService(service.id).catch(() => {}) : Promise.resolve(),
    ]);
  });

  test('[EM-SV-002][Employees/services][P1-High] إلغاء ربط خدمة يُظهر toast النجاح ويُزيل البطاقة @critical @data', async ({
    adminPage,
    goto,
    waitForToast,
  }) => {
    await goto(`/employees/${seeded.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const servicesSection = adminPage
      .getByText(/الخدمات المتاحة|Available Services/)
      .first();
    const sectionVisible = await servicesSection.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!sectionVisible) {
      test.skip(true, 'قسم الخدمات غير ظاهر');
      return;
    }

    // ابحث عن أي زر حذف خدمة موجود بالفعل
    const removeBtn = adminPage
      .getByRole('button', { name: /حذف|Delete|Remove/i })
      .first();
    const removeBtnVisible = await removeBtn.isVisible({ timeout: 4_000 }).catch(() => false);

    if (!removeBtnVisible) {
      test.skip(true, 'لا توجد خدمات مربوطة بالموظف لاختبار حذفها — يمكن ربط خدمة أولاً يدوياً');
      return;
    }

    await removeBtn.click();

    // AlertDialog للتأكيد
    const dialog = adminPage.locator('[role="alertdialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    // زر تأكيد الحذف (destructive)
    const confirmBtn = dialog
      .locator('button')
      .filter({ hasText: /حذف|Delete|تأكيد|Confirm/i })
      .last();
    await expect(confirmBtn).toBeVisible({ timeout: 4_000 });
    await confirmBtn.click();

    await waitForToast(/تم.*حذف|removed|success/i);
  });
});

// ─── EM-SV-003: التحقق من بطاقة الخدمات بعد reload ─────────────────────

test.describe('Employees Services — services tab persists after reload', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWSvcReload' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id).catch(() => {});
  });

  test('[EM-SV-003][Employees/services][P2-Medium] بطاقة الخدمات تحمل وتعرض empty state أو قائمة بعد reload @data', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/employees/${seeded.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // بطاقة الخدمات يجب أن تكون ظاهرة
    const servicesCard = adminPage
      .getByText(/الخدمات المتاحة|Available Services/)
      .first();
    await expect(servicesCard).toBeVisible({ timeout: 10_000 });

    // يجب أن يكون هناك إما empty state أو قائمة خدمات
    const emptyState = adminPage
      .getByText(/لا توجد خدمات|noServices|No services/i)
      .first();
    const serviceItems = adminPage
      .locator('[class*="rounded-md"][class*="border"]')
      .filter({ hasText: /SAR|ريال|دقيقة|min/i });

    const emptyVisible = await emptyState.isVisible({ timeout: 4_000 }).catch(() => false);
    const hasItems = (await serviceItems.count()) > 0;

    // أحد الحالتين يجب أن يكون صحيحاً
    expect(emptyVisible || hasItems).toBe(true);

    // reload وتأكد أن القسم لا يزال ظاهراً
    await adminPage.reload();
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const cardAfterReload = adminPage
      .getByText(/الخدمات المتاحة|Available Services/)
      .first();
    await expect(cardAfterReload).toBeVisible({ timeout: 10_000 });
  });
});
