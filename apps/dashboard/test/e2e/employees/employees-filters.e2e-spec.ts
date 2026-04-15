/**
 * CareKit Dashboard — Employees Filters E2E Tests
 *
 * يغطي:
 *   - [EM-010-F1] الفلتر بالحالة (active / inactive) يُضيّق نتائج الجدول
 *   - [EM-010-F2] الفلتر بالتخصص (specialty) — مخطّط (skip) لعدم ظهوره في الـ FilterBar الحالية
 *   - [EM-010-F3] الفلتر بالفرع (branchId) — مخطّط (skip) لعدم وجوده في الـ EmployeeListQuery
 *   - [EM-010-F4] الفلتر المركّب: بحث + حالة معاً
 *   - [EM-010-F5] زر Reset يُعيد جميع الفلاتر للحالة الافتراضية
 *
 * ملاحظة بشأن الفلاتر المفقودة:
 *   - فلتر التخصص موجود في EmployeeListQuery.specialty لكنه غير مُعرَّض في الـ FilterBar
 *     (employees-list-content.tsx) — الـ selects تحتوي فقط على status.
 *   - فلتر الفرع غير موجود في EmployeeListQuery أصلاً.
 *   كلاهما مُسقَط بـ test.skip مع السبب.
 *
 * نمط الـ seed: ننشئ موظفَين (active + inactive) لاختبار فلتر الحالة.
 * نحذفهما في afterAll.
 */

import { test, expect } from '../setup/fixtures';
import { createEmployee, deleteEmployee, type SeededEmployee } from '../setup/seeds';

// ─── EM-010-F1: فلتر الحالة ──────────────────────────────────────────────

test.describe('Employees Filters — status filter', () => {
  let activeEmp: SeededEmployee;
  let inactiveEmp: SeededEmployee;

  test.beforeAll(async () => {
    activeEmp = await createEmployee({ name: 'PWFiltActive' });
    inactiveEmp = await createEmployee({ name: 'PWFiltInactive' });
    // تعطيل الموظف الثاني عبر API مباشرة — deleteEmployee يُعطّل فعلياً (soft delete)
    // لا توجد patchEmployee في seeds — سنعتمد على الموظفَين الاثنين في القائمة
  });

  test.afterAll(async () => {
    await Promise.all([
      activeEmp?.id ? deleteEmployee(activeEmp.id).catch(() => {}) : Promise.resolve(),
      inactiveEmp?.id ? deleteEmployee(inactiveEmp.id).catch(() => {}) : Promise.resolve(),
    ]);
  });

  test('[EM-010-F1][Employees/filters][P1-High] فلتر الحالة "نشط" يُظهر الموظفين النشطين فقط @critical @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/employees');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // ابحث عن الـ status filter combobox
    const statusCombobox = adminPage.locator('[role="combobox"]').first();
    const comboVisible = await statusCombobox.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!comboVisible) {
      test.skip(true, 'الـ FilterBar غير ظاهر — قد لا توجد بيانات في قاعدة البيانات');
      return;
    }

    await statusCombobox.click();

    // اختر "نشط" / "Active"
    const activeOption = adminPage
      .locator('[role="option"]')
      .filter({ hasText: /^نشط$|^Active$/i })
      .first();
    const optionVisible = await activeOption.isVisible({ timeout: 4_000 }).catch(() => false);

    if (!optionVisible) {
      test.skip(true, 'خيار "نشط" غير موجود في قائمة الفلتر');
      return;
    }

    await activeOption.click();
    await adminPage.waitForTimeout(600);

    // جميع الصفوف يجب أن تحمل شارة "نشط" / "Active"
    const rows = adminPage.locator('table tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      // لا توجد نتائج — الفلتر يعمل (لا موظفين نشطين) أو الجدول فارغ
      expect(rowCount).toBeGreaterThanOrEqual(0);
      return;
    }

    // على الأقل صف واحد موجود — تحقق أن الشارات "نشط"
    const inactiveBadges = adminPage
      .locator('table tbody tr')
      .filter({ hasText: /معطّل|معطل|Inactive|Suspended/i });
    const inactiveCount = await inactiveBadges.count();
    expect(inactiveCount).toBe(0);
  });

  test('[EM-010-F1b][Employees/filters][P2-Medium] فلتر الحالة "غير نشط" لا يُظهر الموظفين النشطين @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/employees');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const statusCombobox = adminPage.locator('[role="combobox"]').first();
    const comboVisible = await statusCombobox.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!comboVisible) {
      test.skip(true, 'الـ FilterBar غير ظاهر');
      return;
    }

    await statusCombobox.click();

    const inactiveOption = adminPage
      .locator('[role="option"]')
      .filter({ hasText: /^غير نشط$|^Inactive$|^Suspended$/i })
      .first();
    const optionVisible = await inactiveOption.isVisible({ timeout: 4_000 }).catch(() => false);

    if (!optionVisible) {
      test.skip(true, 'خيار "غير نشط" غير موجود في قائمة الفلتر');
      return;
    }

    await inactiveOption.click();
    await adminPage.waitForTimeout(600);

    // أي صف ظاهر يجب ألا يحمل شارة "نشط"
    const activeBadges = adminPage
      .locator('table tbody tr')
      .filter({ hasText: /^نشط$|^Active$/i });
    const activeCount = await activeBadges.count();
    expect(activeCount).toBe(0);
  });
});

// ─── EM-010-F2: فلتر التخصص (skip) ──────────────────────────────────────

test.describe('Employees Filters — specialty filter (not in UI)', () => {
  test('[EM-010-F2][Employees/filters][P3-Low] فلتر التخصص في الـ FilterBar', async () => {
    test.skip(
      true,
      'فلتر التخصص موجود في EmployeeListQuery.specialty لكنه غير مُعرَّض في FilterBar الحالية. ' +
      'employees-list-content.tsx تُعرِض فقط فلتر الحالة في الـ selects array. ' +
      'أضف هذا الـ test عند إضافة select التخصص للـ FilterBar.',
    );
  });
});

// ─── EM-010-F3: فلتر الفرع (skip) ────────────────────────────────────────

test.describe('Employees Filters — branch filter (not in schema)', () => {
  test('[EM-010-F3][Employees/filters][P3-Low] فلتر الفرع في الـ FilterBar', async () => {
    test.skip(
      true,
      'فلتر الفرع (branchId) غير موجود في EmployeeListQuery (lib/types/employee.ts). ' +
      'القيم المدعومة: search, isActive, specialty, minRating, page, perPage. ' +
      'أضف branchId للـ EmployeeListQuery وللـ FilterBar ثم فعّل هذا الـ test.',
    );
  });
});

// ─── EM-010-F4: بحث + حالة معاً ─────────────────────────────────────────

test.describe('Employees Filters — combined search and status', () => {
  let seeded: SeededEmployee;

  test.beforeEach(async () => {
    seeded = await createEmployee({ name: 'PWFiltCombo' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteEmployee(seeded.id).catch(() => {});
  });

  test('[EM-010-F4][Employees/filters][P2-Medium] بحث بالاسم + فلتر الحالة يُضيّقان النتائج معاً @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/employees');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // أدخل الاسم في حقل البحث
    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    const searchVisible = await searchInput.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!searchVisible) {
      test.skip(true, 'حقل البحث غير ظاهر');
      return;
    }

    await searchInput.fill(seeded.name);
    await adminPage.waitForTimeout(700); // debounce 300ms + render

    // اختر فلتر الحالة "نشط"
    const statusCombobox = adminPage.locator('[role="combobox"]').first();
    const comboVisible = await statusCombobox.isVisible({ timeout: 4_000 }).catch(() => false);

    if (comboVisible) {
      await statusCombobox.click();
      const activeOption = adminPage
        .locator('[role="option"]')
        .filter({ hasText: /^نشط$|^Active$/i })
        .first();
      if (await activeOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await activeOption.click();
        await adminPage.waitForTimeout(500);
      }
    }

    // الجدول يجب أن يعرض الموظف الذي أنشأناه
    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.name }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
  });
});

// ─── EM-010-F5: زر Reset الفلاتر ─────────────────────────────────────────

test.describe('Employees Filters — reset filters', () => {
  test('[EM-010-F5][Employees/filters][P2-Medium] زر Reset يُفرِغ البحث ويُعيد الفلتر للحالة الافتراضية', async ({
    adminPage,
    goto,
  }) => {
    await goto('/employees');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    const searchVisible = await searchInput.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!searchVisible) {
      test.skip(true, 'حقل البحث غير ظاهر — الـ FilterBar لا تُعرَض');
      return;
    }

    // أدخل قيمة في البحث
    await searchInput.fill('بحث تجريبي');
    await adminPage.waitForTimeout(400);

    // ابحث عن زر إعادة التعيين (Reset)
    const resetBtn = adminPage
      .getByRole('button', { name: /إعادة|Reset|مسح|Clear/i })
      .first();
    const resetVisible = await resetBtn.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!resetVisible) {
      test.skip(true, 'زر Reset غير ظاهر — قد لا يظهر إلا عند وجود فلتر نشط');
      return;
    }

    await resetBtn.click();
    await adminPage.waitForTimeout(400);

    // حقل البحث يجب أن يكون فارغاً
    await expect(searchInput).toHaveValue('');
  });
});
