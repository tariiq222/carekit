/**
 * Auth Coverage E2E Tests
 *
 * Fills gaps identified in the coverage audit:
 *   - AU-L5:  Deactivated user → 403
 *   - AU-O2:  OTP send for unregistered email (security — returns 200, not 404)
 *   - AU-O3:  Verify correct OTP within validity → 200 + tokens
 *   - AU-O5:  Expired OTP → 400 OTP_EXPIRED
 *   - AU-FP3: Reset password with valid OTP
 *   - AU-FP6: Login with new password after reset
 *   - AU-FP7: Old password no longer works after reset
 *   - AU-CP4: Old refreshToken invalid after password change
 *   - AU-EV2: Email verification with valid OTP → emailVerified=true
 *
 * Strategy: extract OTPs directly from DB via PrismaService obtained
 * from the NestJS test module. This avoids placeholder codes and tests
 * the real OTP flow end-to-end.
 */

import request from 'supertest';
import { PrismaService } from '../../../src/database/prisma.service';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  type TestApp,
} from '../setup/setup';

const AUTH_URL = `${API_PREFIX}/auth`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract refresh_token value from Set-Cookie header */
function extractCookieToken(cookieHeader: string[]): string {
  const entry = cookieHeader.find((c: string) => c.startsWith('refresh_token='));
  if (!entry) throw new Error('refresh_token cookie not found');
  return entry.split(';')[0].replace('refresh_token=', '');
}

/** Register a fresh user and return tokens + userId */
async function registerFresh(
  httpServer: unknown,
  suffix: string,
): Promise<{ email: string; password: string; accessToken: string; refreshToken: string; userId: string }> {
  const email = `coverage-${suffix}@carekit-test.com`;
  const password = 'C0ver@geP@ss!';
  const res = await request(httpServer as Parameters<typeof request>[0])
    .post(`${AUTH_URL}/register`)
    .send({
      email,
      password,
      firstName: 'اختبار',
      lastName: 'التغطية',
      phone: `+9665${Date.now().toString().slice(-8)}`,
      gender: 'male',
    })
    .expect(201);

  // refreshToken is in HTTP-only cookie, not body
  const refreshToken = extractCookieToken(res.headers['set-cookie'] as string[]);

  return {
    email,
    password,
    accessToken: res.body.data.accessToken as string,
    refreshToken,
    userId: res.body.data.user.id as string,
  };
}

/** Read the most recent unused OTP for a user+type directly from DB */
async function getLatestOtp(
  prisma: PrismaService,
  userId: string,
  type: 'login' | 'reset_password' | 'verify_email',
): Promise<string | null> {
  const otp = await prisma.otpCode.findFirst({
    where: { userId, type, usedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { code: true },
  });
  return otp?.code ?? null;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Auth Coverage — Gap Fill (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let prisma: PrismaService;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;
    prisma = testApp.module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // =========================================================================
  // AU-L5 — Deactivated account → 403
  // =========================================================================

  describe('AU-L5: Deactivated account', () => {
    it('should return 403 AUTH_ACCOUNT_DEACTIVATED when account is deactivated', async () => {
      // Register user
      const { email, password, userId } = await registerFresh(httpServer, 'deactivated');

      // Deactivate via DB (simulates admin deactivating account)
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      const res = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email, password })
        .expect(403);

      expectErrorResponse(res.body, 'AUTH_ACCOUNT_DEACTIVATED');
    });
  });

  // =========================================================================
  // AU-O2 — OTP send for unregistered email
  // =========================================================================

  describe('AU-O2: OTP send for unregistered email', () => {
    it('should return 200 (not 404) to avoid email enumeration', async () => {
      const res = await request(httpServer)
        .post(`${AUTH_URL}/login/otp/send`)
        .send({ email: 'completely-unknown-au-o2@carekit-test.com' })
        .expect(200);

      // Security: must not reveal whether email exists
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
    });

    it('should NOT create an OTP in DB for unregistered email', async () => {
      const unknownEmail = 'no-otp-created-au-o2@carekit-test.com';
      await request(httpServer)
        .post(`${AUTH_URL}/login/otp/send`)
        .send({ email: unknownEmail })
        .expect(200);

      // No user, so no OTP should be in DB
      const user = await prisma.user.findUnique({ where: { email: unknownEmail } });
      expect(user).toBeNull();
    });
  });

  // =========================================================================
  // AU-O3 — Verify correct OTP → 200 + tokens
  // =========================================================================

  describe('AU-O3: OTP login — verify correct OTP', () => {
    it('AU-O3 should return 200 + accessToken + refreshToken for correct OTP', async () => {
      const { email, userId } = await registerFresh(httpServer, 'otp-verify');

      // Trigger OTP generation
      await request(httpServer)
        .post(`${AUTH_URL}/login/otp/send`)
        .send({ email })
        .expect(200);

      // Fetch OTP from DB
      const code = await getLatestOtp(prisma, userId, 'login');
      expect(code).not.toBeNull();

      // Verify OTP
      const res = await request(httpServer)
        .post(`${AUTH_URL}/login/otp/verify`)
        .send({ email, code })
        .expect(200);

      expectSuccessResponse(res.body);
      const { data } = res.body as { data: { accessToken: string; expiresIn: number; user: Record<string, unknown> } };
      expect(typeof data.accessToken).toBe('string');
      // refreshToken is in HTTP-only cookie, not body (consistent with login endpoint)
      expect(res.headers['set-cookie']).toBeDefined();
      const cookie = (res.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('refresh_token='));
      expect(cookie).toBeDefined();
      expect(data.expiresIn).toBe(900);
      expect(data.user.email).toBe(email);
    });

    it('AU-O3 should mark OTP as used after verification (no reuse)', async () => {
      const { email, userId } = await registerFresh(httpServer, 'otp-used');

      await request(httpServer)
        .post(`${AUTH_URL}/login/otp/send`)
        .send({ email })
        .expect(200);

      const code = await getLatestOtp(prisma, userId, 'login');
      expect(code).not.toBeNull();

      // First use — should succeed
      await request(httpServer)
        .post(`${AUTH_URL}/login/otp/verify`)
        .send({ email, code })
        .expect(200);

      // Second use with same OTP — must fail
      const res2 = await request(httpServer)
        .post(`${AUTH_URL}/login/otp/verify`)
        .send({ email, code })
        .expect(400);

      const errorCode = (res2.body.error as { code: string }).code;
      expect(['AUTH_OTP_INVALID', 'AUTH_OTP_EXPIRED']).toContain(errorCode);
    });
  });

  // =========================================================================
  // AU-O5 — Expired OTP → 400 OTP_EXPIRED
  // =========================================================================

  describe('AU-O5: Expired OTP rejected', () => {
    it('AU-O5 should return 400 AUTH_OTP_EXPIRED for an expired OTP', async () => {
      const { email, userId } = await registerFresh(httpServer, 'otp-expired');

      // Insert an already-expired OTP directly
      const expiredAt = new Date(Date.now() - 60_000); // 1 minute in the past
      const expiredCode = '777777';
      await prisma.otpCode.create({
        data: {
          userId,
          code: expiredCode,
          type: 'login',
          expiresAt: expiredAt,
        },
      });

      const res = await request(httpServer)
        .post(`${AUTH_URL}/login/otp/verify`)
        .send({ email, code: expiredCode })
        .expect(400);

      expectErrorResponse(res.body, 'AUTH_OTP_EXPIRED');
    });
  });

  // =========================================================================
  // AU-FP3 — Reset password with valid OTP
  // AU-FP6 — Login with new password after reset
  // AU-FP7 — Old password no longer works after reset
  // =========================================================================

  describe('AU-FP3/FP6/FP7: Full password reset flow', () => {
    const newPassword = 'N3wR3set@Pass!';
    let email: string;
    let originalPassword: string;
    let userId: string;

    beforeAll(async () => {
      const user = await registerFresh(httpServer, 'forgot-full');
      email = user.email;
      originalPassword = user.password;
      userId = user.userId;
    });

    it('AU-FP3 should reset password with valid OTP and return 200', async () => {
      // Trigger forgot password OTP
      await request(httpServer)
        .post(`${AUTH_URL}/password/forgot`)
        .send({ email })
        .expect(200);

      // Fetch OTP from DB
      const code = await getLatestOtp(prisma, userId, 'reset_password');
      expect(code).not.toBeNull();

      // Reset password
      const res = await request(httpServer)
        .post(`${AUTH_URL}/password/reset`)
        .send({ email, code, newPassword })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Password reset successful');
    });

    it('AU-FP6 should allow login with new password after reset', async () => {
      const res = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email, password: newPassword })
        .expect(200);

      expectSuccessResponse(res.body);
      expect((res.body as { data: { user: { email: string } } }).data.user.email).toBe(email);
    });

    it('AU-FP7 old password should be rejected after reset', async () => {
      const res = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email, password: originalPassword })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_INVALID_CREDENTIALS');
    });
  });

  // =========================================================================
  // AU-CP4 — Old refreshToken invalid after password change
  // =========================================================================

  describe('AU-CP4: Old refresh token rejected after password change', () => {
    it('AU-CP4 should invalidate all refresh tokens when password is changed', async () => {
      const { email, password, accessToken, refreshToken } = await registerFresh(httpServer, 'cp4-revoke');

      // Change password
      await request(httpServer)
        .patch(`${AUTH_URL}/password/change`)
        .set(getAuthHeaders(accessToken))
        .send({
          currentPassword: password,
          newPassword: 'N3wCh@nged!Pass',
        })
        .expect(200);

      // Old refresh token must now be invalid
      const res = await request(httpServer)
        .post(`${AUTH_URL}/refresh-token`)
        .send({ refreshToken })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_REFRESH_TOKEN_INVALID');
    });
  });

  // =========================================================================
  // AU-EV2 — Email verification with valid OTP → emailVerified=true
  // =========================================================================

  describe('AU-EV2: Email verification with valid OTP', () => {
    it('AU-EV2 should set emailVerified=true after verifying OTP', async () => {
      const { userId, accessToken } = await registerFresh(httpServer, 'ev2-verify');

      // Confirm initial state
      const meBefore = await request(httpServer)
        .get(`${AUTH_URL}/me`)
        .set(getAuthHeaders(accessToken))
        .expect(200);

      expect((meBefore.body as { data: { emailVerified: boolean } }).data.emailVerified).toBe(false);

      // Send verification OTP
      await request(httpServer)
        .post(`${AUTH_URL}/email/verify/send`)
        .set(getAuthHeaders(accessToken))
        .expect(200);

      // Fetch OTP from DB
      const code = await getLatestOtp(prisma, userId, 'verify_email');
      expect(code).not.toBeNull();

      // Verify email
      const verifyRes = await request(httpServer)
        .post(`${AUTH_URL}/email/verify`)
        .set(getAuthHeaders(accessToken))
        .send({ code })
        .expect(200);

      expect(verifyRes.body).toHaveProperty('success', true);
      expect(verifyRes.body).toHaveProperty('message', 'Email verified successfully');

      // Confirm DB state via /me
      const meAfter = await request(httpServer)
        .get(`${AUTH_URL}/me`)
        .set(getAuthHeaders(accessToken))
        .expect(200);

      expect((meAfter.body as { data: { emailVerified: boolean } }).data.emailVerified).toBe(true);
    });
  });

  // =========================================================================
  // AU-R2 — Weak password (no uppercase) → 400
  // =========================================================================

  describe('AU-R2: Weak password validation', () => {
    it('AU-R2 should reject password with no uppercase letter', async () => {
      const res = await request(httpServer)
        .post(`${AUTH_URL}/register`)
        .send({
          email: 'au-r2-noupper@carekit-test.com',
          password: 'nouppercase1!',
          firstName: 'اختبار',
          lastName: 'الكلمة',
          phone: '+966521000099',
          gender: 'male',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('AU-R2 should reject password with no digit', async () => {
      const res = await request(httpServer)
        .post(`${AUTH_URL}/register`)
        .send({
          email: 'au-r2-nodigit@carekit-test.com',
          password: 'NoDigitPass!',
          firstName: 'اختبار',
          lastName: 'الكلمة',
          phone: '+966521000098',
          gender: 'male',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });
});
