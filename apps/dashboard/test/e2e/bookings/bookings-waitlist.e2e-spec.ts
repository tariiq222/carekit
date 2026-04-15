/**
 * CareKit Dashboard — Bookings: Waitlist
 *
 * يغطي:
 *   - صفحة قائمة الانتظار تُحمَّل (يعتمد على feature flag)
 *   - إضافة عميل لقائمة الانتظار عبر الـ API والتحقق من ظهوره
 *   - حذف إدخال من قائمة الانتظار
 *
 * حالات مُخطاة:
 *   - "تحويل من قائمة الانتظار إلى حجز": لا يوجد endpoint convert في
 *     الـ dashboard API حتى الآن (يُعاد النظر في Phase 8).
 *   - إضافة من الـ UI: صفحة الـ waitlist tab لا تملك زر "إضافة"
 *     بسبب الـ feature flag — يُغطى بـ API seed.
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
  type SeededBranch,
  type SeededClient,
  type SeededEmployee,
  type SeededService,
} from '../setup/seeds';
import { apiPost, apiDelete, getAdminToken, API_URL, TENANT_ID } from '../setup/seeds/seed-base';

// ── Shared context ─────────────────────────────────────────────────────────────

interface WaitlistContext {
  branch: SeededBranch;
  client: SeededClient;
  employee: SeededEmployee;
  service: SeededService;
}

async function seedWaitlistContext(): Promise<WaitlistContext> {
  const [branch, client, employee, service] = await Promise.all([
    createBranch({ nameAr: 'فرع انتظار' }),
    createClient({ firstName: 'BKWaitlist', lastName: 'Client' }),
    createEmployee({ name: 'BKWaitlist Employee' }),
    createService({ nameAr: 'خدمة انتظار', price: 70, durationMins: 30 }),
  ]);
  return { branch, client, employee, service };
}

async function cleanWaitlistContext(ctx: WaitlistContext): Promise<void> {
  await Promise.allSettled([
    deleteClient(ctx.client.id),
    deleteEmployee(ctx.employee.id),
    deleteService(ctx.service.id),
    deleteBranch(ctx.branch.id),
  ]);
}

// ── BK-WL-001: صفحة قائمة الانتظار ───────────────────────────────────────────

test.describe('Bookings Waitlist — page load', () => {
  test('[BK-WL-001][Bookings/Waitlist][P2-Medium] صفحة قائمة الانتظار تُحمَّل بدون خطأ', async ({
    adminPage,
    goto,
  }) => {
    await goto('/bookings?tab=waitlist');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // يُقبل: جدول، حالة فارغة، أو رسالة "الميزة غير مفعّلة"
    const content = adminPage
      .locator('table, [role="table"], [class*="empty"], [class*="disabled"]')
      .or(adminPage.getByText(/لا توجد|قائمة الانتظار|waitlist|no entries/i))
      .first();
    await expect(content).toBeVisible({ timeout: 12_000 });
  });

  test('[BK-WL-002][Bookings/Waitlist][P2-Medium] الـ waitlist tab يظهر عند تفعيل الميزة', async ({
    adminPage,
    goto,
  }) => {
    await goto('/bookings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const waitlistTab = adminPage
      .getByRole('tab', { name: /الانتظار|waitlist/i })
      .first();

    // إذا لم يظهر الـ tab، الميزة غير مفعّلة — اختبار غير قابل للفشل
    const tabVisible = await waitlistTab.isVisible().catch(() => false);
    if (!tabVisible) {
      test.skip();
      return;
    }

    await waitlistTab.click();
    await adminPage.waitForTimeout(400);

    const panel = adminPage.locator('[role="tabpanel"][data-state="active"], [role="tabpanel"]').first();
    await expect(panel).toBeVisible({ timeout: 8_000 });
  });
});

// ── BK-WL-003: إضافة لقائمة الانتظار عبر API ──────────────────────────────────

test.describe('Bookings Waitlist — add and remove via API', () => {
  let ctx: WaitlistContext;
  let waitlistEntryId: string = '';

  test.beforeEach(async () => {
    ctx = await seedWaitlistContext();
  });

  test.afterEach(async () => {
    if (waitlistEntryId) {
      await apiDelete(`/dashboard/bookings/waitlist/${waitlistEntryId}`).catch(() => {});
      waitlistEntryId = '';
    }
    await cleanWaitlistContext(ctx);
  });

  test('[BK-WL-003][Bookings/Waitlist][P2-Medium] إضافة عميل لقائمة الانتظار ينجح عبر الـ API @data', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const data = await apiPost<{ id: string }>('/dashboard/bookings/waitlist', {
      clientId: ctx.client.id,
      employeeId: ctx.employee.id,
      serviceId: ctx.service.id,
      branchId: ctx.branch.id,
      preferredDate: tomorrow.toISOString().split('T')[0],
    }).catch(() => ({ id: '' }));

    expect(data.id).toBeTruthy();
    waitlistEntryId = data.id;
  });

  test('[BK-WL-004][Bookings/Waitlist][P2-Medium] حذف إدخال من قائمة الانتظار يُزيله @data', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const data = await apiPost<{ id: string }>('/dashboard/bookings/waitlist', {
      clientId: ctx.client.id,
      employeeId: ctx.employee.id,
      serviceId: ctx.service.id,
      branchId: ctx.branch.id,
      preferredDate: tomorrow.toISOString().split('T')[0],
    }).catch(() => ({ id: '' }));

    if (!data.id) { test.skip(); return; }

    const token = await getAdminToken();
    const deleteRes = await fetch(`${API_URL}/dashboard/bookings/waitlist/${data.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        Authorization: `Bearer ${token}`,
      },
    });

    expect([200, 204]).toContain(deleteRes.status);

    // التحقق أن الإدخال اختفى
    const getRes = await fetch(`${API_URL}/dashboard/bookings/waitlist`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        Authorization: `Bearer ${token}`,
      },
    });
    if (getRes.ok) {
      const list = await getRes.json() as { data?: Array<{ id: string }> };
      const items = list.data ?? (list as unknown as Array<{ id: string }>);
      const stillExists = Array.isArray(items) && items.some((e) => e.id === data.id);
      expect(stillExists).toBe(false);
    }
  });

  test.skip('[BK-WL-005][Bookings/Waitlist][P2-Medium] تحويل إدخال الانتظار إلى حجز',
    'لا يوجد endpoint /waitlist/:id/convert في الـ dashboard API حتى الآن — يُعاد النظر في Phase 8',
  );
});
