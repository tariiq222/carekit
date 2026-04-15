/**
 * CareKit Dashboard — Branches Staff & Services (BH-060 – BH-064)
 *
 * يغطي: إسناد موظف لفرع عبر نافذة الموظفين، إزالته، وربط خدمة بفرع.
 *
 * حالة التنفيذ:
 * - BranchEmployeesDialog موجود لكنه عرض فقط (يعرض "لا يوجد موظفون") —
 *   لا يحتوي على واجهة إضافة/إزالة موظف بعد.
 * - ربط الخدمة بالفرع يتم من صفحة الخدمة (service-branch feature flag)،
 *   وليس من صفحة الفرع.
 *
 * الاختبارات المُتاحة تختبر ما يعمل فعلاً في الواجهة الحالية.
 *
 * الشرائح: staff, services
 */

import { test, expect } from '../setup/fixtures';
import { createBranch, deleteBranch, type SeededBranch } from '../setup/seeds';
import { uid } from '../setup/seeds/seed-base';

test.describe('Branches — employees dialog', () => {
  let branch: SeededBranch;

  test.beforeEach(async () => {
    branch = await createBranch({
      nameAr: `فرع موظفون ${uid()}`,
      nameEn: `Staff Branch ${uid()}`,
    });
  });

  test.afterEach(async () => {
    if (branch?.id) await deleteBranch(branch.id).catch(() => {});
  });

  test('[BH-060][Branches/staff][P2-High] النقر على "موظفون" يفتح نافذة عرض الموظفين @smoke', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/branches', branch.nameAr);

    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: branch.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    // Open the actions dropdown
    const actionsTrigger = row.locator('button').last();
    await actionsTrigger.click();

    const employeesItem = adminPage
      .locator('[role="menuitem"]')
      .filter({ hasText: /الممارسون|Employees/i })
      .first();
    await expect(employeesItem).toBeVisible({ timeout: 6_000 });
    await employeesItem.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });
  });

  test('[BH-061][Branches/staff][P2-High] نافذة الموظفين تعرض عنوانها مع اسم الفرع @smoke', async ({
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

    const employeesItem = adminPage
      .locator('[role="menuitem"]')
      .filter({ hasText: /الممارسون|Employees/i })
      .first();
    await employeesItem.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // Dialog title contains the branch name
    await expect(dialog.getByText(branch.nameAr)).toBeVisible({ timeout: 6_000 });
  });

  test('[BH-062][Branches/staff][P3-Medium] إغلاق نافذة الموظفين يعيد للقائمة دون تغيير @smoke', async ({
    adminPage,
    searchInList,
    closeDialog,
  }) => {
    await searchInList('/branches', branch.nameAr);

    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: branch.nameAr })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const actionsTrigger = row.locator('button').last();
    await actionsTrigger.click();

    const employeesItem = adminPage
      .locator('[role="menuitem"]')
      .filter({ hasText: /الممارسون|Employees/i })
      .first();
    await employeesItem.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    await closeDialog();

    await expect(dialog).not.toBeVisible({ timeout: 6_000 });

    // Branch row still visible after closing dialog
    const rowAfter = adminPage
      .locator('table tbody tr')
      .filter({ hasText: branch.nameAr })
      .first();
    await expect(rowAfter).toBeVisible({ timeout: 8_000 });
  });

  test('[BH-063][Branches/staff][P3-Medium] إسناد موظف لفرع من واجهة الموظفين @smoke', async ({
    adminPage: _page,
  }) => {
    test.skip(true, 'BranchEmployeesDialog الحالية عرض فقط — لا تحتوي على واجهة إضافة موظف بعد');
    void expect(true).toBe(true);
  });

  test('[BH-064][Branches/services][P3-Medium] ربط خدمة بفرع من واجهة الفرع @smoke', async ({
    adminPage: _page,
  }) => {
    test.skip(true, 'ربط الخدمة بالفرع يتم من صفحة الخدمة (feature flag) وليس من صفحة الفرع — راجع service-branch-feature-flag.e2e-spec.ts');
    void expect(true).toBe(true);
  });
});
