import * as jwt from 'jsonwebtoken';
import SuperTest from 'supertest';
import { createVerticalsTestApp, closeVerticalsTestApp, TEST_JWT_ACCESS_SECRET } from './verticals-test-app';
import { testPrisma } from '../../../setup/db.setup';
import * as bcrypt from 'bcryptjs';

// Stable seeded vertical id from migration 20260422080855
const DENTAL_ID = '00000000-0000-0000-0000-0000000a0001';

const SUPER_ADMIN_USER_ID = 'user-super-admin-verticals-e2e';

function mintToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, TEST_JWT_ACCESS_SECRET, { expiresIn: '1h' });
}

describe('Dashboard /verticals authorization (e2e)', () => {
  let req: SuperTest.Agent;

  beforeAll(async () => {
    ({ request: req } = await createVerticalsTestApp());

    // Ensure a SUPER_ADMIN user exists so JwtStrategy can validate the token
    const passwordHash = await bcrypt.hash('Test@1234', 10);
    await testPrisma.user.upsert({
      where: { id: SUPER_ADMIN_USER_ID },
      update: { isSuperAdmin: true },
      create: {
        id: SUPER_ADMIN_USER_ID,
        email: 'super-admin-verticals@e2e.test',
        name: 'Super Admin Verticals E2E',
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        isSuperAdmin: true,
      },
    });
  });

  afterAll(async () => {
    await closeVerticalsTestApp();
  });

  // ── 401 — no token ──────────────────────────────────────────────────────────

  describe('no token → 401 on all mutation routes', () => {
    it('POST /dashboard/verticals → 401', async () => {
      await req
        .post('/dashboard/verticals')
        .send({ slug: 'x', nameAr: 'x', nameEn: 'x', templateFamily: 'MEDICAL' })
        .expect(401);
    });

    it('PATCH /dashboard/verticals/:id → 401', async () => {
      await req.patch(`/dashboard/verticals/${DENTAL_ID}`).send({ nameAr: 'x' }).expect(401);
    });

    it('DELETE /dashboard/verticals/:id → 401', async () => {
      await req.delete(`/dashboard/verticals/${DENTAL_ID}`).expect(401);
    });

    it('PUT /dashboard/verticals/:id/terminology/:tokenKey → 401', async () => {
      await req
        .put(`/dashboard/verticals/${DENTAL_ID}/terminology/client.singular`)
        .send({ valueAr: 'x', valueEn: 'x' })
        .expect(401);
    });

    it('PUT /dashboard/verticals/:id/seed-departments → 401', async () => {
      await req
        .put(`/dashboard/verticals/${DENTAL_ID}/seed-departments`)
        .send({ nameAr: 'x', sortOrder: 1 })
        .expect(401);
    });

    it('PUT /dashboard/verticals/:id/seed-service-categories → 401', async () => {
      await req
        .put(`/dashboard/verticals/${DENTAL_ID}/seed-service-categories`)
        .send({ nameAr: 'x', sortOrder: 1 })
        .expect(401);
    });
  });

  // ── 403 — valid JWT but isSuperAdmin = false ─────────────────────────────────

  describe('valid JWT, isSuperAdmin=false → 403 on all mutation routes', () => {
    let regularToken: string;

    beforeAll(() => {
      // adminUser (ADMIN role, not SUPER_ADMIN) — JwtStrategy resolves isSuperAdmin=false
      regularToken = mintToken({
        sub: 'user-admin-e2e',
        email: 'admin@e2e.test',
        role: 'ADMIN',
        customRoleId: null,
        permissions: [],
        features: [],
        isSuperAdmin: false,
      });
    });

    it('POST /dashboard/verticals → 403', async () => {
      await req
        .post('/dashboard/verticals')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ slug: 'x-forbidden', nameAr: 'x', nameEn: 'x', templateFamily: 'MEDICAL' })
        .expect(403);
    });

    it('PATCH /dashboard/verticals/:id → 403', async () => {
      await req
        .patch(`/dashboard/verticals/${DENTAL_ID}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ nameAr: 'updated' })
        .expect(403);
    });

    it('DELETE /dashboard/verticals/:id → 403', async () => {
      await req
        .delete(`/dashboard/verticals/${DENTAL_ID}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('PUT /dashboard/verticals/:id/terminology/:tokenKey → 403', async () => {
      await req
        .put(`/dashboard/verticals/${DENTAL_ID}/terminology/client.singular`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ valueAr: 'x', valueEn: 'x' })
        .expect(403);
    });

    it('PUT /dashboard/verticals/:id/seed-departments → 403', async () => {
      await req
        .put(`/dashboard/verticals/${DENTAL_ID}/seed-departments`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ nameAr: 'x', sortOrder: 1 })
        .expect(403);
    });

    it('PUT /dashboard/verticals/:id/seed-service-categories → 403', async () => {
      await req
        .put(`/dashboard/verticals/${DENTAL_ID}/seed-service-categories`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ nameAr: 'x', sortOrder: 1 })
        .expect(403);
    });
  });

  // ── 2xx — valid JWT with SUPER_ADMIN role ────────────────────────────────────

  describe('valid JWT with SUPER_ADMIN role → guards pass (happy path)', () => {
    let superAdminToken: string;

    beforeAll(() => {
      // JwtStrategy sets isSuperAdmin=true when user.role === 'SUPER_ADMIN'
      superAdminToken = mintToken({
        sub: SUPER_ADMIN_USER_ID,
        email: 'super-admin-verticals@e2e.test',
        role: 'SUPER_ADMIN',
        customRoleId: null,
        permissions: [],
        features: [],
      });
    });

    it('POST /dashboard/verticals → 201 (guard passes)', async () => {
      const slug = `test-authz-${Date.now()}`;
      const res = await req
        .post('/dashboard/verticals')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          slug,
          nameAr: 'عمودي تجريبي',
          nameEn: 'Test Vertical Authz',
          templateFamily: 'MEDICAL',
          sortOrder: 999,
        });

      // 201 = created; any 2xx is acceptable (guard passed)
      expect(res.status).toBeLessThan(300);

      // Cleanup the created vertical
      if (res.body && typeof res.body === 'object' && 'id' in res.body) {
        await testPrisma.vertical.delete({ where: { id: String(res.body.id) } });
      }
    });
  });
});
