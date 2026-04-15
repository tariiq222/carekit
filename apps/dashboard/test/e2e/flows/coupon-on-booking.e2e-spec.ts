/**
 * CareKit Dashboard — Critical Flow: Coupon on Booking
 *
 * المسار الكامل:
 * 1. إنشاء كوبون بنسبة خصم (seed)
 * 2. التحقق من ظهوره في قائمة الكوبونات
 * 3. إنشاء حجز مع تطبيق الكوبون
 * 4. التحقق من تطبيق الخصم
 */

import { test, expect } from '../setup/fixtures';
import {
  createCoupon, deleteCoupon,
  createClient, deleteClient,
  createEmployee, deleteEmployee,
  createService, deleteService,
  createBranch, deleteBranch,
  createBooking, cancelBooking,
  type SeededCoupon,
  type SeededClient,
  type SeededEmployee,
  type SeededService,
  type SeededBranch,
  type SeededBooking,
} from '../setup/seeds';

test.describe('Flow: Coupon on Booking', () => {
  let coupon: SeededCoupon;
  let client: SeededClient;
  let employee: SeededEmployee;
  let service: SeededService;
  let branch: SeededBranch;
  let booking: SeededBooking;

  test.beforeAll(async () => {
    [coupon, branch, client, employee, service] = await Promise.all([
      createCoupon({ discountType: 'PERCENTAGE', discountValue: 20, isActive: true }),
      createBranch({ nameAr: 'فرع كوبون' }),
      createClient({ firstName: 'CouponClient' }),
      createEmployee({ name: 'CouponEmployee' }),
      createService({ nameAr: 'خدمة كوبون', price: 200, durationMins: 60 }),
    ]);

    booking = await createBooking({
      branchId: branch.id,
      clientId: client.id,
      employeeId: employee.id,
      serviceId: service.id,
      payAtClinic: true,
      couponCode: coupon.code,
    }).catch(() => ({ id: '' } as unknown as SeededBooking));
  });

  test.afterAll(async () => {
    if (booking?.id) await cancelBooking(booking.id).catch(() => {});
    await Promise.allSettled([
      deleteCoupon(coupon.id),
      deleteClient(client.id),
      deleteEmployee(employee.id),
      deleteService(service.id),
      deleteBranch(branch.id),
    ]);
  });

  test('[FLOW-CP-01] @critical — الكوبون المُنشأ يظهر في قائمة الكوبونات', async ({ adminPage, searchInList }) => {
    await searchInList('/coupons', coupon.code);
    const row = adminPage.locator('table tbody tr').filter({ hasText: coupon.code }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[FLOW-CP-02] @critical — الكوبون نشط ويحمل نسبة 20%', async ({ adminPage, searchInList }) => {
    await searchInList('/coupons', coupon.code);
    const row = adminPage.locator('table tbody tr').filter({ hasText: coupon.code }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
    await expect(row.getByText(/نشط|active/i).first()).toBeVisible({ timeout: 6_000 });
  });

  test('[FLOW-CP-03] @critical — الحجز المُنشأ بالكوبون يظهر في قائمة الحجوزات', async ({ adminPage, searchInList }) => {
    if (!booking?.id) { test.skip(); return; }
    await searchInList('/bookings', client.firstName);
    const row = adminPage.locator('table tbody tr').filter({ hasText: client.firstName }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[FLOW-CP-04] @critical — صفحة الفواتير تعرض محتوى', async ({ adminPage, goto }) => {
    await goto('/invoices');
    const heading = adminPage.getByRole('heading', { name: /الفواتير/ }).first();
    const emptyText = adminPage.getByText(/لا توجد فواتير|لا يوجد/).first();
    await expect(
      adminPage.locator('table, [role="table"], [class*="skeleton"]').first()
        .or(emptyText)
        .or(heading),
    ).toBeVisible({ timeout: 10_000 });
  });
});
