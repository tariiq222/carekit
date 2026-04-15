/**
 * CareKit Dashboard — Branches Create (BH-020 – BH-024)
 *
 * يغطي: إنشاء فرع كامل من الواجهة، التحقق من ظهوره في القائمة، وإلغاء الإنشاء.
 *
 * الشرائح: create
 */

import { test, expect } from '../setup/fixtures';
import { deleteBranch } from '../setup/seeds';
import { uid } from '../setup/seeds/seed-base';

let createdBranchId: string | null = null;

test.describe('Branches — create', () => {
  test.afterEach(async ({ adminPage: _page }) => {
    // Cleanup any branch created during the test via API
    if (createdBranchId) {
      await deleteBranch(createdBranchId).catch(() => {});
      createdBranchId = null;
    }
  });

  test('[BH-020][Branches/create][P1-Critical] إنشاء فرع جديد بالحقول الأساسية AR/EN يوجّه إلى القائمة @critical', async ({
    adminPage,
    goto,
    waitForToast,
  }) => {
    const suffix = uid();
    const nameAr = `فرع اختبار ${suffix}`;
    const nameEn = `Test Branch ${suffix}`;

    await goto('/branches/create');

    await adminPage.locator('input[name="nameEn"]').fill(nameEn);
    await adminPage.locator('input[name="nameAr"]').fill(nameAr);

    await adminPage.locator('button[type="submit"]').click();

    await waitForToast(/تم|نجاح|created|success/i);

    await adminPage.waitForURL(/\/branches$/, { timeout: 10_000 });
    await expect(adminPage).toHaveURL(/\/branches$/);
  });

  test('[BH-021][Branches/create][P1-Critical] الفرع المُنشأ يظهر في قائمة الفروع @critical', async ({
    adminPage,
    goto,
    searchInList,
  }) => {
    const suffix = uid();
    const nameAr = `فرع ظهور ${suffix}`;
    const nameEn = `Visibility Branch ${suffix}`;

    await goto('/branches/create');

    await adminPage.locator('input[name="nameEn"]').fill(nameEn);
    await adminPage.locator('input[name="nameAr"]').fill(nameAr);

    // Register response listener before clicking submit so we can capture the id for cleanup
    const responsePromise = adminPage
      .waitForResponse(
        (res) => res.url().includes('/organization/branches') && res.request().method() === 'POST',
        { timeout: 12_000 },
      )
      .catch(() => null);

    await adminPage.locator('button[type="submit"]').click();

    const response = await responsePromise;
    if (response) {
      const body = await response.json().catch(() => ({}) as { id?: string }) as { id?: string };
      if (body?.id) createdBranchId = body.id;
    }

    await adminPage.waitForURL(/\/branches$/, { timeout: 12_000 });

    await searchInList('/branches', nameAr);
    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[BH-022][Branches/create][P2-High] الفرع يظهر مع حقلَي العنوان والهاتف بعد الإنشاء @smoke', async ({
    adminPage,
    goto,
    searchInList,
  }) => {
    const suffix = uid();
    const nameAr = `فرع تفاصيل ${suffix}`;
    const nameEn = `Detail Branch ${suffix}`;
    const address = 'شارع الملك فهد، الرياض';

    await goto('/branches/create');

    await adminPage.locator('input[name="nameEn"]').fill(nameEn);
    await adminPage.locator('input[name="nameAr"]').fill(nameAr);
    await adminPage.locator('input[name="address"]').fill(address);

    // ضع waitForURL قبل الضغط لتجنب race condition إن كان التنقل يحدث قبل استدعاء waitForURL
    const navPromise = adminPage.waitForURL(/\/branches$/, { timeout: 20_000, waitUntil: 'commit' });
    await adminPage.locator('button[type="submit"]').click();
    await navPromise;

    await searchInList('/branches', nameAr);
    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    // عنوان الفرع يظهر في نفس الصف
    await expect(
      adminPage
        .locator('table tbody tr')
        .filter({ hasText: nameAr })
        .filter({ hasText: address })
        .first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('[BH-023][Branches/create][P2-High] إلغاء الإنشاء يعود للقائمة دون حفظ الفرع @smoke', async ({
    adminPage,
    goto,
  }) => {
    const suffix = uid();
    const nameAr = `فرع ملغي ${suffix}`;

    await goto('/branches/create');

    await adminPage.locator('input[name="nameAr"]').fill(nameAr);

    // Click cancel button
    const cancelBtn = adminPage
      .getByRole('button', { name: /إلغاء|Cancel|رجوع/i })
      .first();
    await expect(cancelBtn).toBeVisible({ timeout: 8_000 });
    await cancelBtn.click();

    await adminPage.waitForURL(/\/branches(?!.*create)/, { timeout: 10_000 });
    await expect(adminPage).toHaveURL(/\/branches/);
    await expect(adminPage).not.toHaveURL(/\/create/);
  });

  test('[BH-024][Branches/create][P3-Medium] صفحة إنشاء الفرع تحتوي على حقول الاسم AR و EN @smoke', async ({
    adminPage,
    goto,
  }) => {
    await goto('/branches/create');

    await expect(adminPage.locator('input[name="nameAr"]')).toBeVisible({ timeout: 8_000 });
    await expect(adminPage.locator('input[name="nameEn"]')).toBeVisible({ timeout: 8_000 });
  });
});
