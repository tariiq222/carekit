/**
 * E2E (Bug B5 / 2026-05-03): CASL must build the user's ability from the
 * canonical per-org `Membership.role`, not the legacy global `User.role`.
 *
 * Threat model: a user demoted in org X from ADMIN to RECEPTIONIST still
 * carries `User.role='ADMIN'` in the database (the legacy global enum is
 * left in place during DB-08 phase A). Pre-fix the CASL factory read
 * `user.role`, so the demoted user retained admin abilities until their
 * JWT TTL expired (and even after the JWT rotated, because the strategy
 * fed `user.role` into the factory).
 *
 * This spec:
 *   1. Seeds an org + a user with `User.role='ADMIN'`.
 *   2. Creates a membership with `Membership.role='RECEPTIONIST'`.
 *   3. Forges a JWT carrying `membershipRole='RECEPTIONIST'` plus the
 *      legacy `role='ADMIN'` claim (mirrors what TokenService issues).
 *   4. Hits an admin-only endpoint (`POST /dashboard/organization/categories`,
 *      requires `manage Category`). Expected: 403.
 *   5. Same fixture, but issues a JWT with `membershipRole='ADMIN'`.
 *      Expected: NOT 403 (request reaches the handler — body validation
 *      may then reject, but the authz gate must pass).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import SuperTest from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('CASL uses Membership.role, not legacy User.role (Bug B5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let cls: ClsService;

  let orgId: string;
  let userId: string;
  let membershipId: string;
  let userEmail: string;

  beforeAll(async () => {
    process.env.TENANT_ENFORCEMENT = 'strict';

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

    // Seed a fresh org + user + membership directly (the harness does the
    // same in other security specs). Run under super-admin CLS context so
    // the strict scoping extension permits the unscoped writes.
    const stamp = Date.now();
    userEmail = `casl-${stamp}@example.com`;
    await withSuperAdmin(async () => {
      const org = await prisma.$allTenants.organization.create({
        data: {
          slug: `casl-bug-b5-${stamp}`,
          nameAr: `منظمة CASL ${stamp}`,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      orgId = org.id;

      const user = await prisma.$allTenants.user.create({
        data: {
          email: userEmail,
          name: 'Demoted Admin',
          // Legacy global role says ADMIN (full power) — this is the bait.
          // The membership below says RECEPTIONIST. The factory MUST honour
          // membership. (UserRole does NOT have OWNER — that's a
          // MembershipRole-only value.)
          role: 'ADMIN',
          passwordHash: 'x',
          isActive: true,
        },
        select: { id: true },
      });
      userId = user.id;

      const mem = await prisma.$allTenants.membership.create({
        data: {
          userId,
          organizationId: orgId,
          role: 'RECEPTIONIST',
          isActive: true,
        },
        select: { id: true },
      });
      membershipId = mem.id;
    });
  });

  afterAll(async () => {
    if (prisma && orgId) {
      await withSuperAdmin(async () => {
        await prisma.$allTenants.membership.deleteMany({ where: { organizationId: orgId } });
        await prisma.$allTenants.organization.delete({ where: { id: orgId } }).catch(() => undefined);
        if (userId) {
          await prisma.$allTenants.user.delete({ where: { id: userId } }).catch(() => undefined);
        }
      });
    }
    if (app) await app.close();
  });

  const withSuperAdmin = <T>(fn: () => Promise<T>): Promise<T> =>
    cls.run(async () => {
      cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      return fn();
    });

  const forgeJwt = (membershipRole: string, legacyRole: string = 'ADMIN'): string =>
    jwt.sign(
      {
        sub: userId,
        email: userEmail,
        // Legacy global User.role claim — pre-fix this drove CASL.
        role: legacyRole,
        // Canonical per-org role — post-fix this drives CASL.
        membershipRole,
        organizationId: orgId,
        membershipId,
        isSuperAdmin: false,
        customRoleId: null,
        permissions: [],
        features: [],
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
    );

  it('returns 403 when membershipRole=RECEPTIONIST hits an admin-only endpoint, even if legacy role=ADMIN', async () => {
    const token = forgeJwt('RECEPTIONIST', 'ADMIN');

    const res = await SuperTest(app.getHttpServer())
      .post('/api/v1/dashboard/organization/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ nameAr: 'تجربة', nameEn: 'Test' });

    // Pre-fix: 201/400 (CASL read user.role=ADMIN → manage Category granted).
    // Post-fix: 403 (CASL read membershipRole=RECEPTIONIST → no manage Category).
    expect(res.status).toBe(403);
  });

  it('does NOT return 403 when membershipRole=ADMIN hits the same endpoint (control)', async () => {
    const token = forgeJwt('ADMIN', 'EMPLOYEE');

    const res = await SuperTest(app.getHttpServer())
      .post('/api/v1/dashboard/organization/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ nameAr: 'فئة', nameEn: 'Category' });

    // Authz must pass; the request may still fail with 400/422 from
    // validation or 500 from a missing FK — what matters here is that
    // the CASL gate did NOT fire. So just assert "not 403".
    expect(res.status).not.toBe(403);
  });
});
