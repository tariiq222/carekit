/**
 * E2E: feature-gate uses the JWT-derived organizationId, not the
 * permissive-mode CLS fallback (Issue #108 — Bug B).
 *
 * Two cases that exercise the FULL guard chain via SuperTest:
 *
 *   1. Authenticated tenant request — FeatureGuard MUST read the JWT org.
 *      Pre-fix this returned 200 because FeatureGuard ran as APP_GUARD
 *      before JwtGuard, reading the middleware's permissive-mode fallback
 *      (Riyadh on PRO with coupons:true). Post-fix it returns 403.
 *
 *   2. Impersonation shadow JWT — same shape, different code path
 *      through JwtGuard.assertImpersonationSessionIsLive().
 *
 * Run mode: TENANT_ENFORCEMENT=permissive (the mode the bug surfaces in).
 * The harness's default is strict — we override here.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

const JEDDAH_ORG_ID = '11111111-1111-4111-8111-111111111111';

describe('Feature gate uses JWT org (Bug B / Issue #108)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let cls: ClsService;

  beforeAll(async () => {
    process.env.TENANT_ENFORCEMENT = 'permissive';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwt = moduleRef.get(JwtService);
    cls = moduleRef.get(ClsService);

    // Sanity: Jeddah org must exist on BASIC plan with coupons:false.
    // The global-setup seeds these fixtures.
    const jeddah = await withSuperAdmin(() =>
      prisma.$allTenants.organization.findUnique({
        where: { id: JEDDAH_ORG_ID },
        include: { subscription: { include: { plan: true } } },
      }),
    );
    if (!jeddah || jeddah.subscription?.plan?.slug !== 'BASIC') {
      throw new Error(
        'Test fixture missing: Jeddah org must exist and be on BASIC plan. ' +
          'Run the standard e2e seed first.',
      );
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  /**
   * Helper: run fn with the super-admin CLS key set so $allTenants is accessible.
   */
  const withSuperAdmin = <T>(fn: () => Promise<T>): Promise<T> =>
    cls.run(async () => {
      cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      return fn();
    });

  /**
   * Forge a tenant-user JWT for the Jeddah owner. We don't go through
   * the impersonation handler — we're testing the GUARD ORDERING, not
   * the impersonation workflow.
   */
  const forgeJeddahOwnerJwt = async () => {
    const ownerMembership = await withSuperAdmin(() =>
      prisma.$allTenants.membership.findFirst({
        where: { organizationId: JEDDAH_ORG_ID, role: 'OWNER' },
        include: { user: true },
      }),
    );
    if (!ownerMembership) {
      throw new Error('Jeddah owner membership missing in seed');
    }
    return {
      ownerMembership,
      token: jwt.sign(
        {
          sub: ownerMembership.user.id,
          email: ownerMembership.user.email,
          role: 'ADMIN',
          membershipRole: 'OWNER',
          organizationId: JEDDAH_ORG_ID,
          membershipId: ownerMembership.id,
          isSuperAdmin: false,
          permissions: [],
          features: [],
        },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
      ),
    };
  };

  it('Case 1: tenant JWT → FeatureGuard reads JWT org, returns 403 on coupons', async () => {
    const { token } = await forgeJeddahOwnerJwt();

    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/finance/coupons')
      .set('Authorization', `Bearer ${token}`);

    // Pre-fix: 200 (guard read DEFAULT_ORG = Riyadh, PRO, coupons:true).
    // Post-fix: 403 (guard reads req.user.organizationId = Jeddah, BASIC).
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 'FEATURE_NOT_ENABLED',
      featureKey: 'coupons',
      planSlug: 'BASIC',
    });
  });

  it('Case 2: impersonation shadow JWT → FeatureGuard reads impersonated org', async () => {
    const [ownerMembership, superAdmin] = await withSuperAdmin(() =>
      Promise.all([
        prisma.$allTenants.membership.findFirst({
          where: { organizationId: JEDDAH_ORG_ID, role: 'OWNER' },
          include: { user: true },
        }),
        prisma.$allTenants.user.findFirst({
          where: { isSuperAdmin: true, isActive: true },
        }),
      ]),
    );
    if (!ownerMembership || !superAdmin) {
      throw new Error('Required seed fixtures missing');
    }

    const session = await withSuperAdmin(() =>
      prisma.$allTenants.impersonationSession.create({
        data: {
          superAdminUserId: superAdmin.id,
          targetUserId: ownerMembership.user.id,
          organizationId: JEDDAH_ORG_ID,
          reason: 'e2e Bug B regression test',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      }),
    );

    try {
      const shadow = jwt.sign(
        {
          sub: ownerMembership.user.id,
          email: ownerMembership.user.email,
          role: 'ADMIN',
          membershipRole: 'OWNER',
          organizationId: JEDDAH_ORG_ID,
          membershipId: ownerMembership.id,
          isSuperAdmin: false,
          scope: 'impersonation',
          impersonatedBy: superAdmin.id,
          impersonationSessionId: session.id,
          permissions: [],
          features: [],
        },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/finance/coupons')
        .set('Authorization', `Bearer ${shadow}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        code: 'FEATURE_NOT_ENABLED',
        featureKey: 'coupons',
        planSlug: 'BASIC',
      });
    } finally {
      await withSuperAdmin(() =>
        prisma.$allTenants.impersonationSession.delete({
          where: { id: session.id },
        }),
      );
    }
  });
});
