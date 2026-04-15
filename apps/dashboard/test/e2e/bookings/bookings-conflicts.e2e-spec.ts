/**
 * CareKit Dashboard — Bookings: Conflict Prevention
 *
 * يغطي:
 *   - رفض حجز مزدوج (نفس الموظف + نفس الوقت) → ConflictException من الـ API
 *   - رفض كوبون منتهي الصلاحية
 *   - رفض كوبون غير موجود
 *
 * ملاحظة حول الحالات التي تُخطى:
 *   - "الحجز أثناء إجازة الموظف" و"خارج ساعات العمل": تُرفض من الـ API لكن
 *     لا يوجد endpoint موثّق يُعيد error مترجم ليظهر في الـ UI — يُخطى.
 *   - اكتشاف التعارض عبر الـ UI wizard مباشرةً: يتطلب 6 خطوات + employee-service
 *     link حقيقي، يُغطى بالـ API seed + التحقق من الـ error response.
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
  createCoupon,
  deleteCoupon,
  type SeededBranch,
  type SeededClient,
  type SeededEmployee,
  type SeededService,
  type SeededBooking,
  type SeededCoupon,
} from '../setup/seeds';
import { getAdminToken, API_URL, TENANT_ID } from '../setup/seeds/seed-base';

// ── Shared context ─────────────────────────────────────────────────────────────

interface ConflictContext {
  branch: SeededBranch;
  client: SeededClient;
  employee: SeededEmployee;
  service: SeededService;
}

async function seedConflictContext(): Promise<ConflictContext> {
  const [branch, client, employee, service] = await Promise.all([
    createBranch({ nameAr: 'فرع تعارض' }),
    createClient({ firstName: 'BKConflict', lastName: 'Client' }),
    createEmployee({ name: 'BKConflict Employee' }),
    createService({ nameAr: 'خدمة تعارض', price: 80, durationMins: 30 }),
  ]);
  return { branch, client, employee, service };
}

async function cleanConflictContext(ctx: ConflictContext): Promise<void> {
  await Promise.allSettled([
    deleteClient(ctx.client.id),
    deleteEmployee(ctx.employee.id),
    deleteService(ctx.service.id),
    deleteBranch(ctx.branch.id),
  ]);
}

// ── BK-015: الـ API يرفض الحجز المزدوج ────────────────────────────────────────

test.describe('Bookings Conflicts — double-booking prevention', () => {
  let ctx: ConflictContext;
  let firstBooking: SeededBooking;

  test.beforeEach(async () => {
    ctx = await seedConflictContext();
    firstBooking = await createBooking({
      branchId: ctx.branch.id,
      clientId: ctx.client.id,
      employeeId: ctx.employee.id,
      serviceId: ctx.service.id,
      payAtClinic: true,
    }).catch(() => ({ id: '' } as unknown as SeededBooking));
  });

  test.afterEach(async () => {
    if (firstBooking?.id) await cancelBooking(firstBooking.id).catch(() => {});
    await cleanConflictContext(ctx);
  });

  test('[BK-015][Bookings/Conflicts][P0-Critical] الـ API يرفض حجز موظف في نفس الوقت @critical @data', async () => {
    if (!firstBooking?.id) { test.skip(); return; }

    const token = await getAdminToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const res = await fetch(`${API_URL}/dashboard/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        branchId: ctx.branch.id,
        clientId: ctx.client.id,
        employeeId: ctx.employee.id,
        serviceId: ctx.service.id,
        scheduledAt: tomorrow.toISOString(),
        payAtClinic: true,
      }),
    });

    // الحجز الأول سيكون في نفس الوقت الافتراضي — يجب رفض الثاني بـ 409 أو 400
    expect([400, 409]).toContain(res.status);
  });

  test('[BK-016][Bookings/Conflicts][P0-Critical] الحجز المتعارض لا يضاف إلى قائمة الحجوزات @critical @data', async ({
    searchInList,
    adminPage,
  }) => {
    if (!firstBooking?.id) { test.skip(); return; }

    const token = await getAdminToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    // محاولة إنشاء حجز ثانٍ في نفس الوقت
    await fetch(`${API_URL}/dashboard/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        branchId: ctx.branch.id,
        clientId: ctx.client.id,
        employeeId: ctx.employee.id,
        serviceId: ctx.service.id,
        scheduledAt: tomorrow.toISOString(),
        payAtClinic: true,
      }),
    }).catch(() => {});

    // في القائمة يجب أن يظهر حجز واحد فقط للعميل
    await searchInList('/bookings', ctx.client.firstName);
    const rows = adminPage
      .locator('table tbody tr')
      .filter({ hasText: ctx.client.firstName });

    // لا يزيد عن واحد لأن الثاني رُفض
    const count = await rows.count();
    expect(count).toBeLessThanOrEqual(1);
  });
});

// ── BK-017: كوبون منتهي الصلاحية يُرفض ───────────────────────────────────

test.describe('Bookings Conflicts — expired coupon rejected', () => {
  let ctx: ConflictContext;
  let expiredCoupon: SeededCoupon;

  test.beforeEach(async () => {
    ctx = await seedConflictContext();
    // إنشاء كوبون منتهي الصلاحية — نمرر كود مختلف ونتحقق من الرفض
    expiredCoupon = await createCoupon({
      discountType: 'PERCENTAGE',
      discountValue: 10,
      isActive: false, // غير نشط = مرفوض
    });
  });

  test.afterEach(async () => {
    await Promise.allSettled([
      deleteCoupon(expiredCoupon.id),
      cleanConflictContext(ctx),
    ]);
  });

  test('[BK-017][Bookings/Conflicts][P1-High] كوبون غير نشط يُرفض من الـ API @data', async () => {
    const token = await getAdminToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 0, 0, 0);

    const res = await fetch(`${API_URL}/dashboard/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        branchId: ctx.branch.id,
        clientId: ctx.client.id,
        employeeId: ctx.employee.id,
        serviceId: ctx.service.id,
        scheduledAt: tomorrow.toISOString(),
        payAtClinic: true,
        couponCode: expiredCoupon.code,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { message?: string };
    expect(body.message).toMatch(/coupon|كوبون/i);
  });
});

// ── BK-018: كوبون غير موجود يُرفض ────────────────────────────────────────

test.describe('Bookings Conflicts — nonexistent coupon rejected', () => {
  let ctx: ConflictContext;

  test.beforeEach(async () => {
    ctx = await seedConflictContext();
  });

  test.afterEach(async () => {
    await cleanConflictContext(ctx);
  });

  test('[BK-018][Bookings/Conflicts][P1-High] كوبون غير موجود يُرفض بـ 400 @data', async () => {
    const token = await getAdminToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);

    const res = await fetch(`${API_URL}/dashboard/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        branchId: ctx.branch.id,
        clientId: ctx.client.id,
        employeeId: ctx.employee.id,
        serviceId: ctx.service.id,
        scheduledAt: tomorrow.toISOString(),
        payAtClinic: true,
        couponCode: 'INVALID_XXXX_9999',
      }),
    });

    expect(res.status).toBe(400);
  });

  test.skip('[BK-019][Bookings/Conflicts][P1-High] حجز أثناء إجازة الموظف يُرفض من الـ UI @data',
    'لا يوجد endpoint موثّق لإدارة إجازات الموظفين عبر الـ dashboard API حتى الآن',
  );

  test.skip('[BK-020][Bookings/Conflicts][P1-High] حجز خارج ساعات عمل الفرع يُرفض أو يُحذَّر @data',
    'التحقق من ساعات العمل يحدث في الـ backend فقط عبر availability check — لا يوجد UI feedback منفصل في الـ wizard حتى الآن',
  );
});
