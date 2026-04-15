/**
 * CareKit Dashboard — Bookings: Validation
 *
 * يغطي:
 *   - رفض حجز بتاريخ في الماضي (الـ API يُرجع 400)
 *   - رفض حجز بدون branchId
 *   - رفض حجز بدون clientId
 *   - رفض حجز عندما الموظف لا يُقدّم الخدمة المحددة
 *
 * حالات مُخطاة:
 *   - التحقق من الـ UI wizard مباشرةً لحقول مطلوبة: الـ wizard
 *     يمنع التقدم بين الخطوات بدون اختيار — هذا مُغطى بـ BK-CR-003.
 *   - service + employee mismatch من الـ UI: الـ wizard يُظهر
 *     فقط الموظفين الذين يُقدّمون الخدمة — المنع يحدث في الخطوة نفسها.
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
import { getAdminToken, API_URL, TENANT_ID, uid } from '../setup/seeds/seed-base';

// ── Shared context ─────────────────────────────────────────────────────────────

interface ValidationContext {
  branch: SeededBranch;
  client: SeededClient;
  employee: SeededEmployee;
  service: SeededService;
}

async function seedValidationContext(): Promise<ValidationContext> {
  const [branch, client, employee, service] = await Promise.all([
    createBranch({ nameAr: 'فرع تحقق' }),
    createClient({ firstName: 'BKValidation', lastName: 'Client' }),
    createEmployee({ name: 'BKValidation Employee' }),
    createService({ nameAr: 'خدمة تحقق', price: 100, durationMins: 30 }),
  ]);
  return { branch, client, employee, service };
}

async function cleanValidationContext(ctx: ValidationContext): Promise<void> {
  await Promise.allSettled([
    deleteClient(ctx.client.id),
    deleteEmployee(ctx.employee.id),
    deleteService(ctx.service.id),
    deleteBranch(ctx.branch.id),
  ]);
}

// ── BK-VAL-001: تاريخ الماضي يُرفض ───────────────────────────────────────────

test.describe('Bookings Validation — past date rejected', () => {
  let ctx: ValidationContext;

  test.beforeEach(async () => {
    ctx = await seedValidationContext();
  });

  test.afterEach(async () => {
    await cleanValidationContext(ctx);
  });

  test('[BK-VAL-001][Bookings/Validation][P0-Critical] حجز بتاريخ في الماضي يُرجع 400 @critical @data', async () => {
    const token = await getAdminToken();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

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
        scheduledAt: yesterday.toISOString(),
        payAtClinic: true,
      }),
    });

    expect(res.status).toBe(400);
  });

  test('[BK-VAL-002][Bookings/Validation][P0-Critical] رسالة خطأ تاريخ الماضي تذكر "future" @critical @data', async () => {
    const token = await getAdminToken();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

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
        scheduledAt: yesterday.toISOString(),
        payAtClinic: true,
      }),
    });

    const body = await res.json() as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? '');
    expect(message.toLowerCase()).toMatch(/future|past|scheduled/i);
  });
});

// ── BK-VAL-003: حقول مطلوبة مفقودة ──────────────────────────────────────────

test.describe('Bookings Validation — missing required fields', () => {
  let ctx: ValidationContext;

  test.beforeEach(async () => {
    ctx = await seedValidationContext();
  });

  test.afterEach(async () => {
    await cleanValidationContext(ctx);
  });

  test('[BK-VAL-003][Bookings/Validation][P1-High] حجز بدون branchId يُرجع 400 @data', async () => {
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
        // branchId مفقود
        clientId: ctx.client.id,
        employeeId: ctx.employee.id,
        serviceId: ctx.service.id,
        scheduledAt: tomorrow.toISOString(),
        payAtClinic: true,
      }),
    });

    expect([400, 422]).toContain(res.status);
  });

  test('[BK-VAL-004][Bookings/Validation][P1-High] حجز بدون clientId يُرجع 400 @data', async () => {
    const token = await getAdminToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 30, 0, 0);

    const res = await fetch(`${API_URL}/dashboard/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        branchId: ctx.branch.id,
        // clientId مفقود
        employeeId: ctx.employee.id,
        serviceId: ctx.service.id,
        scheduledAt: tomorrow.toISOString(),
        payAtClinic: true,
      }),
    });

    expect([400, 422]).toContain(res.status);
  });

  test('[BK-VAL-005][Bookings/Validation][P1-High] حجز بدون serviceId يُرجع 400 @data', async () => {
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
        // serviceId مفقود
        scheduledAt: tomorrow.toISOString(),
        payAtClinic: true,
      }),
    });

    expect([400, 422]).toContain(res.status);
  });
});

// ── BK-VAL-006: عدم تطابق الموظف + الخدمة ────────────────────────────────────

test.describe('Bookings Validation — employee-service mismatch', () => {
  let ctx: ValidationContext;
  let otherService: SeededService;

  test.beforeEach(async () => {
    ctx = await seedValidationContext();
    // خدمة أخرى لا يُقدّمها الموظف
    otherService = await createService({
      nameAr: `خدمة أخرى ${uid()}`,
      price: 150,
      durationMins: 45,
    });
  });

  test.afterEach(async () => {
    await deleteService(otherService.id).catch(() => {});
    await cleanValidationContext(ctx);
  });

  test('[BK-VAL-006][Bookings/Validation][P1-High] موظف لا يُقدّم الخدمة → 400 من الـ API @data', async () => {
    const token = await getAdminToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 30, 0, 0);

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
        serviceId: otherService.id, // خدمة لا يُقدّمها الموظف
        scheduledAt: tomorrow.toISOString(),
        payAtClinic: true,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { message?: string };
    expect(body.message?.toLowerCase()).toMatch(/employee|service|provide/i);
  });

  test.skip('[BK-VAL-007][Bookings/Validation][P2-Medium] الـ wizard لا يعرض الخدمات التي لا يُقدّمها الموظف',
    'StepEmployee يُصفّي حسب serviceId — التحقق يحتاج بيانات employee-service link حقيقية في الـ test DB',
  );
});
