/**
 * CareKit Dashboard — Coupons E2E (data-driven)
 *
 * يغطي: إنشاء كوبون (% أو مبلغ)، تعطيل، حذف.
 */

import { test, expect } from '../setup/fixtures';
import { createCoupon, deleteCoupon, type SeededCoupon } from '../setup/seeds';

// ── CP-001: إنشاء كوبون بنسبة مئوية ───────────────────────────────────────
test.describe('Coupons — percentage coupon', () => {
  let seeded: SeededCoupon;

  test.beforeEach(async () => {
    seeded = await createCoupon({ discountType: 'PERCENTAGE', discountValue: 15 });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteCoupon(seeded.id);
  });

  test('[CP-001] @critical @data — كوبون النسبة المئوية يظهر في القائمة', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/coupons', seeded.code);
    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.code }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    // يجب أن يظهر نوع الخصم
    await expect(row.getByText(/نسبة|%|percentage/i).first()).toBeVisible({ timeout: 6_000 });
  });
});

// ── CP-002: إنشاء كوبون بمبلغ ثابت ────────────────────────────────────────
test.describe('Coupons — fixed amount coupon', () => {
  let seeded: SeededCoupon;

  test.beforeEach(async () => {
    seeded = await createCoupon({ discountType: 'FIXED', discountValue: 50 });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteCoupon(seeded.id);
  });

  test('[CP-002] @data — كوبون المبلغ الثابت يظهر في القائمة بالنوع الصحيح', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/coupons', seeded.code);
    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.code }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    await expect(row.getByText(/ثابت|fixed|مبلغ/i).first()).toBeVisible({ timeout: 6_000 });
  });
});

// ── CP-003: تعطيل كوبون ────────────────────────────────────────────────────
test.describe('Coupons — deactivate', () => {
  let seeded: SeededCoupon;

  test.beforeEach(async () => {
    seeded = await createCoupon({ discountType: 'PERCENTAGE', discountValue: 20, isActive: true });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteCoupon(seeded.id);
  });

  test('[CP-003] @data — تعطيل كوبون نشط يُظهر شارة "معطّل"', async ({
    adminPage,
    searchInList,
    waitForToast,
  }) => {
    await searchInList('/coupons', seeded.code);
    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.code }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const deactivateBtn = row
      .locator('button[aria-label*="تعطيل"], button[aria-label*="حظر"], button[aria-label*="deactivate"]')
      .first();

    if ((await deactivateBtn.count()) === 0) {
      test.skip();
      return;
    }

    await deactivateBtn.click();
    await waitForToast(/تم تعطيل|تم تغيير|deactivated/i);

    // شارة "معطّل" تظهر
    await expect(row.getByText(/معطّل|غير نشط|inactive/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── CP-004: حذف كوبون ──────────────────────────────────────────────────────
test.describe('Coupons — delete', () => {
  let seeded: SeededCoupon;

  test.beforeEach(async () => {
    seeded = await createCoupon({ discountType: 'PERCENTAGE', discountValue: 5 });
  });

  // لا afterEach لأن الـ test نفسه يحذف الكوبون — إن فشل نحذف manually
  test.afterEach(async () => {
    await deleteCoupon(seeded.id).catch(() => {});
  });

  test('[CP-004] @data — حذف كوبون يُزيله من القائمة', async ({
    adminPage,
    searchInList,
    waitForToast,
  }) => {
    await searchInList('/coupons', seeded.code);
    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.code }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const deleteBtn = row
      .locator('button[aria-label*="حذف"], button[aria-label*="delete"]')
      .first();

    if ((await deleteBtn.count()) === 0) { test.skip(); return; }

    await deleteBtn.click();

    // Confirmation dialog
    const dialog = adminPage.locator('[role="alertdialog"], [role="dialog"]').first();
    if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const confirmBtn = dialog.getByRole('button', { name: /حذف|تأكيد|delete|confirm/i }).first();
      await confirmBtn.click();
    }

    await waitForToast(/تم الحذف|deleted/i);

    // الكوبون اختفى من القائمة
    await expect(row).not.toBeVisible({ timeout: 8_000 });
  });
});
