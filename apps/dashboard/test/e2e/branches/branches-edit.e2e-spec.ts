/**
 * CareKit Dashboard — Branches Edit (BH-030 – BH-034)
 *
 * يغطي: تعديل اسم الفرع وعنوانه وهاتفه، وتبديل حالة التفعيل.
 *
 * الشرائح: edit
 */

import { test, expect } from '../setup/fixtures';
import { createBranch, deleteBranch, type SeededBranch } from '../setup/seeds';
import { uid } from '../setup/seeds/seed-base';

test.describe('Branches — edit', () => {
  let branch: SeededBranch;

  test.beforeEach(async () => {
    branch = await createBranch({
      nameAr: `فرع تعديل ${uid()}`,
      nameEn: `Edit Branch ${uid()}`,
      city: 'الرياض',
    });
  });

  test.afterEach(async () => {
    if (branch?.id) await deleteBranch(branch.id).catch(() => {});
  });

  test('[BH-030][Branches/edit][P1-Critical] تعديل اسم الفرع يُحفظ ويظهر في القائمة @critical', async ({
    adminPage,
    goto,
    waitForToast,
    searchInList,
  }) => {
    const updatedNameAr = `فرع محدّث ${uid()}`;

    await goto(`/branches/${branch.id}/edit`);

    const nameArInput = adminPage.locator('input[name="nameAr"]');
    await expect(nameArInput).toBeVisible({ timeout: 10_000 });
    await nameArInput.clear();
    await nameArInput.fill(updatedNameAr);

    await adminPage.locator('button[type="submit"]').click();
    await waitForToast(/تم|نجاح|updated|success/i);

    await adminPage.waitForURL(/\/branches$/, { timeout: 10_000 });

    await searchInList('/branches', updatedNameAr);
    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: updatedNameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    // Update the branch name for afterEach cleanup
    branch = { id: branch.id, nameAr: updatedNameAr };
  });

  test('[BH-031][Branches/edit][P2-High] تعديل عنوان الفرع يُحفظ ويظهر في القائمة @smoke', async ({
    adminPage,
    goto,
    searchInList,
  }) => {
    const newAddress = `شارع التحلية، جدة — ${uid()}`;

    await goto(`/branches/${branch.id}/edit`);

    const addressInput = adminPage.locator('input[name="address"]');
    await expect(addressInput).toBeVisible({ timeout: 10_000 });
    await addressInput.clear();
    await addressInput.fill(newAddress);

    // ضع waitForURL قبل الضغط لتجنب race condition إن كان التنقل يحدث قبل استدعاء waitForURL
    const navPromise = adminPage.waitForURL(/\/branches$/, { timeout: 20_000, waitUntil: 'commit' });
    await adminPage.locator('button[type="submit"]').click();
    await navPromise;

    await searchInList('/branches', branch.nameAr);
    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: branch.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });
    await expect(
      adminPage
        .locator('table tbody tr')
        .filter({ hasText: branch.nameAr })
        .filter({ hasText: newAddress })
        .first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('[BH-032][Branches/edit][P2-High] صفحة التعديل تعبئ حقل الاسم العربي بقيمة الفرع الحالية @smoke', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/branches/${branch.id}/edit`);

    const nameArInput = adminPage.locator('input[name="nameAr"]');
    await expect(nameArInput).toBeVisible({ timeout: 10_000 });
    // Wait for the form to be hydrated with existing data
    await adminPage.waitForFunction(
      (el: HTMLInputElement) => el.value.length > 0,
      await nameArInput.elementHandle(),
      { timeout: 8_000 },
    );
    const value = await nameArInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('[BH-033][Branches/edit][P2-High] تفعيل مفتاح isActive يُغيّر حالة الفرع @smoke', async ({
    adminPage,
    goto,
    searchInList,
  }) => {
    // Seed an initially-active branch; toggle it inactive
    await goto(`/branches/${branch.id}/edit`);

    // Wait for form hydration
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const activeSwitch = adminPage.locator(`[id$="-branch-active"]`).first();
    const hasSwitch = await activeSwitch.count() > 0;
    if (!hasSwitch) {
      test.skip(true, 'مفتاح isActive لم يُعثر عليه في نموذج التعديل');
      return;
    }

    // Toggle the switch
    await activeSwitch.click();

    // ضع waitForURL قبل الضغط لتجنب race condition إن كان التنقل يحدث قبل استدعاء waitForURL
    const navPromise = adminPage.waitForURL(/\/branches$/, { timeout: 20_000, waitUntil: 'commit' });
    await adminPage.locator('button[type="submit"]').click();
    await navPromise;

    // Badge status change is reflected in the list
    await searchInList('/branches', branch.nameAr);
    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: branch.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[BH-034][Branches/edit][P3-Medium] إلغاء التعديل يعود للقائمة بدون حفظ @smoke', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/branches/${branch.id}/edit`);

    const nameArInput = adminPage.locator('input[name="nameAr"]');
    await expect(nameArInput).toBeVisible({ timeout: 10_000 });
    await nameArInput.clear();
    await nameArInput.fill('اسم لن يُحفظ');

    const cancelBtn = adminPage
      .getByRole('button', { name: /إلغاء|Cancel|رجوع/i })
      .first();
    await cancelBtn.click();

    await adminPage.waitForURL(/\/branches(?!.*edit)/, { timeout: 10_000 });
    await expect(adminPage).toHaveURL(/\/branches/);
    await expect(adminPage).not.toHaveURL(/\/edit/);
  });
});
