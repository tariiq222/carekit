import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient } from '../../setup/seed.helper';
import { createTestToken, adminUser } from '../../setup/auth.helper';
import type { TestUser } from '../../setup/auth.helper';
import * as bcrypt from 'bcryptjs';

// A role that does NOT have update:Client permission (ACCOUNTANT lacks Client subject)
const accountantUser: TestUser = {
  id: 'user-accountant-setactive-e2e',
  email: 'accountant-setactive@e2e.test',
  role: 'ACCOUNTANT',
  customRoleId: null,
  permissions: [],
};

let counter = 0;
const uniquePhone = () => {
  counter += 1;
  return `+9665${Date.now().toString().slice(-6)}${counter.toString().padStart(2, '0')}`;
};

describe('PATCH /dashboard/people/clients/:id/active (e2e)', () => {
  let req: SuperTest.Agent;
  let ADMIN_TOKEN: string;
  let ACCOUNTANT_TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    ADMIN_TOKEN = createTestToken(adminUser);
    ACCOUNTANT_TOKEN = createTestToken(accountantUser);
    await cleanTables(['ClientRefreshToken', 'Client']);

    // Ensure the accountant user exists in the DB so JwtStrategy doesn't return 401
    const passwordHash = await bcrypt.hash('Test@1234', 10);
    await (testPrisma as any).user.upsert({
      where: { email: accountantUser.email },
      update: {},
      create: {
        id: accountantUser.id,
        email: accountantUser.email,
        name: 'Accountant SetActive E2E',
        passwordHash,
        role: 'ACCOUNTANT',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await cleanTables(['ClientRefreshToken', 'Client']);
    await closeTestApp();
  });

  // ── 403 — insufficient permission ────────────────────────────────────────
  describe('[CL-SA-001] 403 when caller lacks update:Client permission', () => {
    it('returns 403 for ACCOUNTANT role', async () => {
      const client = await seedClient(testPrisma as any, { phone: uniquePhone() });
      const res = await req
        .patch(`/dashboard/people/clients/${client.id}/active`)
        .set('Authorization', `Bearer ${ACCOUNTANT_TOKEN}`)
        .send({ isActive: false });
      expect(res.status).toBe(403);
    });
  });

  // ── Disable + revoke tokens ───────────────────────────────────────────────
  describe('[CL-SA-002] disabling a client revokes all active refresh tokens', () => {
    it('sets isActive=false and revokedAt on outstanding tokens', async () => {
      const client = await seedClient(testPrisma as any, { phone: uniquePhone() });

      // Seed a live refresh token for this client
      const token = await (testPrisma as any).clientRefreshToken.create({
        data: {
          clientId: client.id,
          tokenHash: 'hash-abc',
          tokenSelector: 'sel-abc',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      expect(token.revokedAt).toBeNull();

      const res = await req
        .patch(`/dashboard/people/clients/${client.id}/active`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ isActive: false, reason: 'Test disable' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: client.id, isActive: false });

      const dbClient = await (testPrisma as any).client.findUnique({ where: { id: client.id } });
      expect(dbClient.isActive).toBe(false);

      const dbToken = await (testPrisma as any).clientRefreshToken.findUnique({
        where: { id: token.id },
      });
      expect(dbToken.revokedAt).not.toBeNull();
    });
  });

  // ── Re-enable does NOT resurrect revoked tokens ───────────────────────────
  describe('[CL-SA-003] re-enabling does not un-revoke previously revoked tokens', () => {
    it('keeps revokedAt on tokens that were revoked during disable', async () => {
      const client = await seedClient(testPrisma as any, { phone: uniquePhone() });

      // Seed then revoke a token (simulate a prior disable)
      const revokedAt = new Date(Date.now() - 60_000);
      const token = await (testPrisma as any).clientRefreshToken.create({
        data: {
          clientId: client.id,
          tokenHash: 'hash-xyz',
          tokenSelector: 'sel-xyz',
          expiresAt: new Date(Date.now() + 86_400_000),
          revokedAt,
        },
      });

      // Disable first so the state transitions cleanly
      await req
        .patch(`/dashboard/people/clients/${client.id}/active`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ isActive: false });

      // Re-enable
      const res = await req
        .patch(`/dashboard/people/clients/${client.id}/active`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(true);

      // The already-revoked token must stay revoked (revokedAt unchanged)
      const dbToken = await (testPrisma as any).clientRefreshToken.findUnique({
        where: { id: token.id },
      });
      expect(dbToken.revokedAt).not.toBeNull();
      // revokedAt should be the original value (not cleared)
      expect(new Date(dbToken.revokedAt as Date).getTime()).toBe(revokedAt.getTime());
    });
  });

  // ── 404 ──────────────────────────────────────────────────────────────────
  describe('[CL-SA-004] 404 for unknown client', () => {
    it('returns 404 when client UUID does not exist', async () => {
      const res = await req
        .patch('/dashboard/people/clients/00000000-0000-0000-0000-000000000000/active')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ isActive: false });
      expect(res.status).toBe(404);
    });
  });

  // ── No-op ─────────────────────────────────────────────────────────────────
  describe('[CL-SA-005] no-op when already in requested state', () => {
    it('returns 200 without error when isActive is already the requested value', async () => {
      const client = await seedClient(testPrisma as any, { phone: uniquePhone(), isActive: true });

      const res = await req
        .patch(`/dashboard/people/clients/${client.id}/active`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: client.id, isActive: true });
    });
  });

  // ── 401 ──────────────────────────────────────────────────────────────────
  describe('[CL-SA-006] 401 without JWT', () => {
    it('returns 401 when no Authorization header is sent', async () => {
      const client = await seedClient(testPrisma as any, { phone: uniquePhone() });
      const res = await req
        .patch(`/dashboard/people/clients/${client.id}/active`)
        .send({ isActive: false });
      expect(res.status).toBe(401);
    });
  });
});
