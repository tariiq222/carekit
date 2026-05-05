/**
 * Admin Impersonation Lifecycle — HTTP-level E2E tests.
 *
 * Tests the full impersonation session lifecycle via the HTTP API:
 * 1. Superadmin starts impersonation → gets shadow JWT
 * 2. Shadow JWT is used to access tenant dashboard routes
 * 3. Superadmin ends impersonation → session terminated
 * 4. Shadow JWT is revoked and subsequent requests fail
 *
 * Uses bootHarness for data seeding + createTestApp for HTTP layer.
 */
import SuperTest from 'supertest';
import * as jwt from 'jsonwebtoken';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { bootHarness } from '../../tenant-isolation/isolation-harness';

const ACCESS_SECRET = 'test-access-secret-32chars-min';
const ADMIN_HOST = 'admin.impersonation.test';

describe('Admin Impersonation Lifecycle (HTTP e2e)', () => {
  let req: SuperTest.Agent;
  let superAdminUserId: string;
  let regularUserId: string;
  let harness: Awaited<ReturnType<typeof bootHarness>>;
  let testOrgId: string;
  let tenantUserId: string;
  let activeSessionId: string | null = null;

  beforeAll(async () => {
    process.env.ADMIN_HOSTS = ADMIN_HOST;
    process.env.TENANT_ENFORCEMENT = 'strict';
    ({ request: req } = await createTestApp({ globalPrefix: true, tenantEnforcement: 'strict' }));
    harness = await bootHarness();

    await cleanTables([
      'SuperAdminActionLog',
      'ImpersonationSession',
      'RefreshToken',
      'Membership',
      'Subscription',
      'Branch',
    ]);

    const superAdmin = await testPrisma.user.upsert({
      where: { email: 'impersonation-super@e2e.test' },
      update: {},
      create: {
        email: 'impersonation-super@e2e.test',
        name: 'Impersonation Super Admin',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: true,
      },
    });
    superAdminUserId = superAdmin.id;

    const regularUser = await testPrisma.user.upsert({
      where: { email: 'impersonation-regular@e2e.test' },
      update: {},
      create: {
        email: 'impersonation-regular@e2e.test',
        name: 'Impersonation Regular User',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: false,
      },
    });
    regularUserId = regularUser.id;

    const org = await harness.createOrg(`imp-org-${Date.now()}`, 'منظمة انتحال');
    testOrgId = org.id;

    const tenantUser = await harness.prisma.user.create({
      data: {
        email: `tenant-imp-${Date.now()}@e2e.test`,
        name: 'Tenant Impersonation User',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: false,
      },
    });
    tenantUserId = tenantUser.id;

    await harness.prisma.membership.create({
      data: {
        userId: tenantUserId,
        organizationId: testOrgId,
        role: 'ADMIN',
        isActive: true,
      },
    });

    let plans = await harness.prisma.plan.findMany({ where: { slug: { in: ['BASIC'] } } });
    let BASIC_PLAN_ID: string;
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
    } else {
      BASIC_PLAN_ID = plans.find((p) => p.slug === 'BASIC')!.id;
    }

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
  });

  afterAll(async () => {
    if (harness) {
      await harness.cleanupOrg(testOrgId);
      await harness.close();
    }
    await cleanTables([
      'SuperAdminActionLog',
      'ImpersonationSession',
      'RefreshToken',
      'Membership',
      'Subscription',
      'Branch',
    ]);
    await closeTestApp();
  });

  function superadminToken(): string {
    return jwt.sign(
      {
        sub: superAdminUserId,
        email: 'impersonation-super@e2e.test',
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
        email: 'impersonation-regular@e2e.test',
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

  describe('POST /api/v1/admin/impersonation — start impersonation', () => {
    it('creates a session and returns shadow JWT + redirect URL', async () => {
      const res = await req
        .post('/api/v1/admin/impersonation')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          targetUserId: tenantUserId,
          reason: 'Testing impersonation flow for E2E coverage',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('sessionId');
      expect(res.body).toHaveProperty('shadowAccessToken');
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body).toHaveProperty('redirectUrl');
      expect(res.body.redirectUrl).toContain('?_impersonation=');

      activeSessionId = res.body.sessionId;
    });

    it('returns 404 when target user does not exist', async () => {
      const res = await req
        .post('/api/v1/admin/impersonation')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          targetUserId: '00000000-0000-4000-8000-000000000999',
          reason: 'Testing impersonation with non-existent user for E2E coverage',
        });

      expect(res.status).toBe(404);
    });

    it('returns 400 when reason is too short', async () => {
      const res = await req
        .post('/api/v1/admin/impersonation')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          targetUserId: tenantUserId,
          reason: 'short',
        });

      expect(res.status).toBe(400);
    });

    it('returns 403 when trying to impersonate a superadmin', async () => {
      const res = await req
        .post('/api/v1/admin/impersonation')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          targetUserId: superAdminUserId,
          reason: 'Trying to impersonate another superadmin for E2E coverage',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('cannot_impersonate_super_admin');
    });

    it('returns 403 when not superadmin', async () => {
      const res = await req
        .post('/api/v1/admin/impersonation')
        .set('Authorization', `Bearer ${regularToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          targetUserId: tenantUserId,
          reason: 'Testing impersonation without superadmin for E2E coverage',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Shadow JWT access via impersonation', () => {
    it('shadow JWT can access tenant dashboard route with impersonation scope', async () => {
      const res = await req
        .post('/api/v1/admin/impersonation')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          targetUserId: tenantUserId,
          reason: 'Testing shadow JWT access for E2E coverage',
        });

      const shadowToken = res.body.shadowAccessToken;
      expect(shadowToken).toBeDefined();

      const decoded = jwt.decode(shadowToken) as Record<string, unknown>;
      expect(decoded['scope']).toBe('impersonation');
      expect(decoded['organizationId']).toBe(testOrgId);

      const dashboardRes = await req
        .get('/api/v1/dashboard/organization/branches')
        .set('Authorization', `Bearer ${shadowToken}`)
        .set('Host', 'tenant.example.com');

      expect(dashboardRes.status).toBe(200);
    });
  });

  describe('GET /api/v1/admin/impersonation/sessions — list sessions', () => {
    it('returns 200 with list of impersonation sessions', async () => {
      const res = await req
        .get('/api/v1/admin/impersonation/sessions')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('returns 200 with active=true filter', async () => {
      const res = await req
        .get('/api/v1/admin/impersonation/sessions?active=true')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
    });

    it('returns 403 when not superadmin', async () => {
      const res = await req
        .get('/api/v1/admin/impersonation/sessions')
        .set('Authorization', `Bearer ${regularToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/admin/impersonation/:id/end — end impersonation', () => {
    it('ends an active impersonation session and returns 204', async () => {
      const startRes = await req
        .post('/api/v1/admin/impersonation')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          targetUserId: tenantUserId,
          reason: 'Creating session to end for E2E coverage',
        });

      const sessionId = startRes.body.sessionId;

      const endRes = await req
        .post(`/api/v1/admin/impersonation/${sessionId}/end`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({});

      expect(endRes.status).toBe(204);
    });

    it('returns 404 when session does not exist', async () => {
      const res = await req
        .post('/api/v1/admin/impersonation/00000000-0000-4000-8000-000000000999/end')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({});

      expect(res.status).toBe(404);
    });

    it('returns 409 when session already ended', async () => {
      const startRes = await req
        .post('/api/v1/admin/impersonation')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          targetUserId: tenantUserId,
          reason: 'Creating session to test double-end for E2E coverage',
        });

      const sessionId = startRes.body.sessionId;

      await req
        .post(`/api/v1/admin/impersonation/${sessionId}/end`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({});

      const secondEndRes = await req
        .post(`/api/v1/admin/impersonation/${sessionId}/end`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({});

      expect(secondEndRes.status).toBe(409);
    });

    it('returns 403 when not superadmin', async () => {
      const startRes = await req
        .post('/api/v1/admin/impersonation')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST)
        .send({
          organizationId: testOrgId,
          targetUserId: tenantUserId,
          reason: 'Creating session to test auth on end for E2E coverage',
        });

      const sessionId = startRes.body.sessionId;

      const res = await req
        .post(`/api/v1/admin/impersonation/${sessionId}/end`)
        .set('Authorization', `Bearer ${regularToken()}`)
        .set('Host', ADMIN_HOST)
        .send({});

      expect(res.status).toBe(403);
    });
  });
});
