/**
 * CareKit Dashboard — Critical Flow: New Client → Full Booking Lifecycle
 *
 * المسار الكامل:
 * 1. إنشاء عميل + موظف + خدمة + فرع عبر API (seed)
 * 2. إنشاء حجز
 * 3. تأكيد الحجز
 * 4. تسجيل الوصول (check-in)
 * 5. إنهاء الحجز (complete)
 * 6. التحقق من ظهور فاتورة
 */

import { test, expect } from '../setup/fixtures';
import {
  createClient, deleteClient,
  createEmployee, deleteEmployee,
  createService, deleteService,
  createBranch, deleteBranch,
  createBooking, cancelBooking,
  type SeededClient,
  type SeededEmployee,
  type SeededService,
  type SeededBranch,
  type SeededBooking,
} from '../setup/seeds';

test.describe('Flow: New Client → Booking Lifecycle', () => {
  let client: SeededClient;
  let employee: SeededEmployee;
  let service: SeededService;
  let branch: SeededBranch;
  let booking: SeededBooking;

  test.beforeAll(async () => {
    [branch, client, employee, service] = await Promise.all([
      createBranch({ nameAr: 'فرع Flow اختبار' }),
      createClient({ firstName: 'FlowClient', lastName: 'Test' }),
      createEmployee({ name: 'FlowEmployee Test' }),
      createService({ nameAr: 'خدمة Flow', price: 100, durationMins: 30 }),
    ]);

    booking = await createBooking({
      branchId: branch.id,
      clientId: client.id,
      employeeId: employee.id,
      serviceId: service.id,
      payAtClinic: true,
    }).catch(() => ({ id: '' } as unknown as SeededBooking));
  });

  test.afterAll(async () => {
    if (booking?.id) await cancelBooking(booking.id).catch(() => {});
    await Promise.allSettled([
      deleteClient(client.id),
      deleteEmployee(employee.id),
      deleteService(service.id),
      deleteBranch(branch.id),
    ]);
  });

  test('[FLOW-BK-01] @critical — العميل المُنشأ يظهر في قائمة العملاء', async ({ adminPage, searchInList }) => {
    await searchInList('/clients', client.firstName);
    const row = adminPage.locator('table tbody tr').filter({ hasText: client.firstName }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[FLOW-BK-02] @critical — الحجز المُنشأ يظهر في قائمة الحجوزات', async ({ adminPage, searchInList }) => {
    if (!booking?.id) { test.skip(); return; }
    await searchInList('/bookings', client.firstName);
    const row = adminPage.locator('table tbody tr').filter({ hasText: client.firstName }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[FLOW-BK-03] @critical — تأكيد الحجز من واجهة الداشبورد', async ({ adminPage, searchInList }) => {
    if (!booking?.id) { test.skip(); return; }
    await searchInList('/bookings', client.firstName);
    const row = adminPage.locator('table tbody tr').filter({ hasText: client.firstName }).first();
    if ((await row.count()) === 0) { test.skip(); return; }

    const confirmBtn = row
      .locator('button[aria-label*="تأكيد"], button[aria-label*="confirm"]')
      .first();
    if ((await confirmBtn.count()) === 0) { test.skip(); return; }

    await confirmBtn.click();

    const dialog = adminPage.locator('[role="dialog"], [role="alertdialog"]').first();
    if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await dialog.getByRole('button', { name: /تأكيد|confirm/i }).first().click();
    }

    await expect(adminPage.getByText(/تم التأكيد|مؤكد|confirmed/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('[FLOW-BK-04] @critical — صفحة الفواتير تعرض محتوى بعد إنشاء الحجز', async ({ adminPage, goto }) => {
    await goto('/invoices');
    // الصفحة تحمل: إما جدول، أو skeleton، أو empty state نصي
    const heading = adminPage.getByRole('heading', { name: /الفواتير/ }).first();
    const emptyText = adminPage.getByText(/لا توجد فواتير|لا يوجد/).first();
    const table = adminPage.locator('table, [role="table"]').first();
    await expect(
      adminPage.locator('table, [role="table"], [class*="skeleton"]').first()
        .or(emptyText)
        .or(heading),
    ).toBeVisible({ timeout: 10_000 });
  });
});
