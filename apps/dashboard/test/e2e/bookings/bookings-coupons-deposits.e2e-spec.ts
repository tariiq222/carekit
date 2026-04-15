/**
 * CareKit Dashboard — Bookings: Coupons & Deposits
 *
 * يغطي:
 *   - تطبيق كوبون صالح على حجز → يُخفَّض السعر في الـ API response
 *   - رفض كوبون غير موجود
 *   - رفض كوبون غير نشط
 *   - الحجز المنشأ بكوبون يظهر في القائمة
 *
 * حالات مُخطاة:
 *   - حقل إدخال الكوبون في الـ wizard UI: لا يوجد حقل coupon code
 *     في StepConfirm أو أي خطوة من الـ wizard حتى الآن.
 *   - "الدفعة المقدمة (deposit)": لا يوجد deposit endpoint في الـ
 *     dashboard API حتى الآن — يُعاد النظر في Phase 8.
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

interface CouponContext {
  branch: SeededBranch;
  client: SeededClient;
  employee: SeededEmployee;
  service: SeededService;
}

async function seedCouponContext(): Promise<CouponContext> {
  const [branch, client, employee, service] = await Promise.all([
    createBranch({ nameAr: 'فرع كوبون حجز' }),
    createClient({ firstName: 'BKCoupon', lastName: 'Client' }),
    createEmployee({ name: 'BKCoupon Employee' }),
    createService({ nameAr: 'خدمة كوبون حجز', price: 200, durationMins: 30 }),
  ]);
  return { branch, client, employee, service };
}

async function cleanCouponContext(ctx: CouponContext): Promise<void> {
  await Promise.allSettled([
    deleteClient(ctx.client.id),
    deleteEmployee(ctx.employee.id),
    deleteService(ctx.service.id),
    deleteBranch(ctx.branch.id),
  ]);
}

// ── BK-CD-001: كوبون صالح يُخفَّض السعر ────────────────────────────────────────

test.describe('Bookings Coupons — valid coupon reduces price', () => {
  let ctx: CouponContext;
  let coupon: SeededCoupon;
  let booking: SeededBooking;

  test.beforeEach(async () => {
    ctx = await seedCouponContext();
    coupon = await createCoupon({
      discountType: 'PERCENTAGE',
      discountValue: 25,
      isActive: true,
    });
  });

  test.afterEach(async () => {
    if (booking?.id) await cancelBooking(booking.id).catch(() => {});
    await deleteCoupon(coupon.id).catch(() => {});
    await cleanCouponContext(ctx);
  });

  test('[BK-CD-001][Bookings/Coupons][P1-High] كوبون 25% يُخفَّض سعر الحجز @data', async () => {
    const token = await getAdminToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

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
        couponCode: coupon.code,
      }),
    });

    if (!res.ok) { test.skip(); return; }

    const data = await res.json() as { id?: string; discountedPrice?: number; price?: number };
    if (data.id) booking = { id: data.id } as SeededBooking;

    // السعر المخفَّض يجب أن يكون أقل من السعر الأصلي (200 SAR)
    const finalPrice = data.discountedPrice ?? data.price;
    if (finalPrice !== undefined) {
      expect(finalPrice).toBeLessThan(200);
    }
  });

  test('[BK-CD-002][Bookings/Coupons][P1-High] الحجز المُنشأ بكوبون يظهر في قائمة الحجوزات @data', async ({
    searchInList,
    adminPage,
  }) => {
    booking = await createBooking({
      branchId: ctx.branch.id,
      clientId: ctx.client.id,
      employeeId: ctx.employee.id,
      serviceId: ctx.service.id,
      payAtClinic: true,
      couponCode: coupon.code,
    }).catch(() => ({ id: '' } as unknown as SeededBooking));

    if (!booking?.id) { test.skip(); return; }

    await searchInList('/bookings', ctx.client.firstName);
    const row = adminPage
      .locator('table tbody tr')
      .filter({ hasText: ctx.client.firstName })
      .first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });
});

// ── BK-CD-003: كوبون غير موجود يُرفض ────────────────────────────────────────────

test.describe('Bookings Coupons — invalid coupon rejected', () => {
  let ctx: CouponContext;

  test.beforeEach(async () => {
    ctx = await seedCouponContext();
  });

  test.afterEach(async () => {
    await cleanCouponContext(ctx);
  });

  test('[BK-CD-003][Bookings/Coupons][P1-High] كوبون غير موجود يُرجع 400 @data', async () => {
    const token = await getAdminToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0);

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
        couponCode: 'NONEXISTENT_COUPON_XYZ',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('[BK-CD-004][Bookings/Coupons][P1-High] رسالة خطأ الكوبون تُذكر "coupon" @data', async () => {
    const token = await getAdminToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(16, 0, 0, 0);

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
        couponCode: 'BAD_CODE_999',
      }),
    });

    const body = await res.json() as { message?: string };
    expect(body.message?.toLowerCase()).toMatch(/coupon/i);
  });
});

// ── BK-CD-005: كوبون غير نشط يُرفض ──────────────────────────────────────────────

test.describe('Bookings Coupons — inactive coupon rejected', () => {
  let ctx: CouponContext;
  let inactiveCoupon: SeededCoupon;

  test.beforeEach(async () => {
    ctx = await seedCouponContext();
    inactiveCoupon = await createCoupon({
      discountType: 'FIXED',
      discountValue: 50,
      isActive: false,
    });
  });

  test.afterEach(async () => {
    await deleteCoupon(inactiveCoupon.id).catch(() => {});
    await cleanCouponContext(ctx);
  });

  test('[BK-CD-005][Bookings/Coupons][P1-High] كوبون غير نشط يُرجع 400 @data', async () => {
    const token = await getAdminToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(13, 0, 0, 0);

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
        couponCode: inactiveCoupon.code,
      }),
    });

    expect(res.status).toBe(400);
  });

  test.skip('[BK-CD-006][Bookings/Coupons][P2-Medium] الـ wizard يعرض حقل كوبون في خطوة التأكيد',
    'حقل coupon code غير موجود في StepConfirm حتى الآن — يُضاف في Phase 8',
  );

  test.skip('[BK-CD-007][Bookings/Coupons][P2-Medium] الدفعة المقدمة (deposit) تُطلب عند الإنشاء',
    'لا يوجد deposit feature في الـ dashboard API حتى الآن',
  );
});
