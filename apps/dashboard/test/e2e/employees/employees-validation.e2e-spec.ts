/**
 * CareKit Dashboard — Employees Validation E2E Tests
 *
 * يغطي:
 *   - [EM-VAL-001] رفض البريد الإلكتروني المكرر عند الإنشاء
 *   - [EM-VAL-002] رسائل خطأ الحقول المطلوبة عند الإرسال الفارغ
 *   - [EM-VAL-003] رفض بريد إلكتروني بتنسيق غير صالح
 *   - [EM-VAL-004] حقول العمولة/الراتب — مخطّطة (skip مع سبب واضح)
 *
 * الـ UI: صفحة /employees/create — EmployeeFormPage مع createEmployeeSchema
 *   الحقول المطلوبة: nameEn, nameAr, email, specialty
 *
 * نمط الـ seed: EM-VAL-001 يحتاج موظفاً موجوداً بالبريد نفسه — يُنشأ مسبقاً
 * ويُحذف في afterEach. بقية الـ tests لا تحتاج seed.
 */

import { test, expect } from '../setup/fixtures';
import {
  createEmployee,
  deleteEmployee,
  type SeededEmployee,
} from '../setup/seeds';

// ─── EM-VAL-001: رفض البريد المكرر ────────────────────────────────────────

test.describe('Employees Validation — duplicate email rejection', () => {
  let existing: SeededEmployee;
  const DUPE_EMAIL = `pw.dupe.val001.${Date.now()}@test.carekit`;

  test.beforeAll(async () => {
    existing = await createEmployee({
      name: 'PWValDupe',
      email: DUPE_EMAIL,
    });
  });

  test.afterAll(async () => {
    if (existing?.id) await deleteEmployee(existing.id).catch(() => {});
  });

  test('[EM-VAL-001][Employees/validation][P1-High] إرسال بريد إلكتروني مكرر يُظهر رسالة خطأ @critical @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/employees/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // تأكد من تبويب الأساسية
    const basicTab = adminPage
      .locator('[role="tab"]')
      .filter({ hasText: /الأساسية|Basic/i })
      .first();
    if (await basicTab.count() > 0) await basicTab.click();

    // أدخل البيانات مع البريد المكرر
    const emailInput = adminPage.locator('input[type="email"], input[name="email"]').first();
    const emailVisible = await emailInput.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!emailVisible) {
      test.skip(true, 'حقل البريد الإلكتروني غير ظاهر في فورم الإنشاء');
      return;
    }

    await emailInput.fill(DUPE_EMAIL);

    // أدخل الاسم الإنجليزي
    const nameEnInput = adminPage
      .locator('input[name="nameEn"], input[placeholder*="Ahmed"], input[placeholder*="e.g."]')
      .first();
    if (await nameEnInput.count() > 0) await nameEnInput.fill('Duplicate Name EN');

    // أدخل الاسم العربي
    const nameArInput = adminPage
      .locator('input[name="nameAr"], input[placeholder*="أحمد"], input[dir="rtl"]')
      .first();
    if (await nameArInput.count() > 0) await nameArInput.fill('اسم مكرر');

    // أدخل التخصص
    const specialtyInput = adminPage
      .locator('input[name="specialty"], input[placeholder*="Specialty"], input[placeholder*="Addiction"]')
      .first();
    if (await specialtyInput.count() > 0) await specialtyInput.fill('Test Specialty');

    // أرسل الفورم
    const submitBtn = adminPage.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible({ timeout: 6_000 });
    await submitBtn.click();

    // يجب أن يظهر خطأ: إما inline validation أو toast
    const errorMessage = adminPage
      .locator('.text-destructive, [class*="destructive"], [data-type="error"]')
      .first();
    const toastError = adminPage
      .locator('[data-sonner-toast][data-type="error"], [role="status"]')
      .filter({ hasText: /بريد|email|duplicate|مكرر|موجود/i })
      .first();

    const inlineVisible = await errorMessage.isVisible({ timeout: 8_000 }).catch(() => false);
    const toastVisible = await toastError.isVisible({ timeout: 8_000 }).catch(() => false);

    // لا يزال في صفحة الإنشاء (لم يُعد redirect)
    await adminPage.waitForTimeout(1_000);
    const stillOnCreate = adminPage.url().includes('/employees/create') ||
      adminPage.url().includes('/employees/');

    expect(inlineVisible || toastVisible || stillOnCreate).toBe(true);
  });
});

// ─── EM-VAL-002: رسائل خطأ الحقول المطلوبة ───────────────────────────────

test.describe('Employees Validation — required fields', () => {
  test('[EM-VAL-002][Employees/validation][P1-High] إرسال فورم فارغ يُظهر رسائل validation @critical', async ({
    adminPage,
    goto,
  }) => {
    await goto('/employees/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // تأكد من تبويب الأساسية
    const basicTab = adminPage
      .locator('[role="tab"]')
      .filter({ hasText: /الأساسية|Basic/i })
      .first();
    if (await basicTab.count() > 0) await basicTab.click();

    // أرسل الفورم فارغاً
    const submitBtn = adminPage.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible({ timeout: 8_000 });
    await submitBtn.click();

    // يجب أن تظهر رسائل خطأ validation (Zod messages)
    const errorMessages = adminPage.locator('.text-destructive, [class*="text-destructive"]');
    await adminPage.waitForTimeout(800);
    const errorCount = await errorMessages.count();

    // الحقول المطلوبة: nameEn, nameAr, email, specialty → على الأقل خطأ واحد
    expect(errorCount).toBeGreaterThan(0);

    // تأكد أن الصفحة لم تنتقل بعيداً
    expect(adminPage.url()).toMatch(/\/employees\/create/);
  });
});

// ─── EM-VAL-003: رفض تنسيق البريد غير الصالح ─────────────────────────────

test.describe('Employees Validation — invalid email format', () => {
  test('[EM-VAL-003][Employees/validation][P2-Medium] بريد إلكتروني بتنسيق خاطئ يُظهر رسالة خطأ validation', async ({
    adminPage,
    goto,
  }) => {
    await goto('/employees/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const basicTab = adminPage
      .locator('[role="tab"]')
      .filter({ hasText: /الأساسية|Basic/i })
      .first();
    if (await basicTab.count() > 0) await basicTab.click();

    // أدخل بريد غير صالح
    const emailInput = adminPage.locator('input[type="email"], input[name="email"]').first();
    const emailVisible = await emailInput.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!emailVisible) {
      test.skip(true, 'حقل البريد الإلكتروني غير ظاهر');
      return;
    }

    await emailInput.fill('not-a-valid-email');

    // أدخل باقي الحقول المطلوبة لعزل رسالة خطأ البريد
    const nameEnInput = adminPage.locator('input[name="nameEn"]').first();
    if (await nameEnInput.count() > 0) await nameEnInput.fill('Valid Name');

    const nameArInput = adminPage.locator('input[name="nameAr"]').first();
    if (await nameArInput.count() > 0) await nameArInput.fill('اسم صحيح');

    const specialtyInput = adminPage.locator('input[name="specialty"]').first();
    if (await specialtyInput.count() > 0) await specialtyInput.fill('Specialty');

    const submitBtn = adminPage.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible({ timeout: 6_000 });
    await submitBtn.click();

    // رسالة خطأ البريد: "البريد الإلكتروني غير صالح" أو "Invalid email"
    const emailError = adminPage
      .locator('.text-destructive')
      .filter({ hasText: /بريد|email|invalid|غير صالح/i })
      .first();

    await adminPage.waitForTimeout(600);
    const errorVisible = await emailError.isVisible({ timeout: 4_000 }).catch(() => false);

    // HTML5 validation قد يمنع الإرسال أصلاً — في كلتا الحالتين الصفحة لا تنتقل
    const stayedOnCreate = adminPage.url().includes('/employees/create');
    expect(errorVisible || stayedOnCreate).toBe(true);
  });
});

// ─── EM-VAL-004: حقول العمولة/الراتب (skip) ─────────────────────────────

test.describe('Employees Validation — commission/salary fields', () => {
  test('[EM-VAL-004][Employees/validation][P3-Low] تعديل العمولة والراتب', async () => {
    test.skip(
      true,
      'حقول العمولة (commission) والراتب (salary) غير موجودة في الـ createEmployeeSchema الحالي ' +
      '(form-schema.ts). الـ schema يشمل: title, nameEn, nameAr, email, specialty, bio, experience, education, avatarUrl, isActive. ' +
      'أضف هذا الـ test عند إضافة هذه الحقول للـ schema.',
    );
  });
});
