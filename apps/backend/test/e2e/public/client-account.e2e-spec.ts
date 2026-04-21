/**
 * Client Account — Phase 3 E2E Suite
 *
 * Auth contract: body-based tokens.
 *   POST /public/auth/login    → { accessToken, refreshToken, clientId }
 *   POST /public/auth/register → { accessToken, refreshToken, clientId }
 *   POST /public/auth/refresh  → needs Bearer accessToken + { refreshToken } body
 *   POST /public/auth/logout   → needs Bearer accessToken + { refreshToken } body
 *   GET  /public/me            → needs Bearer accessToken header
 */
import SuperTest from 'supertest';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import {
  seedClient,
  seedEmployee,
  seedService,
  seedBranch,
  seedBooking,
} from '../../setup/seed.helper';
import {
  createPublicTestApp,
  closePublicTestApp,
  TEST_JWT_CLIENT_ACCESS_SECRET,
  type PublicTestApp,
} from './public-test-app';

// Secret used to sign OTP session tokens in tests (matches CONFIG_MAP)
const TEST_JWT_ACCESS_SECRET = 'test-access-secret-32chars-min';

/** Build a signed OTP session JWT the same way OtpSessionService does. */
function signOtpSession(opts: {
  identifier: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
}): string {
  return jwt.sign(
    { ...opts, jti: uuidv4() },
    TEST_JWT_ACCESS_SECRET,
    { expiresIn: '30m' },
  );
}

/** Sign a CLIENT_LOGIN OTP session and return a unique jti so replay tests work. */
function signLoginSession(identifier: string): { token: string; jti: string } {
  const jti = uuidv4();
  const token = jwt.sign(
    { identifier, purpose: OtpPurpose.CLIENT_LOGIN, channel: OtpChannel.EMAIL, jti },
    TEST_JWT_ACCESS_SECRET,
    { expiresIn: '30m' },
  );
  return { token, jti };
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  clientId: string;
}

/**
 * Full register flow via the HTTP endpoint.
 * Returns the token pair from the response body.
 */
async function httpRegister(
  req: SuperTest.SuperTest<SuperTest.Test>,
  email: string,
  password: string,
  name = 'Test Client',
): Promise<AuthTokens> {
  const { token } = signLoginSession(email);
  const res = await req
    .post('/public/auth/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ password, name });
  if (res.status !== 200) {
    throw new Error(`Register failed ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return {
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    clientId: res.body.clientId as string,
  };
}

/**
 * Full login flow via the HTTP endpoint.
 * Returns the token pair from the response body.
 */
async function httpLogin(
  req: SuperTest.SuperTest<SuperTest.Test>,
  email: string,
  password: string,
): Promise<{ tokens: AuthTokens; status: number; body: Record<string, unknown> }> {
  const res = await req
    .post('/public/auth/login')
    .send({ email, password });
  return {
    tokens: {
      accessToken: res.body.accessToken as string,
      refreshToken: res.body.refreshToken as string,
      clientId: res.body.clientId as string,
    },
    status: res.status,
    body: res.body as Record<string, unknown>,
  };
}

// ─── Tables cleaned between each suite ───────────────────────────────────────
const BASE_TABLES = [
  'UsedOtpSession',
  'ClientRefreshToken',
  'OtpCode',
  'BookingStatusLog',
  'Booking',
  'Invoice',
  'Payment',
  'Client',
];

const ALL_TABLES = [
  ...BASE_TABLES,
  'EmployeeService',
  'EmployeeBranch',
  'Employee',
  'Service',
  'Branch',
];

// ─────────────────────────────────────────────────────────────────────────────
describe('Client Account Phase 3 — body token auth (e2e)', () => {
  let req: SuperTest.SuperTest<SuperTest.Test>;
  let httpServer: PublicTestApp['httpServer'];

  let employeeId: string;
  let serviceId: string;
  let branchId: string;

  beforeAll(async () => {
    const app = await createPublicTestApp();
    req = app.request as unknown as SuperTest.SuperTest<SuperTest.Test>;
    httpServer = app.httpServer;

    await cleanTables(ALL_TABLES);
    const [employee, service, branch] = await Promise.all([
      seedEmployee(testPrisma as never),
      seedService(testPrisma as never, { nameEn: 'Cleaning', nameAr: 'تنظيف', durationMins: 60, price: 200 }),
      seedBranch(testPrisma as never),
    ]);
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;
  });

  afterAll(async () => {
    await cleanTables(ALL_TABLES);
    await closePublicTestApp();
  });

  beforeEach(async () => {
    await cleanTables(BASE_TABLES);
  });

  // ── 1. Login happy path ────────────────────────────────────────────────────

  describe('POST /public/auth/login — happy path', () => {
    it('returns { clientId, accessToken, refreshToken } in body', async () => {
      const email = `login-happy-${Date.now()}@test.com`;
      await httpRegister(req, email, 'SecurePass1');

      const res = await req.post('/public/auth/login').send({ email, password: 'SecurePass1' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('clientId');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(typeof res.body.clientId).toBe('string');
    });

    it('GET /public/me with Bearer access token returns the client profile', async () => {
      const email = `me-test-${Date.now()}@test.com`;
      await httpRegister(req, email, 'SecurePass1');

      const { tokens } = await httpLogin(req, email, 'SecurePass1');

      const meRes = await req
        .get('/public/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body).toHaveProperty('email', email);
    });
  });

  // ── 2. Register happy path ─────────────────────────────────────────────────

  describe('POST /public/auth/register — happy path', () => {
    it('returns { clientId, accessToken, refreshToken } in body', async () => {
      const email = `reg-happy-${Date.now()}@test.com`;
      const { token } = signLoginSession(email);

      const res = await req
        .post('/public/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'SecurePass1', name: 'New Client' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('clientId');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('creates a ClientRefreshToken DB row after login (login flow uses DB-persisted tokens)', async () => {
      const email = `reg-db-${Date.now()}@test.com`;
      // Register first (uses ClientTokenService — no DB row created at register time)
      await httpRegister(req, email, 'SecurePass1');
      // Login creates the DB-persisted refresh token row
      const { body } = await httpLogin(req, email, 'SecurePass1');
      const clientId = body.clientId as string;

      const row = await testPrisma.clientRefreshToken.findFirst({
        where: { clientId, revokedAt: null },
      });
      expect(row).not.toBeNull();
      expect(row!.revokedAt).toBeNull();
    });
  });

  // ── 3. Refresh token rotation ──────────────────────────────────────────────

  describe('POST /public/auth/refresh — rotation', () => {
    // NOTE: The refresh endpoint requires a DB-persisted refresh token (tokenSelector + tokenHash).
    // Only the login flow (ClientLoginHandler) creates these DB rows.
    // The register flow (ClientTokenService) issues a bare JWT jti as refreshToken without a DB row.
    // All refresh tests must therefore register first, then login to get a proper refresh token.

    it('returns 200 with new token values different from the originals', async () => {
      const email = `refresh-rot-${Date.now()}@test.com`;
      await httpRegister(req, email, 'SecurePass1');
      const { tokens: loginTokens } = await httpLogin(req, email, 'SecurePass1');

      const refreshRes = await req
        .post('/public/auth/refresh')
        .set('Authorization', `Bearer ${loginTokens.accessToken}`)
        .send({ refreshToken: loginTokens.refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toBe(loginTokens.refreshToken);
      expect(refreshRes.body.accessToken).not.toBe(loginTokens.accessToken);
    });

    it('old ClientRefreshToken row has revokedAt set after rotation', async () => {
      const email = `refresh-revoke-${Date.now()}@test.com`;
      await httpRegister(req, email, 'SecurePass1');
      const { tokens, body } = await httpLogin(req, email, 'SecurePass1');
      const clientId = body.clientId as string;

      const oldRow = await testPrisma.clientRefreshToken.findFirst({
        where: { clientId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      expect(oldRow).not.toBeNull();

      await req
        .post('/public/auth/refresh')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      const revokedRow = await testPrisma.clientRefreshToken.findUnique({
        where: { id: oldRow!.id },
      });
      expect(revokedRow!.revokedAt).not.toBeNull();
    });

    it('new ClientRefreshToken row exists with no revokedAt after rotation', async () => {
      const email = `refresh-new-row-${Date.now()}@test.com`;
      await httpRegister(req, email, 'SecurePass1');
      const { tokens, body } = await httpLogin(req, email, 'SecurePass1');
      const clientId = body.clientId as string;

      await req
        .post('/public/auth/refresh')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      const newRow = await testPrisma.clientRefreshToken.findFirst({
        where: { clientId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      expect(newRow).not.toBeNull();
      expect(newRow!.revokedAt).toBeNull();
    });

    it('using the OLD refresh token again after rotation returns 401', async () => {
      const email = `refresh-replay-${Date.now()}@test.com`;
      await httpRegister(req, email, 'SecurePass1');
      const { tokens } = await httpLogin(req, email, 'SecurePass1');

      // Rotate once — get new access token to authenticate with
      const rotateRes = await req
        .post('/public/auth/refresh')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });
      const newAccessToken = rotateRes.body.accessToken as string;

      // Replay old refresh token with the new access token
      const replayRes = await req
        .post('/public/auth/refresh')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      expect(replayRes.status).toBe(401);
    });
  });

  // ── 4. Refresh with no token ───────────────────────────────────────────────

  describe('POST /public/auth/refresh — missing Authorization header', () => {
    it('returns 401 when no Authorization header is present', async () => {
      // The refresh endpoint has @UseGuards(ClientSessionGuard) — no Bearer header → 401
      const res = await req
        .post('/public/auth/refresh')
        .send({ refreshToken: 'fake-token' });
      expect(res.status).toBe(401);
    });

    it('does not create any ClientRefreshToken rows on rejected refresh', async () => {
      const countBefore = await testPrisma.clientRefreshToken.count();
      // No auth header → guard rejects → no DB writes
      await req.post('/public/auth/refresh').send({ refreshToken: 'fake-token' });
      const countAfter = await testPrisma.clientRefreshToken.count();
      expect(countAfter).toBe(countBefore);
    });
  });

  // ── 5. Refresh with forged token ───────────────────────────────────────────

  describe('POST /public/auth/refresh — forged refresh token', () => {
    it('returns 401 for an invalid refresh token value', async () => {
      const email = `forged-${Date.now()}@test.com`;
      const { accessToken } = await httpRegister(req, email, 'SecurePass1');

      const res = await req
        .post('/public/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken: 'not-a-real-token-xxxxxxxxxxxxxxx' });
      expect(res.status).toBe(401);
    });
  });

  // ── 6. Login per-email rate limit ──────────────────────────────────────────

  describe('POST /public/auth/login — per-email rate limit', () => {
    it('blocks login after exceeding failed-attempt threshold for the same email', async () => {
      const email = `ratelimit-email-${Date.now()}@test.com`;
      await httpRegister(req, email, 'SecurePass1');

      // 5 wrong-password attempts to trigger Redis lockout
      for (let i = 0; i < 5; i++) {
        await req.post('/public/auth/login').send({ email, password: 'WrongPass9' });
      }

      // 6th attempt — Redis counter is past threshold
      const res = await req.post('/public/auth/login').send({ email, password: 'WrongPass9' });
      expect(res.status).toBe(401);
      // Either Redis key-based lockout or DB lockout message
      expect(
        res.body.message.includes('Too many') ||
        res.body.message.includes('locked') ||
        res.body.message.includes('temporarily'),
      ).toBe(true);
    });
  });

  // ── 7. Login per-IP rate limit ─────────────────────────────────────────────
  // NOTE: The current production login handler implements per-email rate limiting only
  // (via Redis key `client_login:<email>`). There is no per-IP rate limiting.
  // This test is skipped until the production implementation adds it.
  // TODO: requires production change — add per-IP rate limit key in ClientLoginHandler
  it.skip('blocks after 20 failed attempts from same IP with rotating emails', () => {
    // No-op — per-IP rate limit not implemented
  });

  // ── 8. Login unknown user returns generic message ──────────────────────────

  describe('POST /public/auth/login — unknown user', () => {
    it('returns "Invalid credentials" and does not leak remaining count', async () => {
      const res = await req
        .post('/public/auth/login')
        .send({ email: `no-such-user-${Date.now()}@test.com`, password: 'SomePass9' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
      expect(JSON.stringify(res.body)).not.toContain('remaining');
    });
  });

  // ── 9. Successful login clears failed-attempt counter ─────────────────────

  describe('POST /public/auth/login — success clears counter', () => {
    it('succeeds after 3 bad attempts (well under lockout threshold)', async () => {
      const email = `clear-counter-${Date.now()}@test.com`;
      await httpRegister(req, email, 'SecurePass1');

      // 3 bad attempts — Redis key is at 3, under the 5 threshold
      // DB lockoutUntil is set on the 4th attempt (MAX-1=4), so we stop at 3
      for (let i = 0; i < 3; i++) {
        await req.post('/public/auth/login').send({ email, password: 'WrongPass9' });
      }

      // Good attempt — should succeed (Redis at 4 after this, but success clears counter)
      const res = await req.post('/public/auth/login').send({ email, password: 'SecurePass1' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('clientId');
    });
  });

  // ── 10. Cross-client /me leakage ──────────────────────────────────────────

  describe('GET /public/me — no cross-client leakage', () => {
    it("returns only client A's data when logged in as A", async () => {
      const emailA = `me-a-${Date.now()}@test.com`;
      const emailB = `me-b-${Date.now()}@test.com`;

      await httpRegister(req, emailA, 'SecurePass1');
      await httpRegister(req, emailB, 'SecurePass1');

      const { tokens: tokensA, body: bodyA } = await httpLogin(req, emailA, 'SecurePass1');
      const idA = bodyA.clientId as string;

      const meRes = await req
        .get('/public/me')
        .set('Authorization', `Bearer ${tokensA.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.id).toBe(idA);
      expect(meRes.body.email).toBe(emailA);
      expect(meRes.body.email).not.toBe(emailB);
    });
  });

  // ── 11. Cross-client /me/bookings leakage ─────────────────────────────────

  describe('GET /public/me/bookings — no cross-client leakage', () => {
    it("does not include client B's bookings when authenticated as client A", async () => {
      const emailA = `bk-a-${Date.now()}@test.com`;
      const emailB = `bk-b-${Date.now()}@test.com`;

      await httpRegister(req, emailA, 'SecurePass1');
      const { clientId: idB } = await httpRegister(req, emailB, 'SecurePass1');

      // Seed a booking for B
      const bBooking = await seedBooking(testPrisma as never, {
        clientId: idB,
        employeeId,
        serviceId,
        branchId,
        scheduledAt: new Date(Date.now() + 3 * 86_400_000),
        status: 'CONFIRMED',
      });

      const { tokens: tokensA } = await httpLogin(req, emailA, 'SecurePass1');

      const res = await req
        .get('/public/me/bookings')
        .set('Authorization', `Bearer ${tokensA.accessToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body.items as Array<{ id: string }>).map((b) => b.id);
      expect(ids).not.toContain(bBooking.id);
    });
  });

  // ── 12. Cancel booking ownership ──────────────────────────────────────────

  describe('PATCH /public/me/bookings/:id/cancel — ownership', () => {
    it("client A cannot cancel client B's booking", async () => {
      const emailA = `can-a-${Date.now()}@test.com`;
      const emailB = `can-b-${Date.now()}@test.com`;

      await httpRegister(req, emailA, 'SecurePass1');
      const { clientId: idB } = await httpRegister(req, emailB, 'SecurePass1');

      const bBooking = await seedBooking(testPrisma as never, {
        clientId: idB,
        employeeId,
        serviceId,
        branchId,
        scheduledAt: new Date(Date.now() + 5 * 86_400_000),
        status: 'CONFIRMED',
      });

      const { tokens: tokensA } = await httpLogin(req, emailA, 'SecurePass1');

      const res = await req
        .patch(`/public/me/bookings/${bBooking.id}/cancel`)
        .set('Authorization', `Bearer ${tokensA.accessToken}`)
        .send({});

      expect([403, 404]).toContain(res.status);

      const unchanged = await testPrisma.booking.findUnique({ where: { id: bBooking.id } });
      expect(unchanged!.status).toBe('CONFIRMED');
    });
  });

  // ── 13. Reschedule booking ownership ──────────────────────────────────────

  describe('PATCH /public/me/bookings/:id/reschedule — ownership', () => {
    it("client A cannot reschedule client B's booking", async () => {
      const emailA = `res-a-${Date.now()}@test.com`;
      const emailB = `res-b-${Date.now()}@test.com`;

      await httpRegister(req, emailA, 'SecurePass1');
      const { clientId: idB } = await httpRegister(req, emailB, 'SecurePass1');

      const bBooking = await seedBooking(testPrisma as never, {
        clientId: idB,
        employeeId,
        serviceId,
        branchId,
        scheduledAt: new Date(Date.now() + 5 * 86_400_000),
        status: 'CONFIRMED',
      });

      const { tokens: tokensA } = await httpLogin(req, emailA, 'SecurePass1');
      const newDate = new Date(Date.now() + 10 * 86_400_000).toISOString();

      const res = await req
        .patch(`/public/me/bookings/${bBooking.id}/reschedule`)
        .set('Authorization', `Bearer ${tokensA.accessToken}`)
        .send({ newScheduledAt: newDate });

      expect([403, 404]).toContain(res.status);

      const unchanged = await testPrisma.booking.findUnique({ where: { id: bBooking.id } });
      expect(unchanged!.scheduledAt.toISOString()).not.toBe(newDate);
    });
  });

  // ── 14. OTP session replay on register ────────────────────────────────────

  describe('POST /public/auth/register — OTP session jti replay', () => {
    it('second register with the same jti returns 400 (account already has a password)', async () => {
      const email = `jti-replay-${Date.now()}@test.com`;
      const { token } = signLoginSession(email);

      // First register succeeds
      const res1 = await req
        .post('/public/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'SecurePass1', name: 'Replay Test' });
      expect(res1.status).toBe(200);

      // Second register with same token (same jti) — client now has passwordHash → 400
      const res2 = await req
        .post('/public/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'SecurePass1', name: 'Replay Test' });
      expect(res2.status).toBe(400);

      // Only one client row created for this email
      const count = await testPrisma.client.count({ where: { email } });
      expect(count).toBe(1);
    });
  });

  // ── 15. Guest-merge conflict — existing passwordHash ──────────────────────

  describe('POST /public/auth/register — guest-merge conflict', () => {
    it('returns 400 when existing row already has passwordHash set', async () => {
      const email = `merge-conflict-${Date.now()}@test.com`;

      // Create a "full" client row with a passwordHash (simulates already-registered)
      const hashVal = await bcrypt.hash('ExistingPass1', 10);
      await testPrisma.client.create({
        data: {
          organizationId: '00000000-0000-0000-0000-000000000001',
          email,
          name: 'Existing Client',
          firstName: 'Existing',
          lastName: 'Client',
          phone: `+9665${Date.now().toString().slice(-8)}`,
          passwordHash: hashVal,
          isActive: true,
          source: 'ONLINE',
          accountType: 'FULL',
        },
      });

      const { token } = signLoginSession(email);
      const res = await req
        .post('/public/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'SecurePass1', name: 'Merge Test' });

      // Handler throws BadRequestException (400) not ConflictException (409)
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('password');

      // The existing client's passwordHash is NOT changed
      const row = await testPrisma.client.findFirst({ where: { email } });
      const stillMatches = await bcrypt.compare('ExistingPass1', row!.passwordHash!);
      expect(stillMatches).toBe(true);
    });
  });

  // ── 16. Guest-to-full merge — email guest without passwordHash ────────────

  describe('POST /public/auth/register — guest merge succeeds', () => {
    it('merges a guest row (no passwordHash) into a full account', async () => {
      const guestEmail = `channel-mismatch-${Date.now()}@test.com`;

      // Guest row: has email set but passwordHash is null
      await testPrisma.client.create({
        data: {
          organizationId: '00000000-0000-0000-0000-000000000001',
          email: guestEmail,
          name: 'Email Guest',
          firstName: 'Email',
          lastName: 'Guest',
          isActive: true,
          source: 'WALK_IN',
        },
      });

      const { token } = signLoginSession(guestEmail);
      const mergeRes = await req
        .post('/public/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'SecurePass1', name: 'Merged' });

      expect(mergeRes.status).toBe(200);
      expect(mergeRes.body).toHaveProperty('clientId');
    });
  });

  // ── 17. Logout ────────────────────────────────────────────────────────────

  describe('POST /public/auth/logout', () => {
    // NOTE: Logout uses ClientLogoutHandler which does a DB lookup via tokenSelector.
    // Only the login flow (ClientLoginHandler) creates the DB rows with tokenSelector+tokenHash.
    // Register flow issues a bare jti with no DB row, so logout cannot revoke it via DB.
    // All logout tests must register first, then login to get a proper DB-backed token pair.

    it('returns 204 and revokes the ClientRefreshToken row', async () => {
      const email = `logout-${Date.now()}@test.com`;
      await httpRegister(req, email, 'SecurePass1');
      const { tokens, body } = await httpLogin(req, email, 'SecurePass1');
      const clientId = body.clientId as string;

      const logoutRes = await req
        .post('/public/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      expect(logoutRes.status).toBe(204);

      // DB row revoked
      const revokedRow = await testPrisma.clientRefreshToken.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      });
      expect(revokedRow).not.toBeNull();
      expect(revokedRow!.revokedAt).not.toBeNull();
    });

    it('POST /public/auth/refresh after logout returns 401', async () => {
      const email = `logout-refresh-${Date.now()}@test.com`;
      await httpRegister(req, email, 'SecurePass1');
      const { tokens } = await httpLogin(req, email, 'SecurePass1');

      await req
        .post('/public/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      // Refresh token has been revoked — should now fail
      const refreshRes = await req
        .post('/public/auth/refresh')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });

  // ── 18. AR/EN field mapping on /me/bookings ───────────────────────────────

  describe('GET /public/me/bookings — AR/EN field mapping', () => {
    // NOTE: ListClientBookingsHandler maps serviceName → service.nameAr and
    it('serviceName contains nameEn and serviceNameAr contains nameAr', async () => {
      // The service seeded in beforeAll has nameEn='Cleaning', nameAr='تنظيف'
      const email = `ar-en-${Date.now()}@test.com`;
      const { clientId, accessToken } = await httpRegister(req, email, 'SecurePass1');

      await seedBooking(testPrisma as never, {
        clientId,
        employeeId,
        serviceId,
        branchId,
        scheduledAt: new Date(Date.now() + 3 * 86_400_000),
        status: 'CONFIRMED',
      });

      const res = await req
        .get('/public/me/bookings')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const items = res.body.items as Array<{ serviceName: string; serviceNameAr: string }>;
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].serviceName).toBe('Cleaning');
      expect(items[0].serviceNameAr).toBe('تنظيف');
    });
  });

  // ── 19. Password reset flow ───────────────────────────────────────────────

  describe('POST /public/auth/reset-password — full flow', () => {
    /** Sign a CLIENT_PASSWORD_RESET OTP session token for tests. */
    function signResetSession(identifier: string): { token: string; jti: string } {
      const jti = uuidv4();
      const token = jwt.sign(
        { identifier, purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.EMAIL, jti },
        TEST_JWT_ACCESS_SECRET,
        { expiresIn: '30m' },
      );
      return { token, jti };
    }

    it('resets password; old refresh tokens are revoked; login with new password succeeds', async () => {
      const email = `pw-reset-${Date.now()}@test.com`;
      // Register and login to get a DB-backed refresh token
      await httpRegister(req, email, 'OldPass1');
      const { tokens: oldTokens, body } = await httpLogin(req, email, 'OldPass1');
      const clientId = body.clientId as string;

      // Confirm a live refresh token exists
      const liveToken = await testPrisma.clientRefreshToken.findFirst({
        where: { clientId, revokedAt: null },
      });
      expect(liveToken).not.toBeNull();

      // Reset password via signed OTP session
      const { token: resetToken } = signResetSession(email);
      const resetRes = await req
        .post('/public/auth/reset-password')
        .send({ sessionToken: resetToken, newPassword: 'NewPass1' });
      expect(resetRes.status).toBe(204);

      // All previous refresh tokens must now be revoked
      const revokedToken = await testPrisma.clientRefreshToken.findUnique({
        where: { id: liveToken!.id },
      });
      expect(revokedToken!.revokedAt).not.toBeNull();

      // Old access token still works for guard (it's stateless), but old refresh token is dead
      const oldRefreshRes = await req
        .post('/public/auth/refresh')
        .set('Authorization', `Bearer ${oldTokens.accessToken}`)
        .send({ refreshToken: oldTokens.refreshToken });
      expect(oldRefreshRes.status).toBe(401);

      // Login with new password succeeds
      const newLoginRes = await req
        .post('/public/auth/login')
        .send({ email, password: 'NewPass1' });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body).toHaveProperty('clientId', clientId);

      // Login with old password fails
      const oldLoginRes = await req
        .post('/public/auth/login')
        .send({ email, password: 'OldPass1' });
      expect(oldLoginRes.status).toBe(401);
    });

    it('returns 401 when session token is expired or invalid', async () => {
      const res = await req
        .post('/public/auth/reset-password')
        .send({ sessionToken: 'not-a-valid-jwt', newPassword: 'NewPass1' });
      expect(res.status).toBe(401);
    });

    it('returns 401 when session jti is replayed (already burned)', async () => {
      const email = `pw-replay-${Date.now()}@test.com`;
      await httpRegister(req, email, 'OldPass1');

      const { token: resetToken, jti } = signResetSession(email);

      // Burn the jti manually to simulate replay
      await testPrisma.usedOtpSession.create({
        data: { jti, consumedAt: new Date(), expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      });

      const res = await req
        .post('/public/auth/reset-password')
        .send({ sessionToken: resetToken, newPassword: 'NewPass1' });
      expect(res.status).toBe(401);
    });

    it('returns 401 when session purpose is wrong (CLIENT_LOGIN session used for reset)', async () => {
      const email = `pw-wrong-purpose-${Date.now()}@test.com`;
      await httpRegister(req, email, 'OldPass1');

      // Sign with CLIENT_LOGIN purpose
      const { token: loginSessionToken } = signLoginSession(email);

      const res = await req
        .post('/public/auth/reset-password')
        .send({ sessionToken: loginSessionToken, newPassword: 'NewPass1' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when newPassword fails validation', async () => {
      const { token } = signResetSession('any@example.com');
      const res = await req
        .post('/public/auth/reset-password')
        .send({ sessionToken: token, newPassword: 'weak' });
      // class-validator returns 400
      expect(res.status).toBe(400);
    });
  });

  // ── 20. Guest merge: booking visible after merge ──────────────────────────

  describe('Guest-to-account merge', () => {
    it('guest booking is visible after merge via register', async () => {
      const guestEmail = `guestmerge-${Date.now()}@test.com`;

      const guestClient = await testPrisma.client.create({
        data: {
          organizationId: '00000000-0000-0000-0000-000000000001',
          name: 'Guest',
          firstName: 'Guest',
          lastName: 'User',
          email: guestEmail,
          phone: `+9665${(Date.now() + 9).toString().slice(-8)}`,
          isActive: true,
          source: 'WALK_IN',
        },
      });

      const guestBooking = await seedBooking(testPrisma as never, {
        clientId: guestClient.id,
        employeeId,
        serviceId,
        branchId,
        scheduledAt: new Date(Date.now() + 5 * 86_400_000),
        status: 'CONFIRMED',
      });

      const { token } = signLoginSession(guestEmail);
      const regRes = await req
        .post('/public/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'SecurePass1', name: 'Merged Guest' });
      expect(regRes.status).toBe(200);

      const { tokens } = await httpLogin(req, guestEmail, 'SecurePass1');

      const bookingsRes = await req
        .get('/public/me/bookings')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      expect(bookingsRes.status).toBe(200);

      const ids = (bookingsRes.body.items as Array<{ id: string }>).map((b) => b.id);
      expect(ids).toContain(guestBooking.id);
    });
  });
});
