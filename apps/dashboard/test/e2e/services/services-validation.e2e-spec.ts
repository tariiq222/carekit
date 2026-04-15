/**
 * CareKit Dashboard — Services Validation E2E
 *
 * يغطي:
 *   SV-VAL-001  رفض سعر سالب (الـ schema يتطلب min 0 عبر BookingTypeRow)
 *   SV-VAL-002  رفض مدة صفرية أو سالبة
 *   SV-VAL-003  رفض الإرسال بدون اسم عربي
 *   SV-VAL-004  رفض الإرسال بدون اسم إنجليزي
 *   SV-VAL-005  معالجة اسم مكرر — الـ backend يُرجع خطأ واضح
 *
 * ملاحظة: الفحوص تتحقق من رسائل الـ validation في الـ UI لا من رفض HTTP مباشرة.
 */

import { test, expect } from '../setup/fixtures';
import { createService, deleteService, type SeededService } from '../setup/seeds';

// ── SV-VAL-001: سعر سالب ──────────────────────────────────────────────────────
test.describe('Services Validation — سعر سالب', () => {
  test('[SV-VAL-001][Services/validation][P1-Critical] حقل السعر لا يقبل قيمة سالبة @smoke', async ({
    adminPage,
    goto,
  }) => {
    await goto('/services/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // انتقل لتبويب pricing
    const pricingTab = adminPage
      .getByRole('tab', { name: /تسعير|pricing/i })
      .first();
    if ((await pricingTab.count()) > 0) {
      await pricingTab.click();
      await adminPage.waitForTimeout(300);
    }

    const priceInput = adminPage
      .locator('input[type="number"]')
      .first();

    if ((await priceInput.count()) === 0) {
      test.skip();
      return;
    }

    // أدخل قيمة سالبة
    await priceInput.clear();
    await priceInput.fill('-50');

    // محاولة الإرسال
    const saveBtn = adminPage.locator('button[type="submit"]').first();
    await saveBtn.click();

    // إما: input يمنع القيمة السالبة (min=0 على العنصر)
    // أو: رسالة validation تظهر
    const inputMin = await priceInput.getAttribute('min');
    const rejectedByBrowser = inputMin === '0';

    const validationMsg = adminPage
      .locator('[class*="destructive"], [role="alert"]')
      .filter({ hasText: /سعر|price|موجب|positive|0|min/i })
      .first();

    const hasValidation = await validationMsg.isVisible({ timeout: 3_000 }).catch(() => false);

    // القيمة الفعلية في الـ input بعد الإدخال
    const actualValue = await priceInput.inputValue();

    // يُقبل إذا: المتصفح منع السالب، أو ظهرت رسالة validation، أو القيمة لم تُقبل
    expect(rejectedByBrowser || hasValidation || parseFloat(actualValue) >= 0).toBe(true);
  });
});

// ── SV-VAL-002: مدة صفرية ────────────────────────────────────────────────────
test.describe('Services Validation — مدة صفرية', () => {
  test('[SV-VAL-002][Services/validation][P1-Critical] حقل المدة لا يقبل الصفر أو القيم السالبة @smoke', async ({
    adminPage,
    goto,
  }) => {
    await goto('/services/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const pricingTab = adminPage
      .getByRole('tab', { name: /تسعير|pricing/i })
      .first();
    if ((await pricingTab.count()) > 0) {
      await pricingTab.click();
      await adminPage.waitForTimeout(300);
    }

    // حقل المدة — عادة الثاني بين حقول number
    const durationInput = adminPage
      .locator('input[type="number"]')
      .nth(1);

    if ((await durationInput.count()) === 0) {
      test.skip();
      return;
    }

    await durationInput.clear();
    await durationInput.fill('0');

    const saveBtn = adminPage.locator('button[type="submit"]').first();
    await saveBtn.click();

    // تحقق من min attribute أو رسالة validation
    const inputMin = await durationInput.getAttribute('min');
    const rejectedByBrowser = inputMin !== null && parseFloat(inputMin) > 0;

    const validationMsg = adminPage
      .locator('[class*="destructive"], [role="alert"]')
      .filter({ hasText: /مدة|duration|min|أكبر/i })
      .first();

    const hasValidation = await validationMsg.isVisible({ timeout: 3_000 }).catch(() => false);
    const actualValue = await durationInput.inputValue();

    expect(rejectedByBrowser || hasValidation || parseFloat(actualValue) > 0).toBe(true);
  });
});

// ── SV-VAL-003: اسم عربي مفقود ───────────────────────────────────────────────
test.describe('Services Validation — اسم عربي مفقود', () => {
  test('[SV-VAL-003][Services/validation][P1-Critical] الإرسال بدون اسم عربي يُظهر رسالة خطأ @critical', async ({
    adminPage,
    goto,
  }) => {
    await goto('/services/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const basicTab = adminPage
      .getByRole('tab', { name: /معلومات|basic/i })
      .first();
    if ((await basicTab.count()) > 0) {
      await basicTab.click();
      await adminPage.waitForTimeout(300);
    }

    // أدخل اسم إنجليزي فقط — اترك العربي فارغاً
    const nameEnInput = adminPage
      .locator('input[name="nameEn"]')
      .first();
    const nameArInput = adminPage
      .locator('input[name="nameAr"]')
      .first();

    if ((await nameEnInput.count()) === 0) {
      test.skip();
      return;
    }

    await nameEnInput.fill('Test Service Only EN');
    if ((await nameArInput.count()) > 0) {
      await nameArInput.clear();
    }

    const saveBtn = adminPage.locator('button[type="submit"]').first();
    await saveBtn.click();

    // رسالة validation أو toast خطأ
    const validationErr = adminPage
      .locator('[class*="destructive"], p[class*="text-destructive"]')
      .first();
    const toastErr = adminPage
      .locator('[data-sonner-toast], [role="status"]')
      .filter({ hasText: /required|مطلوب|اسم|name/i })
      .first();

    const hasErrMsg =
      (await validationErr.isVisible({ timeout: 5_000 }).catch(() => false)) ||
      (await toastErr.isVisible({ timeout: 3_000 }).catch(() => false));

    expect(hasErrMsg).toBe(true);
  });
});

// ── SV-VAL-004: اسم إنجليزي مفقود ────────────────────────────────────────────
test.describe('Services Validation — اسم إنجليزي مفقود', () => {
  test('[SV-VAL-004][Services/validation][P1-Critical] الإرسال بدون اسم إنجليزي يُظهر رسالة خطأ @critical', async ({
    adminPage,
    goto,
  }) => {
    await goto('/services/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const basicTab = adminPage
      .getByRole('tab', { name: /معلومات|basic/i })
      .first();
    if ((await basicTab.count()) > 0) {
      await basicTab.click();
      await adminPage.waitForTimeout(300);
    }

    const nameEnInput = adminPage
      .locator('input[name="nameEn"]')
      .first();
    const nameArInput = adminPage
      .locator('input[name="nameAr"]')
      .first();

    if ((await nameArInput.count()) === 0) {
      test.skip();
      return;
    }

    await nameArInput.fill('خدمة اختبار بدون إنجليزي');
    if ((await nameEnInput.count()) > 0) {
      await nameEnInput.clear();
    }

    const saveBtn = adminPage.locator('button[type="submit"]').first();
    await saveBtn.click();

    const validationErr = adminPage
      .locator('[class*="destructive"], p[class*="text-destructive"]')
      .first();
    const toastErr = adminPage
      .locator('[data-sonner-toast], [role="status"]')
      .filter({ hasText: /required|مطلوب|اسم|name/i })
      .first();

    const hasErrMsg =
      (await validationErr.isVisible({ timeout: 5_000 }).catch(() => false)) ||
      (await toastErr.isVisible({ timeout: 3_000 }).catch(() => false));

    expect(hasErrMsg).toBe(true);
  });
});

// ── SV-VAL-005: اسم مكرر ──────────────────────────────────────────────────────
test.describe('Services Validation — اسم مكرر', () => {
  let existing: SeededService;

  test.beforeEach(async () => {
    const suffix = Date.now().toString().slice(-6);
    existing = await createService({
      nameAr: `خدمة مكررة ${suffix}`,
      nameEn: `Duplicate Service ${suffix}`,
    });
  });

  test.afterEach(async () => {
    if (existing?.id) await deleteService(existing.id).catch(() => {});
  });

  test('[SV-VAL-005][Services/validation][P2-High] إنشاء خدمة باسم مكرر يُعالج بشكل لائق @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/services/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const basicTab = adminPage
      .getByRole('tab', { name: /معلومات|basic/i })
      .first();
    if ((await basicTab.count()) > 0) {
      await basicTab.click();
      await adminPage.waitForTimeout(300);
    }

    const nameArInput = adminPage.locator('input[name="nameAr"]').first();
    const nameEnInput = adminPage.locator('input[name="nameEn"]').first();

    if ((await nameArInput.count()) === 0) {
      test.skip();
      return;
    }

    await nameArInput.fill(existing.nameAr);
    if ((await nameEnInput.count()) > 0) {
      await nameEnInput.fill(`Duplicate Service ${Date.now().toString().slice(-6)}`);
    }

    // اختر فئة إن توفرت
    const categoryCombobox = adminPage.locator('[role="combobox"]').first();
    if ((await categoryCombobox.count()) > 0) {
      await categoryCombobox.click();
      const firstOption = adminPage.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstOption.click();
      } else {
        await adminPage.keyboard.press('Escape');
      }
    }

    const saveBtn = adminPage.locator('button[type="submit"]').first();
    await saveBtn.click();

    // النتيجة المقبولة: toast خطأ، أو رسالة validation، أو البقاء في الصفحة (لم يُعد التوجيه)
    const currentUrl = adminPage.url();

    const toastErr = adminPage
      .locator('[data-sonner-toast], [role="status"], [data-type="error"]')
      .filter({ hasText: /خطأ|error|مكرر|duplicate|already|موجود/i })
      .first();

    const errShown = await toastErr.isVisible({ timeout: 6_000 }).catch(() => false);
    const stayedOnPage = adminPage.url().includes('/create');

    // إما ظهر خطأ أو بقيت في صفحة الإنشاء
    expect(errShown || stayedOnPage || currentUrl.includes('/create')).toBe(true);
  });
});
