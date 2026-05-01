/**
 * Staff (User) Password Reset — E2E Suite
 *
 * Endpoints under test:
 *   POST /auth/request-password-reset  → 204 always (silent for unknown email)
 *   POST /auth/reset-password          → 204 on success, 401 on bad/expired/consumed token
 *
 * Strategy: write PasswordResetToken rows directly to DB with known raw values
 * (tokenSelector = first 8 chars of raw token, tokenHash = sha256(rawToken)).
 * This sidesteps the SendEmailHandler spy entirely and still exercises the full
 * perform-reset path including the DB transaction that updates User, marks the
 * token consumed, and revokes all RefreshToken rows.
 */
import { createHash, randomBytes } from 'crypto';
import SuperTest from 'supertest';
import * as bcrypt from 'bcryptjs';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedUser } from '../../setup/seed.helper';
import {
  createPublicTestApp,
  closePublicTestApp,
  type PublicTestApp,
} from './public-test-app';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a raw reset token + the DB-storable selector/hash pair. */
function makeRawToken(): { raw: string; tokenSelector: string; tokenHash: string } {
  const raw = randomBytes(32).toString('hex');
  return {
    raw,
    tokenSelector: raw.slice(0, 8),
    tokenHash: createHash('sha256').update(raw).digest('hex'),
  };
}

/**
 * Seed a PasswordResetToken row with a known raw value.
 * Returns the raw token so the test can POST it to the endpoint.
 */
async function seedResetToken(
  userId: string,
  opts: { expiresAt?: Date; consumedAt?: Date | null } = {},
): Promise<string> {
  const { raw, tokenSelector, tokenHash } = makeRawToken();
  await testPrisma.passwordResetToken.create({
    data: {
      userId,
      tokenSelector,
      tokenHash,
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 30 * 60 * 1_000),
      consumedAt: opts.consumedAt ?? null,
    },
  });
  return raw;
}

// ── Tables cleaned between tests ───────────────────────────────────────────────
const RESET_TABLES = ['PasswordResetToken', 'RefreshToken', 'User'];

// ─────────────────────────────────────────────────────────────────────────────
describe('Staff Password Reset (e2e)', () => {
  let req: SuperTest.SuperTest<SuperTest.Test>;

  beforeAll(async () => {
    const app = await createPublicTestApp();
    req = app.request as unknown as SuperTest.SuperTest<SuperTest.Test>;
    await cleanTables(RESET_TABLES);
  });

  afterAll(async () => {
    await cleanTables(RESET_TABLES);
    await closePublicTestApp();
  });

  beforeEach(async () => {
    await cleanTables(RESET_TABLES);
  });

  // ── 1. Unknown email → 204, no token created ─────────────────────────────

  describe('POST /auth/request-password-reset — unknown email', () => {
    it('returns 204 and creates zero PasswordResetToken rows', async () => {
      const countBefore = await testPrisma.passwordResetToken.count();

      const res = await req
        .post('/auth/request-password-reset')
        .send({ email: `no-such-user-${Date.now()}@test.com`, hCaptchaToken: 'test-valid' });

      expect(res.status).toBe(204);
      const countAfter = await testPrisma.passwordResetToken.count();
      expect(countAfter).toBe(countBefore);
    });
  });

  // ── 2. Valid staff email → 204, token row created ─────────────────────────

  describe('POST /auth/request-password-reset — valid email', () => {
    it('returns 204 and creates exactly one PasswordResetToken row', async () => {
      const user = await seedUser(testPrisma as never, {
        email: `reset-req-${Date.now()}@test.com`,
        password: 'OldPass1!',
      });

      const countBefore = await testPrisma.passwordResetToken.count();

      const res = await req
        .post('/auth/request-password-reset')
        .send({ email: user.email, hCaptchaToken: 'test-valid' });

      expect(res.status).toBe(204);

      const countAfter = await testPrisma.passwordResetToken.count();
      expect(countAfter).toBe(countBefore + 1);

      const token = await testPrisma.passwordResetToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(token).not.toBeNull();
      expect(token!.consumedAt).toBeNull();
      expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ── 3. Non-existent token → 401 ──────────────────────────────────────────

  describe('POST /auth/reset-password — non-existent token', () => {
    it('returns 401 for a token that has no matching DB row', async () => {
      const { raw } = makeRawToken(); // nothing seeded in DB

      const res = await req
        .post('/auth/reset-password')
        .send({ token: raw, newPassword: 'NewPass1!' });

      expect(res.status).toBe(401);
    });
  });

  // ── 4. Expired token → 401 ────────────────────────────────────────────────

  describe('POST /auth/reset-password — expired token', () => {
    it('returns 401 for a token whose expiresAt is in the past', async () => {
      const user = await seedUser(testPrisma as never, {
        email: `expired-${Date.now()}@test.com`,
        password: 'OldPass1!',
      });

      const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
      const rawToken = await seedResetToken(user.id, { expiresAt: pastDate });

      const res = await req
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPass1!' });

      expect(res.status).toBe(401);
    });
  });

  // ── 5. Already-consumed token → 401 ──────────────────────────────────────

  describe('POST /auth/reset-password — already-consumed token', () => {
    it('returns 401 for a token that already has consumedAt set', async () => {
      const user = await seedUser(testPrisma as never, {
        email: `consumed-${Date.now()}@test.com`,
        password: 'OldPass1!',
      });

      const rawToken = await seedResetToken(user.id, {
        consumedAt: new Date(Date.now() - 5_000),
      });

      const res = await req
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPass1!' });

      expect(res.status).toBe(401);
    });
  });

  // ── 6. Full happy path ────────────────────────────────────────────────────

  describe('POST /auth/reset-password — happy path', () => {
    it('resets password, marks token consumed, revokes refresh tokens, blocks replay, allows new login', async () => {
      const oldPassword = 'OldPass1!';
      const newPassword = 'NewPass2!';

      const user = await seedUser(testPrisma as never, {
        email: `happy-reset-${Date.now()}@test.com`,
        password: oldPassword,
      });

      // Seed a live RefreshToken row for this user so we can verify revocation.
      // organizationId must match the default org used by the tenant resolver in
      // permissive/test mode — the scoping extension injects it into updateMany.
      const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
      const rawRefresh = randomBytes(16).toString('hex');
      await testPrisma.refreshToken.create({
        data: {
          userId: user.id,
          organizationId: DEFAULT_ORG_ID,
          tokenSelector: rawRefresh.slice(0, 8),
          tokenHash: await bcrypt.hash(rawRefresh, 10),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
          revokedAt: null,
        },
      });

      // Seed a valid reset token with a known raw value.
      const rawToken = await seedResetToken(user.id);

      // ── Perform the reset ────────────────────────────────────────────────
      const resetRes = await req
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword });

      expect(resetRes.status).toBe(204);

      // ── User.passwordHash changed ────────────────────────────────────────
      const updatedUser = await testPrisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser).not.toBeNull();
      const hashChanged = !(await bcrypt.compare(oldPassword, updatedUser!.passwordHash!));
      expect(hashChanged).toBe(true);
      const newHashMatches = await bcrypt.compare(newPassword, updatedUser!.passwordHash!);
      expect(newHashMatches).toBe(true);

      // ── PasswordResetToken.consumedAt is set ─────────────────────────────
      const tokenRecord = await testPrisma.passwordResetToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(tokenRecord!.consumedAt).not.toBeNull();

      // ── All RefreshToken rows for this user have revokedAt set ───────────
      const liveRefreshTokens = await testPrisma.refreshToken.findMany({
        where: { userId: user.id, revokedAt: null },
      });
      expect(liveRefreshTokens).toHaveLength(0);

      // ── Re-using the same raw token returns 401 (replay) ─────────────────
      const replayRes = await req
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'AnotherPass3!' });
      expect(replayRes.status).toBe(401);

      // ── Login with new password succeeds ─────────────────────────────────
      const loginRes = await req
        .post('/auth/login')
        .send({ email: user.email, password: newPassword, hCaptchaToken: 'test-valid' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty('accessToken');
    });
  });
});
