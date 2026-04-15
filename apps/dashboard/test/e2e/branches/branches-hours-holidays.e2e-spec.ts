/**
 * CareKit Dashboard — Branches Hours & Holidays (BH-050 – BH-054)
 *
 * يغطي: ضبط ساعات العمل الأسبوعية، إضافة عطلة، وحذف عطلة.
 *
 * حالة التنفيذ: واجهة ساعات العمل والعطلات للفروع غير موجودة حالياً في
 * مسار branches — النماذج والـ routes المتاحة هي create وedit فقط (بدون
 * تبويب hours أو holidays). جميع الاختبارات في هذا الملف موسومة بـ skip
 * مع سبب واضح، وستُفعَّل فور إضافة الواجهة.
 *
 * الشرائح: hours, holidays
 */

import { test, expect } from '../setup/fixtures';
import { createBranch, deleteBranch, type SeededBranch } from '../setup/seeds';
import { uid } from '../setup/seeds/seed-base';

test.describe('Branches — working hours', () => {
  let branch: SeededBranch;

  test.beforeEach(async () => {
    branch = await createBranch({
      nameAr: `فرع ساعات ${uid()}`,
      nameEn: `Hours Branch ${uid()}`,
    });
  });

  test.afterEach(async () => {
    if (branch?.id) await deleteBranch(branch.id).catch(() => {});
  });

  test('[BH-050][Branches/hours][P2-High] تعيين ساعات العمل لكل يوم من أيام الأسبوع @smoke', async ({
    adminPage: _page,
  }) => {
    test.skip(true, 'واجهة ساعات العمل غير موجودة في branches UI — route /branches/[id]/hours لم يُنشأ بعد');
    // When implemented:
    // await goto(`/branches/${branch.id}/hours`);
    // Fill start/end time per day, save, assert persisted.
    void expect(true).toBe(true);
  });

  test('[BH-051][Branches/hours][P3-Medium] إيقاف يوم عمل يُزيله من الجدول @smoke', async ({
    adminPage: _page,
  }) => {
    test.skip(true, 'واجهة ساعات العمل غير موجودة في branches UI — route /branches/[id]/hours لم يُنشأ بعد');
    void expect(true).toBe(true);
  });
});

test.describe('Branches — holidays', () => {
  let branch: SeededBranch;

  test.beforeEach(async () => {
    branch = await createBranch({
      nameAr: `فرع عطلة ${uid()}`,
      nameEn: `Holiday Branch ${uid()}`,
    });
  });

  test.afterEach(async () => {
    if (branch?.id) await deleteBranch(branch.id).catch(() => {});
  });

  test('[BH-052][Branches/holidays][P2-High] إضافة تاريخ عطلة يظهر في قائمة العطلات @smoke', async ({
    adminPage: _page,
  }) => {
    test.skip(true, 'واجهة العطلات غير موجودة في branches UI — لا يوجد مكوّن holidays أو route مخصص');
    void expect(true).toBe(true);
  });

  test('[BH-053][Branches/holidays][P2-High] حذف عطلة يُزيلها من القائمة @smoke', async ({
    adminPage: _page,
  }) => {
    test.skip(true, 'واجهة العطلات غير موجودة في branches UI — لا يوجد مكوّن holidays أو route مخصص');
    void expect(true).toBe(true);
  });

  test('[BH-054][Branches/holidays][P3-Medium] العطلة تحجب الحجوزات في ذلك التاريخ (cross-module) @smoke', async ({
    adminPage: _page,
  }) => {
    test.skip(true, 'خارج نطاق الاختبار — هذا السلوك غير مرئي في branches UI، يختبَر في bookings E2E');
    void expect(true).toBe(true);
  });
});
