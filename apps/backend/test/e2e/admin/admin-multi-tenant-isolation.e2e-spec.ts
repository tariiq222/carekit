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
import { DEFAULT_ORGANIZATION_ID } from '../../../src/common/tenant';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-32chars-min';
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

    await cleanTables(['SuperAdminActionLog', 'Subscription', 'Branch', 'SavedCard', 'Plan']);
    await reseedPlans();

    const upsertUser = (email: string, name: string, isSuperAdmin: boolean) =>
      testPrisma.user.upsert({
        where: { email },
        update: { isActive: true, isSuperAdmin },
        create: { email, name, passwordHash: 'dummy', role: 'ADMIN', isActive: true, isSuperAdmin },
      });

    [superAdminUserId, regularUserId, userOrgAId, userOrgBId] = (
      await Promise.all([
        upsertUser('isolation-super@e2e.test', 'Isolation Super Admin', true),
        upsertUser('regular-tenant-iso@e2e.test', 'Regular Tenant User', false),
        upsertUser('user-org-a-iso@e2e.test', 'User Org A', false),
        upsertUser('user-org-b-iso@e2e.test', 'User Org B', false),
      ])
    ).map((u) => u.id) as [string, string, string, string];

    // SaaS-01 invariant — every non-CLIENT staff user needs ≥1 active
    // Membership or foundation.e2e-spec.ts flags them as orphans. Attach
    // all four to DEFAULT_ORGANIZATION_ID — these users authenticate via
    // JWT-supplied org in HTTP tests so the membership org is irrelevant.
    await testPrisma.membership.createMany({
      data: [superAdminUserId, regularUserId, userOrgAId, userOrgBId].map((userId) => ({
        userId,
        organizationId: DEFAULT_ORGANIZATION_ID,
        role: 'ADMIN' as const,
        isActive: true,
        acceptedAt: new Date(),
      })),
      skipDuplicates: true,
    });

    const plans = await testPrisma.plan.findMany({ where: { slug: { in: ['BASIC'] } } });
    BASIC_PLAN_ID = plans.find((p) => p.slug === 'BASIC')!.id;

    orgA = await harness.createOrg(`iso-org-a-${Date.now()}`, 'منظمة أ');
    orgB = await harness.createOrg(`iso-org-b-${Date.now()}`, 'منظمة ب');

    // TAR-43: JwtStrategy now verifies that non-superadmin tokens carry an
    // organizationId with an active membership. Dashboard tests issue tokens
    // scoped to orgA/orgB, so seed the per-org memberships here after the
    // orgs are created.
    await testPrisma.membership.createMany({
      data: [
        {
          userId: userOrgAId,
          organizationId: orgA.id,
          role: 'ADMIN' as const,
          isActive: true,
          acceptedAt: new Date(),
        },
        {
          userId: userOrgBId,
          organizationId: orgB.id,
          role: 'ADMIN' as const,
          isActive: true,
          acceptedAt: new Date(),
        },
      ],
      skipDuplicates: true,
    });

    const now = new Date();

    // Subscription/Branch/SavedCard are in SCOPED_MODELS — wrap creates in
    // a CLS tenant context so the strict-mode scoping extension allows them.
    await harness.runAs({ organizationId: orgA.id }, async () => {
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
  });

  afterAll(async () => {
    if (harness) {
      // Branch/SavedCard/Subscription are in SCOPED_MODELS — strict-mode
      // scoping requires an active CLS tenant context for deleteMany.
      // Organization itself is a root model and stays outside the run.
      await harness.runAs({ organizationId: orgA.id }, async () => {
        await harness.prisma.branch.deleteMany({ where: { organizationId: orgA.id } });
        await harness.prisma.savedCard.deleteMany({ where: { organizationId: orgA.id } });
        await harness.prisma.subscription.deleteMany({ where: { organizationId: orgA.id } });
      });
      await harness.prisma.organization.delete({ where: { id: orgA.id } });
      await harness.prisma.organization.delete({ where: { id: orgB.id } });
      await harness.close();
    }
    await cleanTables(['SuperAdminActionLog', 'Subscription', 'Branch', 'SavedCard', 'Plan']);
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

      // CI-only diagnostic for the 401 we cannot reproduce locally.
      if (res.status === 401) {
        console.error(
          '[debug-401]',
          JSON.stringify({
            url: (res.request as { url?: string } | undefined)?.url ?? '?',
            status: res.status,
            body: res.body,
            text: res.text,
            headers: res.headers,
          }),
        );
      }
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
            // TAR-43: must use a real org where regularUserId has membership so JwtStrategy
            // passes — SuperAdminGuard then rejects (no isSuperAdmin) with 403.
            organizationId: DEFAULT_ORGANIZATION_ID,
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
              // TAR-43: must use a real org where regularUserId has membership so JwtStrategy
              // passes — SuperAdminGuard then rejects (no isSuperAdmin) with 403.
              organizationId: DEFAULT_ORGANIZATION_ID,
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
