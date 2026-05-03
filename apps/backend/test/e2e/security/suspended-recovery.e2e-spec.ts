/**
 * Bug B10 — suspended-org OWNER can self-serve recovery via billing routes.
 *
 * Pre-fix behaviour: any authenticated request from a member of a SUSPENDED
 * org returned 401 ORG_SUSPENDED, including billing endpoints. The OWNER had
 * no way to update payment method and lift the suspension.
 *
 * Post-fix behaviour:
 *   - GET  /api/v1/dashboard/billing/subscription   — OWNER can read state
 *   - GET  /api/v1/auth/me                          — OWNER stays identified
 *   - GET  /api/v1/dashboard/billing/saved-cards    — OWNER can list cards
 *   - GET  /api/v1/dashboard/people/clients         — STILL 401 (not recovery)
 *   - RECEPTIONIST on the same suspended org → 401 even on recovery routes
 *
 * Run mode: TENANT_ENFORCEMENT=strict (the platform default).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { RedisService } from '../../../src/infrastructure/cache';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

interface SeedActor {
  userId: string;
  email: string;
  membershipId: string;
  membershipRole: 'OWNER' | 'RECEPTIONIST';
}

describe('Suspended-org recovery (Bug B10)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let cls: ClsService;
  let redis: RedisService;

  let suspendedOrgId: string;
  let owner: SeedActor;
  let receptionist: SeedActor;

  // Idempotent — same suite-run id → same org slug. Lets the suite re-run
  // against a stale DB without unique-violations.
  const stamp = `b10-${Date.now()}`;

  const withSuperAdmin = <T>(fn: () => Promise<T>): Promise<T> =>
    cls.run(async () => {
      cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      return fn();
    });

  const forge = (actor: SeedActor) =>
    jwt.sign(
      {
        sub: actor.userId,
        email: actor.email,
        role: actor.membershipRole === 'OWNER' ? 'ADMIN' : 'RECEPTIONIST',
        membershipRole: actor.membershipRole,
        organizationId: suspendedOrgId,
        membershipId: actor.membershipId,
        isSuperAdmin: false,
        permissions: [],
        features: [],
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
    );

  const flushSuspensionCache = async () => {
    const client = redis.getClient();
    await client.del(`org-suspension:${suspendedOrgId}`);
  };

  beforeAll(async () => {
    process.env.TENANT_ENFORCEMENT = process.env.TENANT_ENFORCEMENT ?? 'strict';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwt = moduleRef.get(JwtService);
    cls = moduleRef.get(ClsService);
    redis = moduleRef.get(RedisService);

    // Seed: one suspended org with an OWNER and a RECEPTIONIST membership.
    await withSuperAdmin(async () => {
      const org = await prisma.$allTenants.organization.create({
        data: {
          slug: `sec-suspended-${stamp}`,
          nameAr: `منظمة معلّقة ${stamp}`,
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspendedReason: 'PAYMENT_FAILED',
        },
      });
      suspendedOrgId = org.id;

      const ownerUser = await prisma.$allTenants.user.create({
        data: {
          email: `owner-${stamp}@suspended.test`,
          passwordHash: 'x',
          name: 'Suspended Owner',
          role: 'ADMIN',
          isActive: true,
        },
      });
      const recUser = await prisma.$allTenants.user.create({
        data: {
          email: `rec-${stamp}@suspended.test`,
          passwordHash: 'x',
          name: 'Suspended Receptionist',
          role: 'RECEPTIONIST',
          isActive: true,
        },
      });

      const ownerMembership = await prisma.$allTenants.membership.create({
        data: {
          userId: ownerUser.id,
          organizationId: suspendedOrgId,
          role: 'OWNER',
          isActive: true,
          acceptedAt: new Date(),
        },
      });
      const recMembership = await prisma.$allTenants.membership.create({
        data: {
          userId: recUser.id,
          organizationId: suspendedOrgId,
          role: 'RECEPTIONIST',
          isActive: true,
          acceptedAt: new Date(),
        },
      });

      owner = {
        userId: ownerUser.id,
        email: ownerUser.email,
        membershipId: ownerMembership.id,
        membershipRole: 'OWNER',
      };
      receptionist = {
        userId: recUser.id,
        email: recUser.email,
        membershipId: recMembership.id,
        membershipRole: 'RECEPTIONIST',
      };
    });
  });

  afterAll(async () => {
    if (!app) return;
    await withSuperAdmin(async () => {
      await prisma.$allTenants.membership.deleteMany({
        where: { organizationId: suspendedOrgId },
      });
      await prisma.$allTenants.user.deleteMany({
        where: { id: { in: [owner.userId, receptionist.userId] } },
      });
      await prisma.$allTenants.organization.delete({
        where: { id: suspendedOrgId },
      });
    });
    await app.close();
  });

  beforeEach(async () => {
    await flushSuspensionCache();
  });

  it('OWNER can read GET /dashboard/billing/subscription on a suspended org', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/billing/subscription')
      .set('Authorization', `Bearer ${forge(owner)}`);

    // The handler returns null (no subscription seeded) — what matters is we
    // got past the JwtGuard suspension check, i.e. NOT a 401 ORG_SUSPENDED.
    expect(res.status).toBe(200);
  });

  it('OWNER can read GET /auth/me on a suspended org', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${forge(owner)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: owner.email });
  });

  it('OWNER can read GET /dashboard/billing/saved-cards on a suspended org', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/billing/saved-cards')
      .set('Authorization', `Bearer ${forge(owner)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('OWNER STILL gets 401 ORG_SUSPENDED on a non-recovery route (GET /dashboard/people/clients)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/people/clients')
      .set('Authorization', `Bearer ${forge(owner)}`);

    expect(res.status).toBe(401);
    // Body shape: { code: 'ORG_SUSPENDED', recoveryHint: { ar, en } }
    expect(res.body.code ?? res.body.message).toContain('ORG_SUSPENDED');
    if (res.body.recoveryHint) {
      expect(res.body.recoveryHint.ar).toContain('معلّق');
      expect(res.body.recoveryHint.en).toContain('suspended');
    }
  });

  it('RECEPTIONIST on a suspended org gets 401 even on a recovery route (GET /dashboard/billing/subscription)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/billing/subscription')
      .set('Authorization', `Bearer ${forge(receptionist)}`);

    expect(res.status).toBe(401);
    expect(res.body.code ?? res.body.message).toContain('ORG_SUSPENDED');
  });

  it('RECEPTIONIST on a suspended org gets 401 on /auth/me too', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${forge(receptionist)}`);

    expect(res.status).toBe(401);
  });

  it('After org status moves back to ACTIVE, OWNER hits non-recovery route → 200', async () => {
    // Lift suspension; flush cache so the guard re-reads Postgres.
    await withSuperAdmin(() =>
      prisma.$allTenants.organization.update({
        where: { id: suspendedOrgId },
        data: { status: 'ACTIVE', suspendedAt: null, suspendedReason: null },
      }),
    );
    await flushSuspensionCache();

    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/people/clients')
      .set('Authorization', `Bearer ${forge(owner)}`);

    // The endpoint requires CASL/permissions which the bare seed lacks, so
    // we accept any non-suspension response (200, 403 permissions, etc.)
    // The point is: NO LONGER ORG_SUSPENDED.
    expect(res.status).not.toBe(401);
    if (res.body.code) {
      expect(res.body.code).not.toBe('ORG_SUSPENDED');
    }

    // Restore SUSPENDED for the rest of teardown.
    await withSuperAdmin(() =>
      prisma.$allTenants.organization.update({
        where: { id: suspendedOrgId },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspendedReason: 'PAYMENT_FAILED',
        },
      }),
    );
  });
});
