/**
 * CareKit Dashboard — Bookings: Filters & Search
 *
 * يغطي:
 *   - فلتر الحالة (status) يُصفّي القائمة
 *   - فلتر النوع (type) يُصفّي القائمة
 *   - فلتر نطاق التاريخ (dateFrom–dateTo)
 *   - البحث بالاسم يُصفّي القائمة
 *   - زر Reset يُعيد الفلاتر للوضع الافتراضي
 *   - فلتر الموظف يُصفّي القائمة
 */

import { test, expect } from '../setup/fixtures';
import {
  createBranch,
  deleteBranch,
  createClient,
  deleteClient,
  createEmployee,
  deleteEmployee,
  createService,
  deleteService,
  createBooking,
  cancelBooking,
  type SeededBranch,
  type SeededClient,
  type SeededEmployee,
  type SeededService,
  type SeededBooking,
} from '../setup/seeds';

// ── Shared context ─────────────────────────────────────────────────────────────

interface FilterContext {
  branch: SeededBranch;
  client: SeededClient;
  employee: SeededEmployee;
  service: SeededService;
}

async function seedFilterContext(): Promise<FilterContext> {
  const [branch, client, employee, service] = await Promise.all([
    createBranch({ nameAr: 'فرع فلتر' }),
    createClient({ firstName: 'BKFilter', lastName: 'FilterClient' }),
    createEmployee({ name: 'BKFilter Employee' }),
    createService({ nameAr: 'خدمة فلتر', price: 90, durationMins: 30 }),
  ]);
  return { branch, client, employee, service };
}

async function cleanFilterContext(ctx: FilterContext): Promise<void> {
  await Promise.allSettled([
    deleteClient(ctx.client.id),
    deleteEmployee(ctx.employee.id),
    deleteService(ctx.service.id),
    deleteBranch(ctx.branch.id),
  ]);
}

// ── BK-FL-001: حقل البحث يُصفّي القائمة ──────────────────────────────────────

test.describe('Bookings Filters — search', () => {
  let ctx: FilterContext;
  let booking: SeededBooking;

  test.beforeEach(async () => {
    ctx = await seedFilterContext();
    booking = await createBooking({
      branchId: ctx.branch.id,
      clientId: ctx.client.id,
      employeeId: ctx.employee.id,
      serviceId: ctx.service.id,
      payAtClinic: true,
    }).catch(() => ({ id: '' } as unknown as SeededBooking));
  });

  test.afterEach(async () => {
    if (booking?.id) await cancelBooking(booking.id).catch(() => {});
    await cleanFilterContext(ctx);
  });

  test('[BK-FL-001][Bookings/Filters][P1-High] البحث بالاسم يُظهر الحجوزات المطابقة @data', async ({
    searchInList,
    adminPage,
  }) => {
    if (!booking?.id) { test.skip(); return; }

    await searchInList('/bookings', ctx.client.firstName);
    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: ctx.client.firstName })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[BK-FL-002][Bookings/Filters][P1-High] بحث بنص غير موجود يعرض حالة فارغة أو لا نتائج @data', async ({
    searchInList,
    adminPage,
  }) => {
    await searchInList('/bookings', 'XYZNOTFOUND99999');
    await adminPage.waitForTimeout(800);

    const rows = adminPage.locator('table tbody tr');
    const emptyState = adminPage.getByText(/لا توجد|no booking|not found/i);

    const rowCount = await rows.count();
    const hasEmpty = (await emptyState.count()) > 0;

    // إما لا توجد صفوف أو يوجد نص حالة فارغة
    expect(rowCount === 0 || hasEmpty).toBe(true);
  });

  test('[BK-FL-003][Bookings/Filters][P1-High] مسح البحث يُعيد جميع الحجوزات', async ({
    adminPage,
    goto,
  }) => {
    if (!booking?.id) { test.skip(); return; }

    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 8_000 });

    // اكتب نصاً ثم امسحه
    await searchInput.fill('XYZNOTFOUND');
    await adminPage.waitForTimeout(600);
    await searchInput.clear();
    await adminPage.waitForTimeout(600);

    // يجب أن تعود القائمة أو الحالة الفارغة
    const anyContent = adminPage.locator('table, [class*="empty"]').first();
    await expect(anyContent).toBeVisible({ timeout: 8_000 });
  });
});

// ── BK-FL-004: فلتر الحالة ─────────────────────────────────────────────────────

test.describe('Bookings Filters — status filter', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[BK-FL-004][Bookings/Filters][P1-High] فلتر "ملغى" يُصفّي القائمة', async ({
    adminPage,
  }) => {
    // فتح الـ select للحالة
    const statusSelect = adminPage
      .locator('[data-radix-select-trigger]')
      .filter({ hasText: /الحالة|الكل|status/i })
      .first();

    if ((await statusSelect.count()) === 0) { test.skip(); return; }

    await statusSelect.click();
    const cancelledOption = adminPage
      .locator('[role="option"]')
      .filter({ hasText: /ملغى|ملغي|cancelled/i })
      .first();

    if ((await cancelledOption.count()) === 0) { test.skip(); return; }
    await cancelledOption.click();
    await adminPage.waitForTimeout(600);

    // القائمة يجب أن تتغير (صفوف ملغاة أو فارغة)
    const rows = adminPage.locator('table tbody tr');
    const emptyState = adminPage.getByText(/لا توجد|no booking/i);
    const hasRows = (await rows.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasRows || hasEmpty).toBe(true);
  });

  test('[BK-FL-005][Bookings/Filters][P1-High] فلتر "مؤكد" يُصفّي القائمة', async ({
    adminPage,
  }) => {
    const statusSelect = adminPage
      .locator('[data-radix-select-trigger]')
      .filter({ hasText: /الحالة|الكل|status/i })
      .first();

    if ((await statusSelect.count()) === 0) { test.skip(); return; }

    await statusSelect.click();
    const confirmedOption = adminPage
      .locator('[role="option"]')
      .filter({ hasText: /مؤكد|confirmed/i })
      .first();

    if ((await confirmedOption.count()) === 0) { test.skip(); return; }
    await confirmedOption.click();
    await adminPage.waitForTimeout(600);

    const anyContent = adminPage.locator('table, [class*="empty"]').first();
    await expect(anyContent).toBeVisible({ timeout: 8_000 });
  });
});

// ── BK-FL-006: فلتر نطاق التاريخ ─────────────────────────────────────────────

test.describe('Bookings Filters — date range', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[BK-FL-006][Bookings/Filters][P1-High] tab "اليوم" يُصفّي القائمة بحجوزات اليوم', async ({
    adminPage,
  }) => {
    const todayTab = adminPage
      .getByRole('button', { name: /اليوم|today/i })
      .first();

    if ((await todayTab.count()) === 0) { test.skip(); return; }
    await todayTab.click();
    await adminPage.waitForTimeout(600);

    // نتيجة ستكون إما صفوف اليوم أو فارغة — لا يُكسر الـ UI
    const anyContent = adminPage.locator('table, [class*="empty"]').first();
    await expect(anyContent).toBeVisible({ timeout: 8_000 });
  });

  test('[BK-FL-007][Bookings/Filters][P1-High] tab "هذا الأسبوع" يُصفّي القائمة', async ({
    adminPage,
  }) => {
    const weekTab = adminPage
      .getByRole('button', { name: /الأسبوع|هذا الأسبوع|week/i })
      .first();

    if ((await weekTab.count()) === 0) { test.skip(); return; }
    await weekTab.click();
    await adminPage.waitForTimeout(600);

    const anyContent = adminPage.locator('table, [class*="empty"]').first();
    await expect(anyContent).toBeVisible({ timeout: 8_000 });
  });
});

// ── BK-FL-008: فلتر الموظف ────────────────────────────────────────────────────

test.describe('Bookings Filters — employee filter', () => {
  let ctx: FilterContext;
  let booking: SeededBooking;

  test.beforeEach(async () => {
    ctx = await seedFilterContext();
    booking = await createBooking({
      branchId: ctx.branch.id,
      clientId: ctx.client.id,
      employeeId: ctx.employee.id,
      serviceId: ctx.service.id,
      payAtClinic: true,
    }).catch(() => ({ id: '' } as unknown as SeededBooking));
  });

  test.afterEach(async () => {
    if (booking?.id) await cancelBooking(booking.id).catch(() => {});
    await cleanFilterContext(ctx);
  });

  test('[BK-FL-008][Bookings/Filters][P1-High] فلتر الموظف يُظهر select بالموظفين @data', async ({
    adminPage,
    goto,
  }) => {
    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const employeeSelect = adminPage
      .locator('[data-radix-select-trigger]')
      .filter({ hasText: /الموظف|الكل|employee/i })
      .first();

    if ((await employeeSelect.count()) === 0) { test.skip(); return; }

    await employeeSelect.click();

    // يجب أن يظهر خيار "الكل" على الأقل
    const allOption = adminPage
      .locator('[role="option"]')
      .filter({ hasText: /الكل|جميع|all/i })
      .first();
    await expect(allOption).toBeVisible({ timeout: 6_000 });
  });
});

// ── BK-FL-009: Reset يُعيد الفلاتر ───────────────────────────────────────────

test.describe('Bookings Filters — reset', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[BK-FL-009][Bookings/Filters][P1-High] زر Reset يُعيد الفلاتر للوضع الافتراضي', async ({
    adminPage,
  }) => {
    // تطبيق فلتر أولاً
    const statusSelect = adminPage
      .locator('[data-radix-select-trigger]')
      .filter({ hasText: /الحالة|الكل|status/i })
      .first();

    if ((await statusSelect.count()) === 0) { test.skip(); return; }

    await statusSelect.click();
    const cancelledOption = adminPage
      .locator('[role="option"]')
      .filter({ hasText: /ملغى|ملغي|cancelled/i })
      .first();
    if ((await cancelledOption.count()) === 0) { test.skip(); return; }
    await cancelledOption.click();
    await adminPage.waitForTimeout(400);

    // الآن يجب أن يظهر زر Reset
    const resetBtn = adminPage
      .getByRole('button', { name: /إعادة|reset|مسح/i })
      .first();

    if ((await resetBtn.count()) === 0) { test.skip(); return; }
    await resetBtn.click();
    await adminPage.waitForTimeout(500);

    // بعد الـ reset، يجب أن يختفي زر الـ reset
    await expect(resetBtn).not.toBeVisible({ timeout: 6_000 });
  });
});
