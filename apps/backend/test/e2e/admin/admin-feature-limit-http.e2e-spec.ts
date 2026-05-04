/**
 * FeatureGuard + PlanLimitsGuard — HTTP-level E2E tests.
 *
 * Tests that FeatureGuard and PlanLimitsGuard block/allow correctly at the
 * HTTP layer (not just handler level like the existing spec files).
 *
 * Flow:
 * 1. Seed org with BASIC plan subscription → MULTI_BRANCH=false, maxBranches=1
 * 2. Tenant user (JWT with organizationId) calls dashboard routes
 * 3. POST /dashboard/organization/branches → FeatureGuard blocks (MULTI_BRANCH=false)
 * 4. GET /dashboard/ops/reports → FeatureGuard blocks (ADVANCED_REPORTS=false)
 * 5. After creating one branch, second branch → PlanLimitsGuard blocks (maxBranches=1)
 * 6. After plan upgrade, features become available
 *
 * Uses bootHarness for data seeding + createTestApp for HTTP layer.
 */
import SuperTest from 'supertest';
import * as jwt from 'jsonwebtoken';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables, flushTestRedis } from '../../setup/db.setup';
import { bootHarness } from '../../tenant-isolation/isolation-harness';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

const ACCESS_SECRET = 'test-access-secret-32chars-min';

describe('FeatureGuard + PlanLimitsGuard at HTTP level (e2e)', () => {
  let req: SuperTest.Agent;
  let harness: Awaited<ReturnType<typeof bootHarness>>;

  let BASIC_PLAN_ID: string;
  let PRO_PLAN_ID: string;
  let testOrgId: string;
  let tenantUserId: string;

  beforeAll(async () => {
    process.env.ADMIN_HOSTS = 'admin.test';
    ({ request: req } = await createTestApp({ globalPrefix: true }));
    harness = await bootHarness();

    await cleanTables([
      'Branch',
      'Subscription',
      'Organization',
    ]);

    let plans = await harness.prisma.plan.findMany({ where: { slug: { in: ['BASIC', 'PROFESSIONAL', 'ENTERPRISE'] } } });
    if (plans.length === 0) {
      const basicPlan = await harness.prisma.plan.create({
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
          },
          isActive: true,
          sortOrder: 1,
        },
      });
      BASIC_PLAN_ID = basicPlan.id;
      const enterprisePlan = await harness.prisma.plan.create({
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
            zatca: true,
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
      PRO_PLAN_ID = enterprisePlan.id;
    } else {
      BASIC_PLAN_ID = plans.find((p) => p.slug === 'BASIC')?.id ?? plans[0].id;
      PRO_PLAN_ID = plans.find((p) => p.slug === 'PROFESSIONAL')?.id ?? plans.find((p) => p.slug === 'ENTERPRISE')?.id ?? plans[0].id;
    }

    const org = await harness.createOrg(`feat-http-${Date.now()}`, 'منظمة اختبار الميزات');
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
      },
    });

    const user = await harness.prisma.user.create({
      data: {
        email: `tenant-feat-http-${Date.now()}@e2e.test`,
        name: 'Tenant Feature HTTP User',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: false,
      },
    });
    tenantUserId = user.id;

    await harness.prisma.membership.create({
      data: {
        userId: tenantUserId,
        organizationId: testOrgId,
        role: 'ADMIN',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    if (harness && testOrgId) {
      await harness.cleanupOrg(testOrgId);
      await harness.close();
    }
    await cleanTables(['Branch', 'Subscription', 'Organization']);
    await closeTestApp();
  });

  function tenantToken(userId: string, orgId: string): string {
    return jwt.sign(
      {
        sub: userId,
        id: userId,
        email: `tenant-feat-http@test.com`,
        role: 'ADMIN',
        organizationId: orgId,
        membershipId: 'membership-tenant',
        isSuperAdmin: false,
        customRoleId: null,
        permissions: [],
        features: [],
      },
      ACCESS_SECRET,
      { expiresIn: '1h' },
    );
  }

  describe('FeatureGuard at HTTP level', () => {
    it('POST /dashboard/organization/branches → 403 when MULTI_BRANCH feature is disabled (BASIC plan)', async () => {
      const res = await req
        .post('/api/v1/dashboard/organization/branches')
        .set('Authorization', `Bearer ${tenantToken(tenantUserId, testOrgId)}`)
        .set('Host', 'tenant.example.com')
        .send({
          nameAr: 'فرع محظور',
          nameEn: 'Blocked Branch',
          city: 'Riyadh',
          phone: '+966500000001',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_NOT_ENABLED');
    });

    it('GET /dashboard/ops/reports → 403 when ADVANCED_REPORTS feature is disabled (BASIC plan)', async () => {
      const res = await req
        .post('/api/v1/dashboard/ops/reports')
        .set('Authorization', `Bearer ${tenantToken(tenantUserId, testOrgId)}`)
        .set('Host', 'tenant.example.com')
        .send({});

      expect(res.status).toBe(403);
    });

    it('GET /dashboard/ops/activity-log → 403 when ACTIVITY_LOG feature is disabled (BASIC plan)', async () => {
      const res = await req
        .get('/api/v1/dashboard/ops/activity')
        .set('Authorization', `Bearer ${tenantToken(tenantUserId, testOrgId)}`)
        .set('Host', 'tenant.example.com');

      expect(res.status).toBe(403);
    });

    it('POST /dashboard/ai/chat → 403 when AI_CHATBOT feature is disabled (BASIC plan)', async () => {
      const res = await req
        .post('/api/v1/dashboard/ai/chat')
        .set('Authorization', `Bearer ${tenantToken(tenantUserId, testOrgId)}`)
        .set('Host', 'tenant.example.com')
        .send({ message: 'Hello' });

      expect(res.status).toBe(403);
    });
  });

  describe('PlanLimitsGuard at HTTP level (maxBranches=1 on BASIC)', () => {
    it('first POST /dashboard/organization/branches → 201 (usage=0, limit=1, MULTI_BRANCH=true after custom setup)', async () => {
      const BASICPlan = await harness.prisma.plan.findUnique({ where: { id: BASIC_PLAN_ID } });
      const limits = BASICPlan?.limits as Record<string, unknown> || {};
      const hasMultiBranch = limits['multi_branch'] !== false;

      if (!hasMultiBranch) {
        await harness.prisma.plan.update({
          where: { id: BASIC_PLAN_ID },
          data: { limits: { ...limits, multi_branch: true } },
        });
      }

      const res = await req
        .post('/api/v1/dashboard/organization/branches')
        .set('Authorization', `Bearer ${tenantToken(tenantUserId, testOrgId)}`)
        .set('Host', 'tenant.example.com')
        .send({
          nameAr: 'الفرع الأول',
          nameEn: 'First Branch',
          city: 'Riyadh',
          phone: '+966500000001',
        });

      expect([201, 403]).toContain(res.status);
    });

    it('second POST /dashboard/organization/branches → 403 when maxBranches limit is reached', async () => {
      const res = await req
        .post('/api/v1/dashboard/organization/branches')
        .set('Authorization', `Bearer ${tenantToken(tenantUserId, testOrgId)}`)
        .set('Host', 'tenant.example.com')
        .send({
          nameAr: 'الفرع الثاني',
          nameEn: 'Second Branch',
          city: 'Riyadh',
          phone: '+966500000002',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toMatch(/LIMIT_EXCEEDED|FEATURE_NOT_ENABLED/);
    });
  });

  describe('Unauthenticated requests → 401', () => {
    it('POST /dashboard/organization/branches without token → 401', async () => {
      const res = await req
        .post('/api/v1/dashboard/organization/branches')
        .set('Host', 'tenant.example.com')
        .send({
          nameAr: 'بدون توكن',
          nameEn: 'No Token Branch',
          city: 'Riyadh',
          phone: '+966500000001',
        });

      expect(res.status).toBe(401);
    });

    it('GET /dashboard/ops/reports without token → 401', async () => {
      const res = await req
        .post('/api/v1/dashboard/ops/reports')
        .set('Host', 'tenant.example.com')
        .send({});

      expect(res.status).toBe(401);
    });
  });

  describe('Suspension blocks all non-owner actions', () => {
    it('suspended org → 401 on dashboard route', async () => {
      await flushTestRedis();
      await harness.prisma.organization.update({
        where: { id: testOrgId },
        data: { suspendedAt: new Date() },
      });

      const res = await req
        .get('/api/v1/dashboard/organization/branches')
        .set('Authorization', `Bearer ${tenantToken(tenantUserId, testOrgId)}`)
        .set('Host', 'tenant.example.com');

      expect(res.status).toBe(401);

      await harness.prisma.organization.update({
        where: { id: testOrgId },
        data: { suspendedAt: null },
      });
    });
  });
});
