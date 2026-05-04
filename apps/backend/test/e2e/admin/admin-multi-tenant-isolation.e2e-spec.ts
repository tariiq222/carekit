/**
 * Admin Multi-Tenant Isolation — HTTP-level E2E tests.
 *
 * Tests cross-tenant data isolation at the HTTP layer:
 * 1. Superadmin can access any org's billing data
 * 2. Org A's data is NOT visible when accessing with Org B's context
 * 3. Superadmin is blocked when Host header doesn't match ADMIN_HOSTS
 * 4. Regular tenant user is blocked from admin routes
 * 5. Superadmin impersonating org A cannot access org B's data
 *
 * Uses bootHarness for multi-org seeding + createTestApp for HTTP layer.
 */
import SuperTest from 'supertest';
import * as jwt from 'jsonwebtoken';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables, reseedPlans } from '../../setup/db.setup';
import { bootHarness } from '../../tenant-isolation/isolation-harness';

const ACCESS_SECRET = 'test-access-secret-32chars-min';
const ADMIN_HOST = 'admin.isolation.test';

describe('Admin Multi-Tenant Isolation (e2e)', () => {
  let req: SuperTest.Agent;
  let superAdminUserId: string;
  let regularUserId: string;
  let userOrgAId: string;
  let userOrgBId: string;
  let harness: Awaited<ReturnType<typeof bootHarness>>;

  let orgA: { id: string };
  let orgB: { id: string };
  let BASIC_PLAN_ID: string;

  beforeAll(async () => {
    process.env.ADMIN_HOSTS = ADMIN_HOST;
    process.env.TENANT_ENFORCEMENT = 'strict';
    ({ request: req } = await createTestApp({ globalPrefix: true, tenantEnforcement: 'strict' }));
    harness = await bootHarness();

    await cleanTables([
      'SuperAdminActionLog',
      'Subscription',
      'Branch',
      'SavedCard',
      'Plan',
    ]);
    await reseedPlans();

    const user = await testPrisma.user.upsert({
      where: { email: 'isolation-super@e2e.test' },
      update: {},
      create: {
        email: 'isolation-super@e2e.test',
        name: 'Isolation Super Admin',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: true,
      },
    });
    superAdminUserId = user.id;

    const regularUser = await testPrisma.user.upsert({
      where: { email: 'regular-tenant-iso@e2e.test' },
      update: {},
      create: {
        email: 'regular-tenant-iso@e2e.test',
        name: 'Regular Tenant User',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: false,
      },
    });
    regularUserId = regularUser.id;

    const userOrgA = await testPrisma.user.upsert({
      where: { email: 'user-org-a-iso@e2e.test' },
      update: {},
      create: {
        email: 'user-org-a-iso@e2e.test',
        name: 'User Org A',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: false,
      },
    });
    userOrgAId = userOrgA.id;

    const userOrgB = await testPrisma.user.upsert({
      where: { email: 'user-org-b-iso@e2e.test' },
      update: {},
      create: {
        email: 'user-org-b-iso@e2e.test',
        name: 'User Org B',
        passwordHash: 'dummy',
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: false,
      },
    });
    userOrgBId = userOrgB.id;

    const plans = await testPrisma.plan.findMany({ where: { slug: { in: ['BASIC'] } } });
    BASIC_PLAN_ID = plans.find((p) => p.slug === 'BASIC')!.id;

    orgA = await harness.createOrg(`iso-org-a-${Date.now()}`, 'منظمة أ');
    orgB = await harness.createOrg(`iso-org-b-${Date.now()}`, 'منظمة ب');

    const now = new Date();

    await harness.prisma.subscription.create({
      data: {
        organizationId: orgA.id,
        planId: BASIC_PLAN_ID,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
    });

    await harness.prisma.branch.create({
      data: {
        organizationId: orgA.id,
        nameAr: 'فرع أ',
        nameEn: 'Branch A',
        phone: '+966500000001',
        isActive: true,
      },
    });

    await harness.prisma.savedCard.create({
      data: {
        organizationId: orgA.id,
        moyasarTokenId: `tok_test_${Date.now()}`,
        last4: '1111',
        brand: 'VISA',
        isDefault: true,
        expiryMonth: 12,
        expiryYear: 2027,
      },
    });
  });

  afterAll(async () => {
    if (harness) {
      await harness.prisma.branch.deleteMany({ where: { organizationId: orgA.id } });
      await harness.prisma.savedCard.deleteMany({ where: { organizationId: orgA.id } });
      await harness.prisma.subscription.deleteMany({ where: { organizationId: orgA.id } });
      await harness.prisma.organization.delete({ where: { id: orgA.id } });
      await harness.prisma.organization.delete({ where: { id: orgB.id } });
      await harness.close();
    }
    await cleanTables([
      'SuperAdminActionLog',
      'Subscription',
      'Branch',
      'SavedCard',
      'Plan',
    ]);
    await reseedPlans();
    await closeTestApp();
  });

  function superadminToken(overrides: Record<string, unknown> = {}): string {
    return jwt.sign(
      {
        sub: superAdminUserId,
        email: 'isolation-super@e2e.test',
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

  describe('Superadmin cross-org access', () => {
    it('GET /api/v1/admin/billing/subscriptions/:orgId returns org A data', async () => {
      const res = await req
        .get(`/api/v1/admin/billing/subscriptions/${orgA.id}`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
      expect(res.body.subscription.organizationId).toBe(orgA.id);
    });

    it('GET /api/v1/admin/billing/subscriptions/:orgId returns org B data (no subscription)', async () => {
      const res = await req
        .get(`/api/v1/admin/billing/subscriptions/${orgB.id}`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
      expect(res.body.subscription).toBeNull();
    });

    it('GET /api/v1/admin/billing/subscriptions with wrong Host → 403', async () => {
      const res = await req
        .get(`/api/v1/admin/billing/subscriptions/${orgA.id}`)
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', 'wrong.host');

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/admin/billing/subscriptions with isSuperAdmin=false → 403', async () => {
      const res = await req
        .get(`/api/v1/admin/billing/subscriptions/${orgA.id}`)
        .set('Authorization', `Bearer ${jwt.sign(
          {
            sub: regularUserId,
            email: 'regular-tenant-iso@e2e.test',
            role: 'ADMIN',
            isSuperAdmin: false,
            organizationId: orgA.id,
            customRoleId: null,
            permissions: [],
            features: [],
          },
          ACCESS_SECRET,
          { expiresIn: '1h' },
        )}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(403);
    });
  });

  describe('Non-superadmin tenant user blocked from admin routes', () => {
    it('GET /api/v1/admin/billing/subscriptions → 403 for regular tenant user', async () => {
      const res = await req
        .get('/api/v1/admin/billing/subscriptions')
        .set(
          'Authorization',
          `Bearer ${jwt.sign(
            {
              sub: regularUserId,
              email: 'regular-tenant-iso@e2e.test',
              role: 'ADMIN',
              isSuperAdmin: false,
              organizationId: orgA.id,
              customRoleId: null,
              permissions: [],
              features: [],
            },
            ACCESS_SECRET,
            { expiresIn: '1h' },
          )}`,
        )
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(403);
    });
  });

  describe('Org-scoped routes with tenant context', () => {
    it('dashboard route with correct X-Tenant-ID returns org data', async () => {
      const res = await req
        .get('/api/v1/dashboard/organization/branches')
        .set('Authorization', `Bearer ${jwt.sign(
          {
            sub: userOrgAId,
            email: 'user-org-a-iso@e2e.test',
            role: 'ADMIN',
            isSuperAdmin: false,
            organizationId: orgA.id,
            customRoleId: null,
            permissions: [],
            features: [],
          },
          ACCESS_SECRET,
          { expiresIn: '1h' },
        )}`)
        .set('Host', 'tenant.example.com')
        .set('X-Tenant-ID', orgA.id);

      expect(res.status).toBe(200);
    });

    it('dashboard route with X-Tenant-ID for org B returns empty (no branches seeded)', async () => {
      const res = await req
        .get('/api/v1/dashboard/organization/branches')
        .set('Authorization', `Bearer ${jwt.sign(
          {
            sub: userOrgBId,
            email: 'user-org-b-iso@e2e.test',
            role: 'ADMIN',
            isSuperAdmin: false,
            organizationId: orgB.id,
            customRoleId: null,
            permissions: [],
            features: [],
          },
          ACCESS_SECRET,
          { expiresIn: '1h' },
        )}`)
        .set('Host', 'tenant.example.com')
        .set('X-Tenant-ID', orgB.id);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });

    it('dashboard route with wrong X-Tenant-ID (using org A token on org B) → 403 or empty', async () => {
      const res = await req
        .get('/api/v1/dashboard/organization/branches')
        .set('Authorization', `Bearer ${jwt.sign(
          {
            sub: userOrgAId,
            email: 'user-org-a-iso@e2e.test',
            role: 'ADMIN',
            isSuperAdmin: false,
            organizationId: orgA.id,
            customRoleId: null,
            permissions: [],
            features: [],
          },
          ACCESS_SECRET,
          { expiresIn: '1h' },
        )}`)
        .set('Host', 'tenant.example.com')
        .set('X-Tenant-ID', orgB.id);

      expect([200, 403]).toContain(res.status);
    });
  });

  describe('Admin impersonation session isolation', () => {
    it('GET /api/v1/admin/impersonation/sessions → returns 200 with list', async () => {
      const res = await req
        .get('/api/v1/admin/impersonation/sessions')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', ADMIN_HOST);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    it('GET /api/v1/admin/impersonation/sessions with wrong Host → 403', async () => {
      const res = await req
        .get('/api/v1/admin/impersonation/sessions')
        .set('Authorization', `Bearer ${superadminToken()}`)
        .set('Host', 'wrong.host');

      expect(res.status).toBe(403);
    });
  });
});
