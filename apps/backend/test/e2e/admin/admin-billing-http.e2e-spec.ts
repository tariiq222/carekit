/**
 * Admin Billing Actions — HTTP-level E2E tests.
 *
 * Tests admin billing operations via the real HTTP API:
 * 1. GET /api/v1/admin/billing/subscriptions — list all subscriptions
 * 2. GET /api/v1/admin/billing/subscriptions/:orgId — org billing detail
 * 3. POST /api/v1/admin/billing/subscriptions/:orgId/force-charge
 * 4. POST /api/v1/admin/billing/subscriptions/:orgId/cancel-scheduled
 * 5. PATCH /api/v1/admin/billing/subscriptions/:orgId/plan
 * 6. POST /api/v1/admin/billing/credits
 *
 * Data is seeded via bootHarness (same test DB as createTestApp).
 */
import SuperTest from 'supertest';
import * as jwt from 'jsonwebtoken';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables, reseedPlans } from '../../setup/db.setup';
import { bootHarness } from '../../tenant-isolation/isolation-harness';

const ACCESS_SECRET = 'test-access-secret-32chars-min';
const ADMIN_HOST = 'admin.test';

describe('Admin Billing Actions (HTTP e2e)', () => {
  let req: SuperTest.Agent;
  let superAdminUserId: string;
  let regularUserId: string;
  let BASIC_PLAN_ID: string;
  let ENTERPRISE_PLAN_ID: string;
  let harness: Awaited<ReturnType<typeof bootHarness>>;
  let testOrgId: string;

  beforeAll(async () => {
    process.env.ADMIN_HOSTS = ADMIN_HOST;
    ({ request: req } = await createTestApp({ globalPrefix: true }));
    harness = await bootHarness();

    await cleanTables(['SuperAdminActionLog', 'Subscription', 'Plan', 'User', 'Membership']);

    const user = await testPrisma.user.upsert({
      where: { email: 'billing-http-super@e2e.test' },
      update: {},
      create: {
        email: 'billing-http-super@e2e.test',
        name: 'Billing HTTP Super Admin',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: true,
      },
    });
    superAdminUserId = user.id;

    const regularUser = await testPrisma.user.upsert({
      where: { email: 'billing-http-regular@e2e.test' },
      update: {},
      create: {
        email: 'billing-http-regular@e2e.test',
        name: 'Billing HTTP Regular User',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: false,
      },
    });
    regularUserId = regularUser.id;

    const plans = await harness.prisma.plan.findMany({ where: { slug: { in: ['BASIC', 'ENTERPRISE'] } } });
    if (plans.length === 0) {
      const basic = await harness.prisma.plan.create({
        data: {
          slug: 'BASIC',
          nameAr: 'الأساسية',
          nameEn: 'Basic',
          priceMonthly: 99,
          priceAnnual: 990,
          currency: 'SAR',
          limits: {
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
            email_templates: true,
            coupons: false,
            advanced_reports: false,
            intake_forms: false,
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
          },
          isActive: true,
          sortOrder: 1,
        },
      });
      const enterprise = await harness.prisma.plan.create({
        data: {
          slug: 'ENTERPRISE',
          nameAr: 'المؤسسية',
          nameEn: 'Enterprise',
          priceMonthly: 299,
          priceAnnual: 2990,
          currency: 'SAR',
          limits: {
            maxBranches: -1,
            maxEmployees: -1,
            maxServices: -1,
            maxBookingsPerMonth: -1,
            maxClients: -1,
            maxStorageMB: -1,
            overageRateBookings: 0,
            overageRateClients: 0,
            overageRateStorageGB: 0,
            recurring_bookings: true,
            waitlist: true,
            group_sessions: true,
            ai_chatbot: true,
            email_templates: true,
            coupons: true,
            advanced_reports: true,
            intake_forms: true,
            custom_roles: true,
            activity_log: true,
            zoom_integration: true,
            walk_in_bookings: true,
            bank_transfer_payments: true,
            multi_branch: true,
            departments: true,
            client_ratings: true,
            data_export: true,
            sms_provider_per_tenant: true,
            white_label_mobile: true,
            custom_domain: true,
            api_access: true,
            webhooks: true,
            priority_support: true,
            audit_export: true,
            multi_currency: true,
            email_fallback_monthly: -1,
            sms_fallback_monthly: -1,
          },
          isActive: true,
          sortOrder: 3,
        },
      });
      BASIC_PLAN_ID = basic.id;
      ENTERPRISE_PLAN_ID = enterprise.id;
    } else {
      BASIC_PLAN_ID = plans.find((p) => p.slug === 'BASIC')!.id;
      ENTERPRISE_PLAN_ID = plans.find((p) => p.slug === 'ENTERPRISE')!.id;
    }

    const org = await harness.createOrg(`billing-http-org-${Date.now()}`, 'منظمة فوترة');
    testOrgId = org.id;

    const now = new Date();
    await harness.prisma.subscription.create({
      data: {
        organizationId: testOrgId,
        planId: BASIC_PLAN_ID,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
        cancelAtPeriodEnd: false,
      },
    });

    await harness.prisma.savedCard.create({
      data: {
        organizationId: testOrgId,
        moyasarTokenId: `tok_test_${Date.now()}`,
        last4: '1234',
        brand: 'VISA',
        isDefault: true,
        expiryMonth: 12,
        expiryYear: 2027,
      },
    });
  });

  afterAll(async () => {
    if (harness) {
      await harness.cleanupOrg(testOrgId);
      await harness.close();
    }
    await cleanTables(['SuperAdminActionLog', 'Subscription', 'Plan', 'User', 'Membership']);
    await reseedPlans();
    await closeTestApp();
  });

  function superadminToken(): string {
    return jwt.sign(
      {
        sub: superAdminUserId,
        email: 'billing-http-super@e2e.test',
        role: 'ADMIN',
        isSuperAdmin: true,
        customRoleId: null,
        permissions: [],
        features: [],
      },
      ACCESS_SECRET,
      { expiresIn: '1h' },
    );
  }

  function regularToken(): string {
    return jwt.sign(
      {
        sub: regularUserId,
        email: 'billing-http-regular@e2e.test',
        role: 'ADMIN',
        isSuperAdmin: false,
        customRoleId: null,
        permissions: [],
        features: [],
      },
      ACCESS_SECRET,
      { expiresIn: '1h' },
    );
  }

  describe('GET /api/v1/admin/billing/subscriptions', () => {
    it('returns 200 with subscriptions list', async () => {
      const res = await req
        .get('/api/v1/admin/billing/subscriptions')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('returns 200 with status filter', async () => {
      const res = await req
        .get('/api/v1/admin/billing/subscriptions?status=ACTIVE')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('returns 403 when not superadmin', async () => {
      const res = await req
        .get('/api/v1/admin/billing/subscriptions')
        .set('Authorization', `Bearer ${regularToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/billing/subscriptions/:orgId', () => {
    it('returns 200 with org billing detail', async () => {
      const res = await req
        .get(`/api/v1/admin/billing/subscriptions/${testOrgId}`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('subscription');
      expect(res.body.subscription.organizationId).toBe(testOrgId);
    });

    it('returns 404 for non-existent org', async () => {
      const res = await req
        .get('/api/v1/admin/billing/subscriptions/00000000-0000-4000-8000-000000000999')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/admin/billing/subscriptions/:orgId/force-charge', () => {
    it('returns 400 when subscription is not PAST_DUE', async () => {
      const res = await req
        .post(`/api/v1/admin/billing/subscriptions/${testOrgId}/force-charge`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('PAST_DUE');
    });

    it('returns 400 when no failed invoice exists', async () => {
      const res = await req
        .post(`/api/v1/admin/billing/subscriptions/${testOrgId}/force-charge`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 403 when not superadmin', async () => {
      const res = await req
        .post(`/api/v1/admin/billing/subscriptions/${testOrgId}/force-charge`)
        .set('Authorization', `Bearer ${regularToken()}`)
        .set('Host', ADMIN_HOST)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/admin/billing/subscriptions/:orgId/cancel-scheduled', () => {
    it('returns 400 when cancelAtPeriodEnd is false (not scheduled)', async () => {
      const res = await req
        .post(`/api/v1/admin/billing/subscriptions/${testOrgId}/cancel-scheduled`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cancelAtPeriodEnd');
    });

    it('returns 403 when not superadmin', async () => {
      const res = await req
        .post(`/api/v1/admin/billing/subscriptions/${testOrgId}/cancel-scheduled`)
        .set('Authorization', `Bearer ${regularToken()}`)
        .set('Host', ADMIN_HOST)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/admin/billing/subscriptions/:orgId/plan', () => {
    it('changes plan from BASIC to ENTERPRISE and returns 200', async () => {
      const res = await req
        .patch(`/api/v1/admin/billing/subscriptions/${testOrgId}/plan`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          newPlanId: ENTERPRISE_PLAN_ID,
          reason: 'Upgrading org to ENTERPRISE plan via E2E test',
        });

      expect(res.status).toBe(200);
      expect(res.body.planId).toBe(ENTERPRISE_PLAN_ID);
    });

    it('returns 400 when trying to change to the same plan', async () => {
      const res = await req
        .patch(`/api/v1/admin/billing/subscriptions/${testOrgId}/plan`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          newPlanId: ENTERPRISE_PLAN_ID,
          reason: 'Trying to change to same plan for E2E test',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('plan_unchanged');
    });

    it('returns 400 when reason is missing', async () => {
      const res = await req
        .patch(`/api/v1/admin/billing/subscriptions/${testOrgId}/plan`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          newPlanId: BASIC_PLAN_ID,
        });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await req
        .patch(`/api/v1/admin/billing/subscriptions/${testOrgId}/plan`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          newPlanId: '00000000-0000-0000-0000-000000000999',
          reason: 'Trying non-existent plan for E2E test',
        });

      expect(res.status).toBe(404);
    });

    it('returns 404 for non-existent org subscription', async () => {
      const res = await req
        .patch('/api/v1/admin/billing/subscriptions/00000000-0000-0000-0000-000000000999/plan')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          newPlanId: BASIC_PLAN_ID,
          reason: 'Trying to change plan for non-existent org for E2E test',
        });

      expect(res.status).toBe(404);
    });

    it('returns 403 when not superadmin', async () => {
      const res = await req
        .patch(`/api/v1/admin/billing/subscriptions/${testOrgId}/plan`)
        .set('Authorization', `Bearer ${regularToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          newPlanId: BASIC_PLAN_ID,
          reason: 'Trying to change plan as non-superadmin for E2E test',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/admin/billing/credits', () => {
    it('grants credit to org and returns 201', async () => {
      const res = await req
        .post('/api/v1/admin/billing/credits')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          amount: 50,
          currency: 'SAR',
          reason: 'Granting credit for E2E test coverage',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.organizationId).toBe(testOrgId);
    });

    it('returns 400 when amount is missing', async () => {
      const res = await req
        .post('/api/v1/admin/billing/credits')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          reason: 'Trying to grant credit without amount for E2E test',
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when reason is too short', async () => {
      const res = await req
        .post('/api/v1/admin/billing/credits')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          amount: 50,
          reason: 'short',
        });

      expect(res.status).toBe(400);
    });

    it('returns 403 when not superadmin', async () => {
      const res = await req
        .post('/api/v1/admin/billing/credits')
        .set('Authorization', `Bearer ${regularToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          amount: 50,
          reason: 'Trying to grant credit as non-superadmin for E2E test',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/billing/invoices', () => {
    it('returns 200 with invoices list', async () => {
      const res = await req
        .get('/api/v1/admin/billing/invoices')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('meta');
    });

    it('returns 200 with organizationId filter', async () => {
      const res = await req
        .get(`/api/v1/admin/billing/invoices?organizationId=${testOrgId}`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/admin/billing/metrics', () => {
    it('returns 200 with billing metrics', async () => {
      const res = await req
        .get('/api/v1/admin/billing/metrics')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('mrr');
    });
  });
});
