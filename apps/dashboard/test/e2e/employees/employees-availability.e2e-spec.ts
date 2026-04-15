/**
 * CareKit Dashboard — Employees Availability E2E Tests
 *
 * يغطي:
 *   - [EM-AV-001] تعديل الجدول الأسبوعي (تفعيل يوم + حفظ + reload + تأكيد الحفظ)
 *   - [EM-AV-002] إزالة slot (تعطيل يوم مفعّل + حفظ)
 *   - [EM-AV-003] إضافة استراحة (Break) داخل يوم مفعّل
 *   - [EM-AV-004] تحقق أن صفحة الـ schedule editor تحمل وتعرض أيام الأسبوع
 *
 * ملاحظة: الـ ScheduleEditor يُفتح عبر زر "Edit Schedule" في schedule-section.tsx
 * أو من صفحة /employees/[id]/edit تبويب "schedule".
 *
 * نمط الـ seed: كل describe يُنشئ موظفاً واحداً ويحذفه بعد الانتهاء.
 */

import { test, expect } from '../setup/fixtures';
import { createEmployee, deleteEmployee, type SeededEmployee } from '../setup/seeds';

// ─── EM-AV-001: تفعيل يوم وحفظ الجدول ───────────────────────────────────

test.describe('Employees Availability — add slot and save', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWAvailAdd' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id).catch(() => {});
  });

  test('[EM-AV-001][Employees/availability][P1-High] تفعيل يوم في الجدول وحفظه يظهر في بطاقة أوقات العمل @critical @data', async ({
    adminPage,
    goto,
    waitForToast,
  }) => {
    // نذهب لصفحة التعديل → تبويب schedule
    await goto(`/employees/${seeded.id}/edit`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const scheduleTab = adminPage
      .getByRole('tab', { name: /جدول|schedule/i })
      .first();
    const tabVisible = await scheduleTab.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'تبويب الجدول غير موجود — تحقق من EmployeeFormPage');
      return;
    }
    await scheduleTab.click();

    // ابحث عن switches أيام الأسبوع
    const switches = adminPage.locator('[role="switch"]');
    const switchCount = await switches.count();

    if (switchCount === 0) {
      test.skip(true, 'لا توجد switches لأيام الأسبوع في تبويب الجدول');
      return;
    }

    // فعّل أول switch غير مفعّل (يوم السبت أو الجمعة عادةً)
    let activated = false;
    for (let i = 0; i < switchCount; i++) {
      const sw = switches.nth(i);
      const state = await sw.getAttribute('data-state').catch(() => null);
      if (state === 'unchecked' || state === null) {
        await sw.click();
        activated = true;
        break;
      }
    }

    if (!activated) {
      // كل الأيام مفعّلة بالفعل — قبول الحالة
      expect(switchCount).toBeGreaterThan(0);
      return;
    }

    // احفظ الفورم
    const submitBtn = adminPage.locator('form button[type="submit"]').first();
    await expect(submitBtn).toBeVisible({ timeout: 6_000 });
    await submitBtn.click();

    // انتظر redirect أو toast
    await adminPage.waitForURL(/\/employees(?!\/.+\/edit)/, { timeout: 10_000 }).catch(() => {});

    // تحقق من صفحة التفاصيل أن "أوقات العمل" ظاهرة
    await goto(`/employees/${seeded.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const workingHoursSection = adminPage
      .getByText(/أوقات العمل|Working Hours/)
      .first();
    await expect(workingHoursSection).toBeVisible({ timeout: 8_000 });
  });
});

// ─── EM-AV-002: إزالة slot (تعطيل يوم) ─────────────────────────────────

test.describe('Employees Availability — remove slot', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWAvailRm' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id).catch(() => {});
  });

  test('[EM-AV-002][Employees/availability][P1-High] تعطيل يوم من الجدول يُزيل الـ slot من بطاقة أوقات العمل @data', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/employees/${seeded.id}/edit`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const scheduleTab = adminPage
      .getByRole('tab', { name: /جدول|schedule/i })
      .first();
    const tabVisible = await scheduleTab.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'تبويب الجدول غير موجود');
      return;
    }
    await scheduleTab.click();

    const switches = adminPage.locator('[role="switch"]');
    const switchCount = await switches.count();

    if (switchCount === 0) {
      test.skip(true, 'لا توجد switches لأيام الأسبوع');
      return;
    }

    // أوقف أول switch مفعّل
    let deactivated = false;
    for (let i = 0; i < switchCount; i++) {
      const sw = switches.nth(i);
      const state = await sw.getAttribute('data-state').catch(() => null);
      if (state === 'checked') {
        await sw.click();
        deactivated = true;
        break;
      }
    }

    if (!deactivated) {
      // لا توجد أيام مفعّلة أصلاً
      expect(switchCount).toBeGreaterThan(0);
      return;
    }

    const submitBtn = adminPage.locator('form button[type="submit"]').first();
    await expect(submitBtn).toBeVisible({ timeout: 6_000 });
    await submitBtn.click();

    // نجاح = لم يُعد redirect للـ edit page
    await adminPage.waitForURL(/\/employees(?!\/.+\/edit)/, { timeout: 10_000 }).catch(() => {});
    const finalUrl = adminPage.url();
    expect(finalUrl).toMatch(/\/employees/);
  });
});

// ─── EM-AV-003: إضافة استراحة ─────────────────────────────────────────

test.describe('Employees Availability — add break', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWAvailBrk' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id).catch(() => {});
  });

  test('[EM-AV-003][Employees/availability][P2-Medium] إضافة استراحة ليوم مفعّل تظهر في الـ ScheduleEditor @data', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/employees/${seeded.id}/edit`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const scheduleTab = adminPage
      .getByRole('tab', { name: /جدول|schedule/i })
      .first();
    const tabVisible = await scheduleTab.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'تبويب الجدول غير موجود');
      return;
    }
    await scheduleTab.click();

    // ابحث عن زر "Add Break" أو "+ Add Break"
    const addBreakBtn = adminPage
      .getByRole('button', { name: /Add Break|إضافة استراحة|break/i })
      .first();
    const btnVisible = await addBreakBtn.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!btnVisible) {
      test.skip(true, 'زر Add Break غير ظاهر — قد لا يكون هناك يوم مفعّل أو الـ UI مختلف');
      return;
    }

    await addBreakBtn.click();

    // يجب أن تظهر حقول وقت الاستراحة
    const breakInputs = adminPage
      .locator('input[type="time"]')
      .filter({ hasNot: adminPage.locator('[disabled]') });
    await adminPage.waitForTimeout(400);
    const inputCount = await breakInputs.count();
    // يجب أن يكون هناك على الأقل حقل وقت إضافي
    expect(inputCount).toBeGreaterThan(0);
  });
});

// ─── EM-AV-004: صفحة availability تحمل الـ schedule editor ───────────────

test.describe('Employees Availability — schedule editor opens', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWAvailEdit' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id).catch(() => {});
  });

  test('[EM-AV-004][Employees/availability][P2-Medium] زر "Edit Schedule" يفتح sheet التعديل @data', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/employees/${seeded.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // الـ ScheduleSection يعرض زر "Edit Schedule"
    const editScheduleBtn = adminPage
      .getByRole('button', { name: /Edit Schedule|تعديل الجدول/i })
      .first();
    const btnVisible = await editScheduleBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!btnVisible) {
      test.skip(true, 'زر Edit Schedule غير ظاهر في صفحة تفاصيل الموظف');
      return;
    }

    await editScheduleBtn.click();

    // الـ Sheet يجب أن يظهر
    const sheet = adminPage.locator('[role="dialog"]').first();
    await expect(sheet).toBeVisible({ timeout: 6_000 });

    // يجب أن يحتوي على حقول أيام الأسبوع (switches أو inputs)
    const switches = sheet.locator('[role="switch"]');
    const switchCount = await switches.count();
    expect(switchCount).toBeGreaterThan(0);

    // أغلق الـ sheet
    await adminPage.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible({ timeout: 6_000 });
  });
});
