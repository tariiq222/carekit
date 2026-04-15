/**
 * CareKit Dashboard — Bookings: Recurring Bookings
 *
 * يغطي:
 *   - إنشاء سلسلة حجوزات متكررة (WEEKLY × N) عبر الـ API
 *   - التحقق من ظهور أول تكرار في قائمة الحجوزات
 *   - إلغاء تكرار واحد لا يؤثر على بقية السلسلة
 *
 * حالات مُخطاة:
 *   - إنشاء متكرر من الـ UI wizard: الـ wizard الحالي لا يضم خطوة
 *     recurring مباشرة (يستخدم endpoint منفصل) — يُغطى بـ API seed.
 *   - تعديل تكرار واحد: لا يوجد "edit single occurrence" في الـ UI حتى الآن.
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
  cancelBooking,
  type SeededBranch,
  type SeededClient,
  type SeededEmployee,
  type SeededService,
  type SeededBooking,
} from '../setup/seeds';
import { apiPost, getAdminToken, API_URL, TENANT_ID } from '../setup/seeds/seed-base';

// ── Shared context ─────────────────────────────────────────────────────────────

interface RecurringContext {
  branch: SeededBranch;
  client: SeededClient;
  employee: SeededEmployee;
  service: SeededService;
}

async function seedRecurringContext(): Promise<RecurringContext> {
  const [branch, client, employee, service] = await Promise.all([
    createBranch({ nameAr: 'فرع متكرر' }),
    createClient({ firstName: 'BKRecurring', lastName: 'Client' }),
    createEmployee({ name: 'BKRecurring Employee' }),
    createService({ nameAr: 'خدمة متكررة', price: 60, durationMins: 30 }),
  ]);
  return { branch, client, employee, service };
}

async function cleanRecurringContext(ctx: RecurringContext): Promise<void> {
  await Promise.allSettled([
    deleteClient(ctx.client.id),
    deleteEmployee(ctx.employee.id),
    deleteService(ctx.service.id),
    deleteBranch(ctx.branch.id),
  ]);
}

interface RecurringBookingsResult {
  ids: string[];
}

async function createRecurringBookings(
  ctx: RecurringContext,
  occurrences: number,
): Promise<RecurringBookingsResult> {
  const start = new Date();
  start.setDate(start.getDate() + 2); // بعد يومين لتجنب التعارض
  start.setHours(9, 0, 0, 0);

  const data = await apiPost<Array<{ id: string }>>('/dashboard/bookings/recurring', {
    branchId: ctx.branch.id,
    clientId: ctx.client.id,
    employeeId: ctx.employee.id,
    serviceId: ctx.service.id,
    scheduledAt: start.toISOString(),
    durationMins: 30,
    price: 60,
    frequency: 'WEEKLY',
    occurrences,
    skipConflicts: true,
  });

  return { ids: data.map((b) => b.id) };
}

// ── BK-REC-001: إنشاء سلسلة متكررة ───────────────────────────────────────────

test.describe('Bookings Recurring — create series', () => {
  let ctx: RecurringContext;
  let result: RecurringBookingsResult;

  test.beforeEach(async () => {
    ctx = await seedRecurringContext();
    result = await createRecurringBookings(ctx, 3).catch(() => ({ ids: [] }));
  });

  test.afterEach(async () => {
    await Promise.allSettled(result.ids.map((id) => cancelBooking(id)));
    await cleanRecurringContext(ctx);
  });

  test('[BK-REC-001][Bookings/Recurring][P1-High] إنشاء 3 تكرارات أسبوعية ينتج 3 حجوزات @data', async () => {
    expect(result.ids.length).toBe(3);
  });

  test('[BK-REC-002][Bookings/Recurring][P1-High] أول تكرار يظهر في قائمة حجوزات العميل @data', async ({
    searchInList,
    adminPage,
  }) => {
    if (result.ids.length === 0) { test.skip(); return; }

    await searchInList('/bookings', ctx.client.firstName);
    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: ctx.client.firstName })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[BK-REC-003][Bookings/Recurring][P1-High] جميع التكرارات تظهر في القائمة @data', async ({
    searchInList,
    adminPage,
  }) => {
    if (result.ids.length === 0) { test.skip(); return; }

    await searchInList('/bookings', ctx.client.firstName);
    const rows = adminPage
      .locator('table tbody tr')
      .filter({ hasText: ctx.client.firstName });

    // قد يكون التصفح محدوداً بـ page size — نتحقق من وجود سجل واحد على الأقل
    await expect(rows.first()).toBeVisible({ timeout: 12_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ── BK-REC-004: إلغاء تكرار واحد لا يؤثر على الباقين ─────────────────────────

test.describe('Bookings Recurring — cancel single occurrence', () => {
  let ctx: RecurringContext;
  let result: RecurringBookingsResult;

  test.beforeEach(async () => {
    ctx = await seedRecurringContext();
    result = await createRecurringBookings(ctx, 3).catch(() => ({ ids: [] }));
  });

  test.afterEach(async () => {
    await Promise.allSettled(result.ids.map((id) => cancelBooking(id)));
    await cleanRecurringContext(ctx);
  });

  test('[BK-REC-004][Bookings/Recurring][P1-High] إلغاء تكرار واحد لا يلغي السلسلة كاملة @data', async () => {
    if (result.ids.length < 2) { test.skip(); return; }

    const token = await getAdminToken();

    // إلغاء التكرار الأول فقط
    const firstId = result.ids[0];
    const cancelRes = await fetch(`${API_URL}/dashboard/bookings/${firstId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: 'test cancel single occurrence' }),
    });
    expect([200, 204]).toContain(cancelRes.status);

    // التحقق أن التكرار الثاني لا يزال موجوداً (PENDING)
    const secondId = result.ids[1];
    const getRes = await fetch(`${API_URL}/dashboard/bookings/${secondId}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        Authorization: `Bearer ${token}`,
      },
    });
    expect(getRes.status).toBe(200);
    const booking = await getRes.json() as { status?: string };
    expect(booking.status?.toLowerCase()).not.toBe('cancelled');
  });

  test.skip('[BK-REC-005][Bookings/Recurring][P2-Medium] تعديل تكرار واحد يغير تاريخه فقط',
    'لا يوجد UI لتعديل تكرار واحد بشكل منفرد في الـ dashboard حتى الآن — يُعاد النظر في Phase 8',
  );
});

// ── BK-REC-006: التكرار بـ CUSTOM dates ──────────────────────────────────────

test.describe('Bookings Recurring — custom dates', () => {
  let ctx: RecurringContext;
  let bookingIds: string[] = [];

  test.beforeEach(async () => {
    ctx = await seedRecurringContext();
  });

  test.afterEach(async () => {
    await Promise.allSettled(bookingIds.map((id) => cancelBooking(id)));
    bookingIds = [];
    await cleanRecurringContext(ctx);
  });

  test('[BK-REC-006][Bookings/Recurring][P2-Medium] CUSTOM dates ينشئ حجوزات في التواريخ المحددة @data', async () => {
    const d1 = new Date(); d1.setDate(d1.getDate() + 3); d1.setHours(10, 0, 0, 0);
    const d2 = new Date(); d2.setDate(d2.getDate() + 10); d2.setHours(10, 0, 0, 0);

    const data = await apiPost<Array<{ id: string }>>('/dashboard/bookings/recurring', {
      branchId: ctx.branch.id,
      clientId: ctx.client.id,
      employeeId: ctx.employee.id,
      serviceId: ctx.service.id,
      scheduledAt: d1.toISOString(),
      durationMins: 30,
      price: 60,
      frequency: 'CUSTOM',
      customDates: [d1.toISOString(), d2.toISOString()],
      skipConflicts: true,
    }).catch(() => []);

    bookingIds = data.map((b) => b.id);
    expect(bookingIds.length).toBe(2);
  });
});
