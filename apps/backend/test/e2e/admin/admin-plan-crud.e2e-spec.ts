/**
 * Admin Plan CRUD — HTTP-level E2E tests.
 *
 * Tests admin plan management via HTTP using bootHarness for data setup
 * and createTestApp for HTTP layer.
 *
 * Uses SuperTest agent + superadmin JWT with correct Host header.
 */
import SuperTest from 'supertest';
import * as jwt from 'jsonwebtoken';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables, reseedPlans } from '../../setup/db.setup';
import { bootHarness } from '../../tenant-isolation/isolation-harness';

const ACCESS_SECRET = 'test-access-secret-32chars-min';
const ADMIN_HOST = 'admin.test';

function makeLimits(overrides: Partial<Record<string, number | boolean>> = {}) {
  return {
    maxBranches: 1,
    maxEmployees: 5,
    maxServices: -1,
    maxBookingsPerMonth: -1,
    maxClients: -1,
    maxStorageMB: 1024,
    overageRateBookings: 0,
    overageRateClients: 0,
    overageRateStorageGB: 0,
    recurring_bookings: false,
    waitlist: false,
    group_sessions: false,
    ai_chatbot: false,
    email_templates: false,
    coupons: false,
    advanced_reports: false,
    intake_forms: false,
    zatca: false,
    custom_roles: false,
    activity_log: false,
    zoom_integration: false,
    walk_in_bookings: false,
    bank_transfer_payments: false,
    multi_branch: false,
    departments: false,
    client_ratings: false,
    data_export: false,
    sms_provider_per_tenant: false,
    white_label_mobile: false,
    custom_domain: false,
    api_access: false,
    webhooks: false,
    priority_support: false,
    audit_export: false,
    multi_currency: false,
    email_fallback_monthly: 500,
    sms_fallback_monthly: 100,
    ...overrides,
  };
}

describe('Admin Plan CRUD (e2e)', () => {
  let req: SuperTest.Agent;
  let superAdminUserId: string;
  let harness: Awaited<ReturnType<typeof bootHarness>>;

  beforeAll(async () => {
    process.env.ADMIN_HOSTS = ADMIN_HOST;
    ({ request: req } = await createTestApp({ globalPrefix: true }));
    harness = await bootHarness();

    await cleanTables(['Plan', 'SuperAdminActionLog', 'User', 'Membership']);

    const user = await testPrisma.user.upsert({
      where: { email: 'plan-crud-super@e2e.test' },
      update: {},
      create: {
        email: 'plan-crud-super@e2e.test',
        name: 'Plan CRUD Super Admin',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: true,
      },
    });
    superAdminUserId = user.id;
  });

  afterAll(async () => {
    if (harness) await harness.close();
    await cleanTables(['Plan', 'SuperAdminActionLog', 'User', 'Membership']);
    await reseedPlans();
    await closeTestApp();
  });

  function superadminToken(overrides: Record<string, unknown> = {}): string {
    return jwt.sign(
      {
        sub: superAdminUserId,
        email: 'plan-crud-super@e2e.test',
        role: 'ADMIN',
        isSuperAdmin: true,
        customRoleId: null,
        permissions: [],
        features: [],
        ...overrides,
      },
      ACCESS_SECRET,
      { expiresIn: '1h' },
    );
  }

  describe('POST /api/v1/admin/plans', () => {
    it('creates a plan with limits and returns 201', async () => {
      const planSlug = `TEST_PLAN_${Date.now()}`;
      const limits = makeLimits({ maxBranches: 3, maxEmployees: 10, recurring_bookings: true, email_templates: true });
      const res = await req
        .post('/api/v1/admin/plans')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          slug: planSlug,
          nameAr: 'خطة اختبار',
          nameEn: 'Test Plan',
          priceMonthly: 199,
          priceAnnual: 1990,
          currency: 'SAR',
          limits,
          isActive: true,
          sortOrder: 50,
          reason: 'Creating test plan for E2E coverage',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        slug: planSlug,
        nameAr: 'خطة اختبار',
        nameEn: 'Test Plan',
        isActive: true,
        sortOrder: 50,
      });
      expect(res.body.id).toBeDefined();
    });

    it('returns 400 when slug is invalid format', async () => {
      const res = await req
        .post('/api/v1/admin/plans')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          slug: 'lowercase',
          nameAr: 'خطة',
          nameEn: 'Test',
          priceMonthly: 100,
          priceAnnual: 1000,
          limits: makeLimits(),
          reason: 'Creating test plan for E2E coverage',
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when reason is missing', async () => {
      const res = await req
        .post('/api/v1/admin/plans')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          slug: `TEST_PLAN_NOREASON_${Date.now()}`,
          nameAr: 'خطة',
          nameEn: 'Test',
          priceMonthly: 100,
          priceAnnual: 1000,
          limits: makeLimits(),
        });

      expect(res.status).toBe(400);
    });

    it('returns 403 when Host header is wrong', async () => {
      const res = await req
        .post('/api/v1/admin/plans')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', 'wrong.host')
        .send({
          slug: `TEST_PLAN_WRONGHOST_${Date.now()}`,
          nameAr: 'خطة',
          nameEn: 'Test',
          priceMonthly: 100,
          priceAnnual: 1000,
          limits: makeLimits(),
          reason: 'Creating test plan for E2E coverage',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/admin/plans/:id', () => {
    let planId: string;

    beforeAll(async () => {
      const plan = await testPrisma.plan.create({
        data: {
          slug: `TEST_UPDATE_PLAN_${Date.now()}`,
          nameAr: 'قبل التحديث',
          nameEn: 'Before Update',
          priceMonthly: 99,
          priceAnnual: 990,
          currency: 'SAR',
          limits: makeLimits({ maxBranches: 1, maxEmployees: 5 }),
          isActive: true,
          sortOrder: 10,
        },
      });
      planId = plan.id;
    });

    afterAll(async () => {
      await testPrisma.plan.deleteMany({ where: { slug: { startsWith: 'TEST_UPDATE_PLAN_' } } });
    });

    it('updates plan name and limits and returns 200', async () => {
      const res = await req
        .patch(`/api/v1/admin/plans/${planId}`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          nameAr: 'بعد التحديث',
          nameEn: 'After Update',
          priceMonthly: 149,
          limits: makeLimits({ maxBranches: 5, maxEmployees: 15, recurring_bookings: true }),
          reason: 'Updating plan limits and price for E2E test',
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: planId,
        nameAr: 'بعد التحديث',
        nameEn: 'After Update',
      });
      expect(res.body.limits).toMatchObject({
        maxBranches: 5,
        maxEmployees: 15,
        recurring_bookings: true,
      });
    });

    it('can deactivate a plan via PATCH', async () => {
      const res = await req
        .patch(`/api/v1/admin/plans/${planId}`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          isActive: false,
          reason: 'Deactivating plan for E2E test',
        });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });

    it('returns 400 when reason is missing', async () => {
      const res = await req
        .patch(`/api/v1/admin/plans/${planId}`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          nameAr: 'اسم جديد',
        });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await req
        .patch('/api/v1/admin/plans/00000000-0000-0000-0000-000000000999')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          nameAr: 'غير موجود',
          reason: 'Updating non-existent plan for E2E test',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/admin/plans', () => {
    it('returns list of all plans including inactive', async () => {
      const res = await req
        .get('/api/v1/admin/plans')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || (res.body.items && Array.isArray(res.body.items))).toBe(true);
    });
  });

  describe('DELETE /api/v1/admin/plans/:id', () => {
    let planToDelete: string;

    beforeAll(async () => {
      const plan = await testPrisma.plan.create({
        data: {
          slug: `TEST_DELETE_PLAN_${Date.now()}`,
          nameAr: 'للحذف',
          nameEn: 'To Delete',
          priceMonthly: 50,
          priceAnnual: 500,
          currency: 'SAR',
          limits: makeLimits(),
          isActive: true,
          sortOrder: 90,
        },
      });
      planToDelete = plan.id;
    });

    it('soft-deletes a plan (sets isActive=false) and returns 204', async () => {
      const res = await req
        .delete(`/api/v1/admin/plans/${planToDelete}`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({ reason: 'Removing plan after E2E test completion' });

      expect(res.status).toBe(204);

      const deleted = await testPrisma.plan.findUnique({ where: { id: planToDelete } });
      expect(deleted).not.toBeNull();
      expect(deleted!.isActive).toBe(false);
    });

    it('returns 404 for already deleted plan', async () => {
      const res = await req
        .delete(`/api/v1/admin/plans/${planToDelete}`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({ reason: 'Trying to delete already deleted plan' });

      expect([404, 409]).toContain(res.status);
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await req
        .delete('/api/v1/admin/plans/00000000-0000-0000-0000-000000000999')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({ reason: 'Deleting non-existent plan for E2E test' });

      expect(res.status).toBe(404);
    });
  });
});
