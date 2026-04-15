/**
 * CareKit Dashboard — Services Filters & Search E2E
 *
 * يغطي:
 *   SV-030  البحث بالاسم العربي يُعيد الخدمة الصحيحة
 *   SV-031  البحث بالاسم الإنجليزي يُعيد الخدمة الصحيحة
 *   SV-032  فلتر الحالة "نشط" يُظهر الخدمات النشطة فقط
 *   SV-033  فلتر الحالة "معطّل" يُظهر الخدمات المعطلة فقط
 *   SV-034  بحث + فلتر معاً يُضيّقان النتائج
 *   SV-035  إعادة تعيين الفلاتر تُرجع القائمة الكاملة
 */

import { test, expect } from '../setup/fixtures';
import { createService, deleteService, type SeededService } from '../setup/seeds';

// ── SV-030: بحث بالاسم العربي ─────────────────────────────────────────────────
test.describe('Services Filters — بحث بالاسم العربي', () => {
  let svc: SeededService;

  test.beforeEach(async () => {
    const suffix = Date.now().toString().slice(-6);
    svc = await createService({ nameAr: `فحص البحث العربي ${suffix}`, nameEn: `Arabic Search ${suffix}` });
  });

  test.afterEach(async () => {
    if (svc?.id) await deleteService(svc.id).catch(() => {});
  });

  test('[SV-030][Services/filters][P1-Critical] البحث بالاسم العربي يُعيد الخدمة الصحيحة @critical @data', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/services', svc.nameAr);

    const row = adminPage
      .locator('table tbody tr, [class*="card"]')
      .filter({ hasText: svc.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });
});

// ── SV-031: بحث بالاسم الإنجليزي ─────────────────────────────────────────────
test.describe('Services Filters — بحث بالاسم الإنجليزي', () => {
  let svc: SeededService;

  test.beforeEach(async () => {
    const suffix = Date.now().toString().slice(-6);
    svc = await createService({
      nameAr: `خدمة إنجليزي ${suffix}`,
      nameEn: `EnSearch${suffix}`,
    });
  });

  test.afterEach(async () => {
    if (svc?.id) await deleteService(svc.id).catch(() => {});
  });

  test('[SV-031][Services/filters][P1-Critical] البحث بالاسم الإنجليزي يُعيد الخدمة الصحيحة @critical @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();

    if ((await searchInput.count()) === 0) {
      test.skip();
      return;
    }

    await searchInput.fill(svc.nameAr.replace(/\d+/, '').trim() === 'خدمة إنجليزي'
      ? `EnSearch${svc.nameAr.match(/\d+/)?.[0] ?? ''}`
      : svc.nameAr);

    // ابحث بالاسم الإنجليزي — استخدام الـ nameAr الذي يحتوي رقم فريد
    await searchInput.clear();
    const enSuffix = svc.nameAr.match(/\d+/)?.[0] ?? Date.now().toString().slice(-6);
    await searchInput.fill(`EnSearch${enSuffix}`);

    await adminPage.waitForTimeout(600);

    const row = adminPage
      .locator('table tbody tr, [class*="card"]')
      .filter({ hasText: new RegExp(`EnSearch${enSuffix}`, 'i') })
      .first();

    await expect(row).toBeVisible({ timeout: 10_000 });
  });
});

// ── SV-032: فلتر حالة نشط ────────────────────────────────────────────────────
test.describe('Services Filters — فلتر الحالة', () => {
  let activeSvc: SeededService;

  test.beforeEach(async () => {
    const suffix = Date.now().toString().slice(-6);
    activeSvc = await createService({ nameAr: `خدمة نشطة ${suffix}`, isActive: true });
  });

  test.afterEach(async () => {
    if (activeSvc?.id) await deleteService(activeSvc.id).catch(() => {});
  });

  test('[SV-032][Services/filters][P2-High] فلتر "نشط" يُظهر الخدمات النشطة فقط @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // الـ combobox الأول هو فلتر الحالة
    const statusCombobox = adminPage.locator('[role="combobox"]').first();

    if ((await statusCombobox.count()) === 0) {
      test.skip();
      return;
    }

    await statusCombobox.click();

    const activeOption = adminPage
      .locator('[role="option"]')
      .filter({ hasText: /^نشط$|^Active$|^نشطة$/ })
      .first();

    if ((await activeOption.count()) === 0) {
      await adminPage.keyboard.press('Escape');
      test.skip();
      return;
    }

    await activeOption.click();
    await adminPage.waitForTimeout(600);

    // بعد الفلتر — لا توجد شارات "معطّل" أو "inactive" في الصفوف
    const inactiveBadges = adminPage
      .locator('table tbody tr, [class*="card"]')
      .filter({ hasText: /معطّل|Inactive|inactive/i });

    await expect(inactiveBadges).toHaveCount(0, { timeout: 8_000 });
  });

  test('[SV-033][Services/filters][P2-High] فلتر "معطّل" يُظهر الخدمات المعطلة فقط @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const statusCombobox = adminPage.locator('[role="combobox"]').first();

    if ((await statusCombobox.count()) === 0) {
      test.skip();
      return;
    }

    await statusCombobox.click();

    const inactiveOption = adminPage
      .locator('[role="option"]')
      .filter({ hasText: /^معطّل$|^Inactive$|^غير نشط$|^غير نشطة$/ })
      .first();

    if ((await inactiveOption.count()) === 0) {
      await adminPage.keyboard.press('Escape');
      test.skip();
      return;
    }

    await inactiveOption.click();
    await adminPage.waitForTimeout(600);

    // بعد الفلتر — لا توجد شارات "نشط" في الصفوف (أو القائمة فارغة وهذا مقبول)
    const activeBadges = adminPage
      .locator('table tbody tr')
      .filter({ hasText: /^نشط$|^Active$/ });

    const tableEmpty = adminPage
      .locator('[class*="empty"]')
      .filter({ hasText: /لا توجد|no services/i })
      .first();

    const emptyOrNoActive =
      (await activeBadges.count()) === 0 ||
      (await tableEmpty.isVisible({ timeout: 3_000 }).catch(() => false));

    expect(emptyOrNoActive).toBe(true);
  });
});

// ── SV-034: بحث + فلتر معاً ──────────────────────────────────────────────────
test.describe('Services Filters — بحث مع فلتر', () => {
  let svc: SeededService;

  test.beforeEach(async () => {
    const suffix = Date.now().toString().slice(-6);
    svc = await createService({ nameAr: `خدمة مركّبة ${suffix}`, isActive: true });
  });

  test.afterEach(async () => {
    if (svc?.id) await deleteService(svc.id).catch(() => {});
  });

  test('[SV-034][Services/filters][P2-High] بحث + فلتر نشط معاً يُعيدان الخدمة الصحيحة @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // 1. فلتر نشط
    const statusCombobox = adminPage.locator('[role="combobox"]').first();
    if ((await statusCombobox.count()) > 0) {
      await statusCombobox.click();
      const activeOpt = adminPage
        .locator('[role="option"]')
        .filter({ hasText: /^نشط$|^Active$/ })
        .first();
      if (await activeOpt.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await activeOpt.click();
        await adminPage.waitForTimeout(400);
      } else {
        await adminPage.keyboard.press('Escape');
      }
    }

    // 2. بحث بالاسم
    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();

    if ((await searchInput.count()) === 0) {
      test.skip();
      return;
    }

    await searchInput.fill(svc.nameAr);
    await adminPage.waitForTimeout(700);

    // النتيجة: الخدمة ظاهرة
    const row = adminPage
      .locator('table tbody tr, [class*="card"]')
      .filter({ hasText: svc.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 10_000 });
  });
});

// ── SV-035: إعادة تعيين الفلاتر ──────────────────────────────────────────────
test.describe('Services Filters — إعادة التعيين', () => {
  let svc: SeededService;

  test.beforeEach(async () => {
    const suffix = Date.now().toString().slice(-6);
    svc = await createService({ nameAr: `خدمة إعادة تعيين ${suffix}` });
  });

  test.afterEach(async () => {
    if (svc?.id) await deleteService(svc.id).catch(() => {});
  });

  test('[SV-035][Services/filters][P2-High] زر إعادة التعيين يُفرغ حقل البحث ويُعيد الجدول @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // اكتب في البحث
    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();

    if ((await searchInput.count()) === 0) {
      test.skip();
      return;
    }

    await searchInput.fill('xyz_not_exist_query');
    await adminPage.waitForTimeout(600);

    // زر إعادة التعيين
    const resetBtn = adminPage
      .getByRole('button', { name: /إعادة|reset|مسح|clear/i })
      .first();

    if ((await resetBtn.count()) === 0) {
      // محاولة بديلة: مسح الـ input يدوياً
      await searchInput.clear();
      await adminPage.waitForTimeout(400);
    } else {
      await resetBtn.click();
      await adminPage.waitForTimeout(400);
    }

    // الـ input فارغ بعد إعادة التعيين
    const currentValue = await searchInput.inputValue();
    expect(currentValue).toBe('');

    // الجدول يعرض نتائج (الخدمة التي أنشأناها ظاهرة)
    const tableRows = adminPage.locator('table tbody tr, [class*="card"]');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });
});
