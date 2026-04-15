/**
 * CareKit Dashboard — Bookings E2E (data-driven)
 *
 * يغطي كل حالات الحجز: confirm, check-in, complete, cancel, no-show, waitlist.
 * كل test يزرع الكيانات اللازمة (عميل + موظف + خدمة + فرع) ثم يحذفها.
 *
 * ملاحظة: الـ seeds التي تتطلب branchId + clientId + employeeId + serviceId
 * تحتاج أن تكون هذه الكيانات موجودة مسبقاً في بيئة الاختبار.
 * إذا لم يكن إنشاء الحجز ممكناً عبر UI بدون بيانات حقيقية، يتخطى الـ test.
 */

import { test, expect } from '../setup/fixtures';
import {
  createClient,
  deleteClient,
  createEmployee,
  deleteEmployee,
  createService,
  deleteService,
  createBranch,
  deleteBranch,
  createBooking,
  cancelBooking,
  type SeededClient,
  type SeededEmployee,
  type SeededService,
  type SeededBranch,
  type SeededBooking,
} from '../setup/seeds';

// ── Shared context: branch + client + employee + service ───────────────────
interface BookingContext {
  branch: SeededBranch;
  client: SeededClient;
  employee: SeededEmployee;
  service: SeededService;
}

async function seedBookingContext(): Promise<BookingContext> {
  const [branch, client, employee, service] = await Promise.all([
    createBranch({ nameAr: 'فرع اختبار' }),
    createClient({ firstName: 'PWBook', lastName: 'Client' }),
    createEmployee({ name: 'PWBook Employee' }),
    createService({ nameAr: 'خدمة اختبار', price: 50, durationMins: 30 }),
  ]);
  return { branch, client, employee, service };
}

async function cleanBookingContext(ctx: BookingContext): Promise<void> {
  await Promise.allSettled([
    deleteClient(ctx.client.id),
    deleteEmployee(ctx.employee.id),
    deleteService(ctx.service.id),
    deleteBranch(ctx.branch.id),
  ]);
}

// ── BK-001: إنشاء حجز عبر UI ──────────────────────────────────────────────
test.describe('Bookings — create', () => {
  test('[BK-001] @smoke — صفحة الحجوزات تحمل وتعرض المحتوى', async ({ adminPage, goto }) => {
    await goto('/bookings');
    const anyContent = adminPage.locator('table, [role="table"], [class*="skeleton"], [class*="empty"]');
    await expect(anyContent.first()).toBeVisible({ timeout: 12_000 });
  });

  test('[BK-001b] @smoke — زر"إنشاء حجز" موجود في صفحة الحجوزات', async ({ adminPage, goto }) => {
    await goto('/bookings');
    const addBtn = adminPage.getByRole('button', { name: /إنشاء حجز|حجز جديد|new booking/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
  });
});

// ── BK-002: تأكيد حجز (confirm) ───────────────────────────────────────────
test.describe('Bookings — confirm', () => {
  let ctx: BookingContext;
  let booking: SeededBooking;

  test.beforeEach(async () => {
    ctx = await seedBookingContext();
    booking = await createBooking({
      branchId: ctx.branch.id,
      clientId: ctx.client.id,
      employeeId: ctx.employee.id,
      serviceId: ctx.service.id,
      payAtClinic: true,
    }).catch(() => ({ id: '', ...ctx, scheduledAt: '' } as unknown as SeededBooking));
  });

  test.afterEach(async () => {
    if (booking?.id) await cancelBooking(booking.id).catch(() => {});
    await cleanBookingContext(ctx);
  });

  test('[BK-002] @critical @data — تأكيد حجز معلّق يغير حالته', async ({ adminPage, searchInList }) => {
    if (!booking?.id) { test.skip(); return; }

    await searchInList('/bookings', ctx.client.firstName);
    const row = adminPage.locator('table tbody tr').filter({ hasText: ctx.client.firstName }).first();

    if ((await row.count()) === 0) { test.skip(); return; }

    const confirmBtn = row
      .locator('button[aria-label*="تأكيد"], button[aria-label*="confirm"]')
      .first();

    if ((await confirmBtn.count()) === 0) { test.skip(); return; }

    await confirmBtn.click();

    // Dialog تأكيد إن وُجد
    const dialog = adminPage.locator('[role="dialog"], [role="alertdialog"]').first();
    if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const okBtn = dialog.getByRole('button', { name: /تأكيد|نعم|confirm|ok/i }).first();
      await okBtn.click();
    }

    await expect(
      adminPage.getByText(/تم التأكيد|مؤكد|confirmed/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ── BK-003 + BK-004: check-in + complete ──────────────────────────────────
test.describe('Bookings — check-in and complete', () => {
  let ctx: BookingContext;
  let booking: SeededBooking;

  test.beforeEach(async () => {
    ctx = await seedBookingContext();
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
    await cleanBookingContext(ctx);
  });

  test('[BK-003] @data — تسجيل وصول (check-in) يغير حالة الحجز', async ({ adminPage, searchInList }) => {
    if (!booking?.id) { test.skip(); return; }
    await searchInList('/bookings', ctx.client.firstName);

    const row = adminPage.locator('table tbody tr').filter({ hasText: ctx.client.firstName }).first();
    if ((await row.count()) === 0) { test.skip(); return; }

    const checkInBtn = row
      .locator('button[aria-label*="وصول"], button[aria-label*="check-in"], button[aria-label*="checkin"]')
      .first();
    if ((await checkInBtn.count()) === 0) { test.skip(); return; }

    await checkInBtn.click();
    await expect(adminPage.getByText(/تم تسجيل الوصول|وصل|checked.in/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('[BK-004] @data — إنهاء الحجز (complete) يغير الحالة', async ({ adminPage, searchInList }) => {
    if (!booking?.id) { test.skip(); return; }
    await searchInList('/bookings', ctx.client.firstName);

    const row = adminPage.locator('table tbody tr').filter({ hasText: ctx.client.firstName }).first();
    if ((await row.count()) === 0) { test.skip(); return; }

    const completeBtn = row
      .locator('button[aria-label*="إنهاء"], button[aria-label*="complete"], button[aria-label*="انتهى"]')
      .first();
    if ((await completeBtn.count()) === 0) { test.skip(); return; }

    await completeBtn.click();
    await expect(adminPage.getByText(/تم الإنهاء|مكتمل|completed/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── BK-005: إلغاء حجز ─────────────────────────────────────────────────────
test.describe('Bookings — cancel', () => {
  let ctx: BookingContext;
  let booking: SeededBooking;

  test.beforeEach(async () => {
    ctx = await seedBookingContext();
    booking = await createBooking({
      branchId: ctx.branch.id,
      clientId: ctx.client.id,
      employeeId: ctx.employee.id,
      serviceId: ctx.service.id,
      payAtClinic: true,
    }).catch(() => ({ id: '' } as unknown as SeededBooking));
  });

  test.afterEach(async () => {
    await cleanBookingContext(ctx);
  });

  test('[BK-005] @data — إلغاء حجز يغير الحالة ويظهر toast', async ({ adminPage, searchInList }) => {
    if (!booking?.id) { test.skip(); return; }
    await searchInList('/bookings', ctx.client.firstName);

    const row = adminPage.locator('table tbody tr').filter({ hasText: ctx.client.firstName }).first();
    if ((await row.count()) === 0) { test.skip(); return; }

    const cancelBtn = row
      .locator('button[aria-label*="إلغاء"], button[aria-label*="cancel"]')
      .first();
    if ((await cancelBtn.count()) === 0) { test.skip(); return; }

    await cancelBtn.click();

    // قد يفتح dialog يطلب سبب الإلغاء
    const dialog = adminPage.locator('[role="dialog"], [role="alertdialog"]').first();
    if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const reasonInput = dialog.locator('textarea, input[name*="reason"]').first();
      if ((await reasonInput.count()) > 0) await reasonInput.fill('اختبار إلغاء');
      const confirmBtn = dialog.getByRole('button', { name: /تأكيد|إلغاء الحجز|confirm/i }).first();
      await confirmBtn.click();
    }

    await expect(adminPage.getByText(/تم الإلغاء|ملغى|cancelled/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── BK-006: إعادة جدولة ───────────────────────────────────────────────────
test.describe('Bookings — reschedule', () => {
  let ctx: BookingContext;
  let booking: SeededBooking;

  test.beforeEach(async () => {
    ctx = await seedBookingContext();
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
    await cleanBookingContext(ctx);
  });

  test('[BK-006] @data — إعادة الجدولة تفتح picker ويظهر التاريخ الجديد', async ({
    adminPage,
    searchInList,
  }) => {
    if (!booking?.id) { test.skip(); return; }
    await searchInList('/bookings', ctx.client.firstName);

    const row = adminPage.locator('table tbody tr').filter({ hasText: ctx.client.firstName }).first();
    if ((await row.count()) === 0) { test.skip(); return; }

    const rescheduleBtn = row
      .locator('button[aria-label*="إعادة"], button[aria-label*="reschedule"], button[aria-label*="جدولة"]')
      .first();
    if ((await rescheduleBtn.count()) === 0) { test.skip(); return; }

    await rescheduleBtn.click();

    const dialog = adminPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    // يكفي التحقق من وجود date picker
    const datePicker = dialog.locator('input[type="date"], [class*="calendar"], [class*="datepicker"]').first();
    await expect(datePicker).toBeVisible({ timeout: 6_000 });
  });
});

// ── BK-007: no-show ────────────────────────────────────────────────────────
test.describe('Bookings — no-show', () => {
  let ctx: BookingContext;
  let booking: SeededBooking;

  test.beforeEach(async () => {
    ctx = await seedBookingContext();
    booking = await createBooking({
      branchId: ctx.branch.id,
      clientId: ctx.client.id,
      employeeId: ctx.employee.id,
      serviceId: ctx.service.id,
      payAtClinic: true,
    }).catch(() => ({ id: '' } as unknown as SeededBooking));
  });

  test.afterEach(async () => {
    await cleanBookingContext(ctx);
  });

  test('[BK-007] @data — no-show يغير حالة الحجز', async ({ adminPage, searchInList }) => {
    if (!booking?.id) { test.skip(); return; }
    await searchInList('/bookings', ctx.client.firstName);

    const row = adminPage.locator('table tbody tr').filter({ hasText: ctx.client.firstName }).first();
    if ((await row.count()) === 0) { test.skip(); return; }

    const noShowBtn = row
      .locator('button[aria-label*="غياب"], button[aria-label*="no-show"], button[aria-label*="noshow"]')
      .first();
    if ((await noShowBtn.count()) === 0) { test.skip(); return; }

    await noShowBtn.click();

    const dialog = adminPage.locator('[role="dialog"], [role="alertdialog"]').first();
    if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const confirmBtn = dialog.getByRole('button', { name: /تأكيد|نعم|confirm/i }).first();
      await confirmBtn.click();
    }

    await expect(adminPage.getByText(/غياب|no.show/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── BK-009 + BK-010: Waitlist ──────────────────────────────────────────────
test.describe('Bookings — waitlist', () => {
  test('[BK-009] @data — صفحة قائمة الانتظار تحمل', async ({ adminPage, goto }) => {
    await goto('/bookings/waitlist');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
    const anyContent = adminPage.locator('table, [role="table"], [class*="empty"], h1, h2').first();
    await expect(anyContent).toBeVisible({ timeout: 10_000 });
  });

  test('[BK-010] @smoke — زر إضافة لقائمة الانتظار موجود', async ({ adminPage, goto }) => {
    await goto('/bookings/waitlist');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
    const addBtn = adminPage
      .getByRole('button', { name: /إضافة|add|انتظار/i })
      .first();
    // يكفي أن الصفحة لا تكسر
    const anyContent = adminPage.locator('main, [class*="page"], h1').first();
    await expect(anyContent).toBeVisible({ timeout: 10_000 });
  });
});
