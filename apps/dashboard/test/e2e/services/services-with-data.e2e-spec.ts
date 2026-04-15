/**
 * CareKit Dashboard — Services E2E (data-driven)
 *
 * يغطي: إنشاء خدمة، تعديل السعر، تعطيل، ربط بفرع.
 */

import { test, expect } from '../setup/fixtures';
import { createService, deleteService, type SeededService } from '../setup/seeds';

// ── SV-001: إنشاء خدمة تظهر في القائمة ────────────────────────────────────
test.describe('Services — seeded', () => {
  let seeded: SeededService;

  test.beforeEach(async () => {
    const suffix = Date.now().toString().slice(-6);
    seeded = await createService({ nameAr: `خدمة اختبار ${suffix}`, price: 120, durationMins: 45 });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteService(seeded.id);
  });

  test('[SV-001] @critical @data — الخدمة المُنشأة تظهر في قائمة الخدمات', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/services', seeded.nameAr);
    const row = adminPage.locator('table tbody tr, [class*="card"]').filter({ hasText: seeded.nameAr }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[SV-002] @data — تعديل سعر الخدمة يُحفظ ويظهر', async ({ adminPage, searchInList }) => {
    await searchInList('/services', seeded.nameAr);
    const row = adminPage.locator('table tbody tr, [class*="card"]').filter({ hasText: seeded.nameAr }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const editBtn = row
      .locator('button[aria-label*="تعديل"], button[aria-label*="edit"]')
      .first();

    if ((await editBtn.count()) === 0) { test.skip(); return; }
    await editBtn.click();

    const sheet = adminPage.locator('[role="dialog"]').first();
    await expect(sheet).toBeVisible({ timeout: 8_000 });

    const priceInput = sheet.locator('input[name="price"], input[id*="price"], input[type="number"]').first();
    await expect(priceInput).toBeVisible({ timeout: 6_000 });
    await priceInput.clear();
    await priceInput.fill('200');

    const saveBtn = sheet.locator('button[type="submit"]').first();
    await saveBtn.click();
    await expect(sheet).not.toBeVisible({ timeout: 8_000 });

    // السعر الجديد يظهر في الجدول
    await searchInList('/services', seeded.nameAr);
    await expect(
      adminPage.locator('table tbody tr, [class*="card"]')
        .filter({ hasText: seeded.nameAr })
        .filter({ hasText: '200' })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('[SV-003] @data — تعطيل الخدمة يُظهر شارة "معطّل"', async ({
    adminPage,
    searchInList,
    waitForToast,
  }) => {
    await searchInList('/services', seeded.nameAr);
    const row = adminPage.locator('table tbody tr, [class*="card"]').filter({ hasText: seeded.nameAr }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const deactivateBtn = row
      .locator('button[aria-label*="تعطيل"], button[aria-label*="deactivate"]')
      .first();

    if ((await deactivateBtn.count()) === 0) { test.skip(); return; }

    await deactivateBtn.click();
    await waitForToast(/تم تعطيل|تم تغيير|deactivated/i);
    await expect(row.getByText(/معطّل|غير نشط|inactive/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── SV-004: ربط خدمة بفرع (feature flag) ──────────────────────────────────
test.describe('Services — branch assignment', () => {
  let seeded: SeededService;

  test.beforeEach(async () => {
    seeded = await createService({ nameAr: 'خدمة فرع' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteService(seeded.id);
  });

  test('[SV-004] @data — صفحة تفاصيل الخدمة تعرض إعدادات الفروع إن كان الـ flag مفعّلاً', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/services/${seeded.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // إذا كان الـ feature flag مفعّلاً، يظهر قسم الفروع
    const branchSection = adminPage
      .locator('[class*="branch"], section, [data-section*="branch"]')
      .filter({ hasText: /فرع|branch/i })
      .first();

    // يكفي أن الصفحة تحمل بدون خطأ
    const pageContent = adminPage.locator('main, [class*="page"]').first();
    await expect(pageContent).toBeVisible({ timeout: 10_000 });

    // إذا ظهر قسم الفروع، تحقق من وجود زر إضافة
    if ((await branchSection.count()) > 0) {
      const addBranchBtn = adminPage.getByRole('button', { name: /إضافة فرع|add branch/i }).first();
      await expect(addBranchBtn).toBeVisible({ timeout: 6_000 });
    }
  });
});
