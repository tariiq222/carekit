/**
 * CareKit Dashboard — Branches Delete (BH-040 – BH-044)
 *
 * يغطي: حذف فرع مع تأكيد Toast، وإلغاء عملية الحذف من نافذة التأكيد.
 *
 * ملاحظة تقنية: delete-branch-dialog.tsx الحالي يستدعي toast.error مباشرةً
 * (الخاصية لم تُنفَّذ بالكامل في الـ backend بعد) — نختبر ما هو متاح فعلياً
 * في الواجهة دون اختراع سلوك غير موجود.
 *
 * الشرائح: delete
 */

import { test, expect } from '../setup/fixtures';
import { createBranch, deleteBranch, type SeededBranch } from '../setup/seeds';
import { uid } from '../setup/seeds/seed-base';

test.describe('Branches — delete', () => {
  let branch: SeededBranch;

  test.beforeEach(async () => {
    branch = await createBranch({
      nameAr: `فرع حذف ${uid()}`,
      nameEn: `Delete Branch ${uid()}`,
    });
  });

  test.afterEach(async () => {
    // Best-effort: branch may already be deleted
    if (branch?.id) await deleteBranch(branch.id).catch(() => {});
  });

  test('[BH-040][Branches/delete][P1-Critical] النقر على حذف يفتح نافذة تأكيد AlertDialog @critical', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/branches', branch.nameAr);

    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: branch.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    // Open the row actions dropdown
    const actionsTrigger = row.locator('button').last();
    await actionsTrigger.click();

    const deleteItem = adminPage
      .locator('[role="menuitem"]')
      .filter({ hasText: /حذف|Delete/i })
      .first();
    await expect(deleteItem).toBeVisible({ timeout: 6_000 });
    await deleteItem.click();

    const dialog = adminPage.locator('[role="alertdialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });
  });

  test('[BH-041][Branches/delete][P1-Critical] تأكيد الحذف يُطلق toast @critical', async ({
    adminPage,
    searchInList,
    waitForToast,
  }) => {
    await searchInList('/branches', branch.nameAr);

    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: branch.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const actionsTrigger = row.locator('button').last();
    await actionsTrigger.click();

    const deleteItem = adminPage
      .locator('[role="menuitem"]')
      .filter({ hasText: /حذف|Delete/i })
      .first();
    await expect(deleteItem).toBeVisible({ timeout: 6_000 });
    await deleteItem.click();

    const dialog = adminPage.locator('[role="alertdialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // Click the confirm/destructive action button
    const confirmBtn = dialog
      .locator('button')
      .filter({ hasText: /حذف|تأكيد|Delete|Confirm/i })
      .last();
    await confirmBtn.click();

    // The current UI fires toast.error (stub) — accept any toast
    await waitForToast(/./i);
  });

  test('[BH-042][Branches/delete][P2-High] إلغاء الحذف يُغلق النافذة ويُبقي الفرع في القائمة @smoke', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/branches', branch.nameAr);

    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: branch.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const actionsTrigger = row.locator('button').last();
    await actionsTrigger.click();

    const deleteItem = adminPage
      .locator('[role="menuitem"]')
      .filter({ hasText: /حذف|Delete/i })
      .first();
    await expect(deleteItem).toBeVisible({ timeout: 6_000 });
    await deleteItem.click();

    const dialog = adminPage.locator('[role="alertdialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // Click the cancel button
    const cancelBtn = dialog
      .locator('button')
      .filter({ hasText: /إلغاء|Cancel/i })
      .first();
    await cancelBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 6_000 });

    // Branch must still be visible in the list
    await searchInList('/branches', branch.nameAr);
    await expect(
      adminPage
        .locator('table tbody tr')
        .filter({ hasText: branch.nameAr })
        .first(),
    ).toBeVisible({ timeout: 12_000 });
  });

  test('[BH-043][Branches/delete][P2-High] نافذة الحذف تعرض اسم الفرع في وصف التأكيد @smoke', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/branches', branch.nameAr);

    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: branch.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const actionsTrigger = row.locator('button').last();
    await actionsTrigger.click();

    const deleteItem = adminPage
      .locator('[role="menuitem"]')
      .filter({ hasText: /حذف|Delete/i })
      .first();
    await deleteItem.click();

    const dialog = adminPage.locator('[role="alertdialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // The dialog description should reference the branch name
    await expect(dialog.getByText(branch.nameAr)).toBeVisible({ timeout: 6_000 });
  });

  test('[BH-044][Branches/delete][P3-Medium] محاولة حذف فرع يُظهر رسالة خطأ عند رفض الـ backend (سلوك موجود حالياً) @smoke', async ({
    adminPage,
    searchInList,
    waitForToast,
  }) => {
    // The current implementation (delete-branch-dialog.tsx) always fires toast.error
    // This test asserts that the error/stub toast fires so we don't regress
    await searchInList('/branches', branch.nameAr);

    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: branch.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const actionsTrigger = row.locator('button').last();
    await actionsTrigger.click();

    const deleteItem = adminPage
      .locator('[role="menuitem"]')
      .filter({ hasText: /حذف|Delete/i })
      .first();
    await deleteItem.click();

    const dialog = adminPage.locator('[role="alertdialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    const confirmBtn = dialog
      .locator('button')
      .filter({ hasText: /حذف|تأكيد|Delete|Confirm/i })
      .last();
    await confirmBtn.click();

    // Current stub fires toast.error — verify a toast fires
    await waitForToast(/./i);
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });
});
