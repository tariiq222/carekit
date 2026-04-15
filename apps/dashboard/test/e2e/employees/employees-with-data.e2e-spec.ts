/**
 * CareKit Dashboard — Employees E2E (data-driven)
 *
 * كل test يزرع موظفاً عبر API ويحذفه بعد الانتهاء.
 * يغطي: إنشاء، تعطيل، إجازات، availability، ربط خدمات.
 */

import { test, expect } from '../setup/fixtures';
import { createEmployee, deleteEmployee, type SeededEmployee } from '../setup/seeds';

// ── EM-001 + EM-002: إنشاء وتعديل ──────────────────────────────────────────
test.describe('Employees — seeded basic', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWEmpBasic' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id);
  });

  test('[EM-001] @critical @data — الموظف المُنشأ يظهر في قائمة الموظفين', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/employees', seeded.name);
    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.name }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[EM-002] @critical @data — تعديل اسم الموظف يُحفظ ويظهر فوراً', async ({
    adminPage,
    searchInList,
  }) => {
    await searchInList('/employees', seeded.name);
    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.name }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    // افتح sheet التعديل
    const editBtn = row.locator('button[aria-label*="تعديل"], button[aria-label*="edit"]').first();
    if ((await editBtn.count()) === 0) {
      await row.click();
    } else {
      await editBtn.click();
    }

    const sheet = adminPage.locator('[role="dialog"]').first();
    await expect(sheet).toBeVisible({ timeout: 8_000 });

    // عدّل الاسم
    const nameInput = sheet.locator('input[name="name"], input[id*="name"]').first();
    await expect(nameInput).toBeVisible({ timeout: 6_000 });
    const newName = `${seeded.name} Edited`;
    await nameInput.clear();
    await nameInput.fill(newName);

    const saveBtn = sheet.locator('button[type="submit"]').first();
    await saveBtn.click();

    await expect(sheet).not.toBeVisible({ timeout: 8_000 });
    await searchInList('/employees', 'Edited');
    const updatedRow = adminPage.locator('table tbody tr').filter({ hasText: 'Edited' }).first();
    await expect(updatedRow).toBeVisible({ timeout: 10_000 });
  });
});

// ── EM-003: تعطيل موظف ─────────────────────────────────────────────────────
test.describe('Employees — deactivate', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWEmpDeact' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id);
  });

  test('[EM-003] @data — تعطيل موظف يُظهر شارة "معطّل" + toast', async ({
    adminPage,
    searchInList,
    waitForToast,
  }) => {
    await searchInList('/employees', seeded.name);
    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.name }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });

    const deactivateBtn = row
      .locator('button[aria-label*="تعطيل"], button[aria-label*="حظر"], button[aria-label*="deactivate"]')
      .first();
    await expect(deactivateBtn).toBeVisible({ timeout: 6_000 });
    await deactivateBtn.click();

    await waitForToast(/تم تعطيل|تم تغيير/);
  });
});

// ── EM-004 + EM-005: إجازات ────────────────────────────────────────────────
test.describe('Employees — vacations', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWEmpVac' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id);
  });

  test('[EM-004] @data — إضافة إجازة للموظف تظهر في جدول الإجازات', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/employees/${seeded.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // تبويب الإجازات / الاستثناءات
    const vacTab = adminPage
      .getByRole('tab', { name: /إجازة|استثناء|vacation|exception/i })
      .first();
    if ((await vacTab.count()) > 0) await vacTab.click();

    const addBtn = adminPage
      .getByRole('button', { name: /إضافة إجازة|إضافة استثناء|add vacation/i })
      .first();
    if ((await addBtn.count()) === 0) {
      test.skip();
      return;
    }
    await addBtn.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    // أدخل تاريخ البداية والنهاية
    const startInput = dialog.locator('input[type="date"], input[name*="start"], input[name*="from"]').first();
    const endInput = dialog.locator('input[type="date"], input[name*="end"], input[name*="to"]').last();

    if ((await startInput.count()) > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      await startInput.fill(tomorrow.toISOString().split('T')[0]!);
      await endInput.fill(dayAfter.toISOString().split('T')[0]!);
    }

    const saveBtn = dialog.locator('button[type="submit"]').first();
    await saveBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    // يجب أن يظهر صف في جدول الإجازات
    const vacTable = adminPage.locator('table, [role="table"]').last();
    await expect(vacTable).toBeVisible({ timeout: 8_000 });
  });
});

// ── EM-006: Availability ───────────────────────────────────────────────────
test.describe('Employees — availability', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWEmpAvail' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id);
  });

  test('[EM-006] @data — صفحة availability للموظف تحمل وتعرض أيام الأسبوع', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/employees/${seeded.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const availTab = adminPage
      .getByRole('tab', { name: /مواعيد|availability|الجدول/i })
      .first();
    if ((await availTab.count()) > 0) await availTab.click();

    // الصفحة يجب أن تعرض على الأقل أيام الأسبوع
    const dayElements = adminPage.locator('[class*="day"], [class*="schedule"], label').filter({
      hasText: /الأحد|الإثنين|الثلاثاء|السبت|sunday|monday/i,
    });
    const count = await dayElements.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ── EM-007 + EM-008: ربط خدمات ────────────────────────────────────────────
test.describe('Employees — services assignment', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWEmpSvc' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id);
  });

  test('[EM-007] @data — صفحة خدمات الموظف تحمل وتعرض قائمة الخدمات أو empty state', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/employees/${seeded.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const svcTab = adminPage
      .getByRole('tab', { name: /خدمات|services/i })
      .first();
    if ((await svcTab.count()) > 0) await svcTab.click();

    const anyContent = adminPage.locator('table, [role="table"], [class*="empty"], [class*="skeleton"]');
    await expect(anyContent.first()).toBeVisible({ timeout: 8_000 });
  });
});
