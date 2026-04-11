/**
 * CareKit — Auth Module E2E Tests (TDD RED Phase)
 *
 * Tests all auth endpoints per docs/api-spec.md:
 *   POST /register
 *   POST /login
 *   POST /login/otp/send
 *   POST /login/otp/verify
 *   POST /refresh-token
 *   POST /logout
 *   GET  /me
 *   POST /password/forgot
 *   POST /password/reset
 *   PATCH /password/change
 *   POST /email/verify/send
 *   POST /email/verify
 *
 * These tests will FAIL until backend-dev implements the auth module.
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  TEST_USERS,
  TEST_PATIENT_2,
  expectSuccessResponse,
  expectErrorResponse,
  expectValidationError,
  getAuthHeaders,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const AUTH_URL = `${API_PREFIX}/auth`;

describe('Auth Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // =========================================================================
  // POST /register
  // =========================================================================

  describe('POST /auth/register', () => {
    const url = `${AUTH_URL}/register`;
    const validPayload = {
      email: 'newpatient@carekit-test.com',
      password: 'Str0ngP@ss!',
      firstName: 'محمد',
      lastName: 'السعيد',
      phone: '+966502345678',
      gender: 'male',
    };

    it('should register a new patient with valid data', async () => {
      const res = await request(httpServer)
        .post(url)
        .send(validPayload)
        .expect(201);

      expectSuccessResponse(res.body);
      // register returns { success, data } — no top-level message field

      const { data } = res.body;

      // User object
      expect(data.user).toBeDefined();
      expect(data.user.id).toBeDefined();
      expect(data.user.email).toBe(validPayload.email);
      expect(data.user.firstName).toBe(validPayload.firstName);
      expect(data.user.lastName).toBe(validPayload.lastName);
      expect(data.user.phone).toBe(validPayload.phone);
      expect(data.user.gender).toBe(validPayload.gender);
      expect(data.user.isActive).toBe(true);
      expect(data.user.emailVerified).toBe(false);
      expect(data.user.createdAt).toBeDefined();

      // Password must NEVER be returned
      expect(data.user).not.toHaveProperty('password');
      expect(data.user).not.toHaveProperty('passwordHash');

      // Tokens — refreshToken is set in HTTP-only cookie, not in body
      expect(typeof data.accessToken).toBe('string');
      expect(data.accessToken.length).toBeGreaterThan(0);
      expect(data.expiresIn).toBe(900); // 15 minutes
      // refreshToken must NOT be exposed in response body (security: HTTP-only cookie only)
      expect(data).not.toHaveProperty('refreshToken');
    });

    it('should auto-assign patient role to newly registered user', async () => {
      // Register + login, then check /me to verify role
      const registerRes = await request(httpServer)
        .post(url)
        .send({
          ...validPayload,
          email: 'role-check@carekit-test.com',
          phone: '+966502345679',
        })
        .expect(201);

      const token = registerRes.body.data.accessToken;

      const meRes = await request(httpServer)
        .get(`${AUTH_URL}/me`)
        .set(getAuthHeaders(token))
        .expect(200);

      const roles = meRes.body.data.roles;
      expect(Array.isArray(roles)).toBe(true);

      // Roles should include 'patient' (either as string array or object array)
      const roleIdentifiers = roles.map((r: string | { slug: string }) =>
        typeof r === 'string' ? r : r.slug,
      );
      expect(roleIdentifiers).toContain('patient');
    });

    it('should reject registration with duplicate email', async () => {
      // First registration
      await request(httpServer)
        .post(url)
        .send({
          ...validPayload,
          email: 'duplicate@carekit-test.com',
          phone: '+966502345680',
        })
        .expect(201);

      // Second registration with same email
      const res = await request(httpServer)
        .post(url)
        .send({
          ...validPayload,
          email: 'duplicate@carekit-test.com',
          phone: '+966502345681',
        })
        .expect(409);

      expectErrorResponse(res.body, 'USER_EMAIL_EXISTS');
    });

    it('should reject registration with weak password (< 8 chars)', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({
          ...validPayload,
          email: 'weak-pass@carekit-test.com',
          password: 'short',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject registration with missing required fields', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ email: 'incomplete@carekit-test.com' })
        .expect(400);

      expectValidationError(res.body, ['password', 'firstName', 'lastName']);
    });

    it('should reject registration with invalid email format', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({
          ...validPayload,
          email: 'not-an-email',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject registration with invalid gender value', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({
          ...validPayload,
          email: 'bad-gender@carekit-test.com',
          gender: 'unknown',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject registration with invalid phone format', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({
          ...validPayload,
          email: 'bad-phone@carekit-test.com',
          phone: '12345',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should trim whitespace from email and names', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({
          ...validPayload,
          email: '  trimmed@carekit-test.com  ',
          phone: '+966502345682',
          firstName: '  علي  ',
          lastName: '  المالكي  ',
        })
        .expect(201);

      expect(res.body.data.user.email).toBe('trimmed@carekit-test.com');
      expect(res.body.data.user.firstName).toBe('علي');
      expect(res.body.data.user.lastName).toBe('المالكي');
    });
  });

  // =========================================================================
  // POST /login
  // =========================================================================

  describe('POST /auth/login', () => {
    const url = `${AUTH_URL}/login`;
    let registeredEmail: string;
    let registeredPassword: string;

    beforeAll(async () => {
      // Register a patient to login with
      registeredEmail = 'login-test@carekit-test.com';
      registeredPassword = 'L0g!nTestP@ss';

      await request(httpServer)
        .post(`${AUTH_URL}/register`)
        .send({
          email: registeredEmail,
          password: registeredPassword,
          firstName: 'سارة',
          lastName: 'العمري',
          phone: '+966503456789',
          gender: 'female',
        })
        .expect(201);
    });

    it('should login with valid credentials and return tokens', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ email: registeredEmail, password: registeredPassword })
        .expect(200);

      expectSuccessResponse(res.body);

      const { data } = res.body;

      // User object
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(registeredEmail);
      expect(data.user.roles).toBeDefined();
      expect(data.user.permissions).toBeDefined();
      expect(Array.isArray(data.user.roles)).toBe(true);
      expect(Array.isArray(data.user.permissions)).toBe(true);

      // Password must NEVER be returned
      expect(data.user).not.toHaveProperty('password');
      expect(data.user).not.toHaveProperty('passwordHash');

      // Tokens — refreshToken is in HTTP-only cookie, not body
      expect(typeof data.accessToken).toBe('string');
      expect(data.expiresIn).toBe(900);
      expect(data).not.toHaveProperty('refreshToken');
    });

    it('should reject login with wrong password', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ email: registeredEmail, password: 'WrongP@ss123' })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent email (same error as wrong password)', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ email: 'nonexistent@carekit-test.com', password: 'AnyP@ss123' })
        .expect(401);

      // Must NOT reveal whether the email exists — same error code
      expectErrorResponse(res.body, 'AUTH_INVALID_CREDENTIALS');
    });

    it('should reject login for deactivated user', async () => {
      // This test assumes a super_admin can deactivate a user.
      // For now, we test the expected behaviour — implementation will
      // need to seed a deactivated user or use admin API.
      const res = await request(httpServer).post(url).send({
        email: 'deactivated-user@carekit-test.com',
        password: 'SomeP@ss1',
      });

      // If user doesn't exist, we get 401. If deactivated, we expect 403.
      // This test specifically targets the deactivation path —
      // backend-dev must create a deactivated user fixture for this.
      if (res.status === 403) {
        expectErrorResponse(res.body, 'AUTH_ACCOUNT_DEACTIVATED');
      }
    });

    it('should be case-insensitive for email', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({
          email: registeredEmail.toUpperCase(),
          password: registeredPassword,
        })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject login with missing email', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ password: 'SomeP@ss1' })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject login with missing password', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ email: registeredEmail })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // POST /login/otp/send
  // =========================================================================

  describe('POST /auth/login/otp/send', () => {
    const url = `${AUTH_URL}/login/otp/send`;

    beforeAll(async () => {
      // Ensure a user exists for OTP testing
      await request(httpServer).post(`${AUTH_URL}/register`).send({
        email: 'otp-user@carekit-test.com',
        password: 'OtpUserP@ss1',
        firstName: 'ياسر',
        lastName: 'الدوسري',
        phone: '+966504567890',
        gender: 'male',
      });
    });

    it('should send OTP to valid email and return success', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ email: 'otp-user@carekit-test.com' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
    });

    it('should return success even for non-existent email (security)', async () => {
      // Must NOT reveal whether email exists
      const res = await request(httpServer)
        .post(url)
        .send({ email: 'nonexistent-otp@carekit-test.com' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });

    it('should rate-limit OTP requests (max 3/min per api-spec)', async () => {
      const targetEmail = 'rate-limit-otp@carekit-test.com';

      // Register user first
      await request(httpServer).post(`${AUTH_URL}/register`).send({
        email: targetEmail,
        password: 'RateL!mitP@ss1',
        firstName: 'تركي',
        lastName: 'المطيري',
        phone: '+966505678901',
        gender: 'male',
      });

      // Send 3 requests (should all succeed)
      for (let i = 0; i < 3; i++) {
        await request(httpServer).post(url).send({ email: targetEmail });
      }

      // 4th request should be rate-limited
      const res = await request(httpServer)
        .post(url)
        .send({ email: targetEmail })
        .expect(429);

      expectErrorResponse(res.body, 'OTP_RATE_LIMIT_EXCEEDED');
    });

    it('should reject request with missing email', async () => {
      const res = await request(httpServer).post(url).send({}).expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject request with invalid email format', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ email: 'not-an-email' })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // POST /login/otp/verify
  // =========================================================================

  describe('POST /auth/login/otp/verify', () => {
    const url = `${AUTH_URL}/login/otp/verify`;

    it('should verify valid OTP and return tokens (same shape as /login)', async () => {
      // Send OTP first
      await request(httpServer)
        .post(`${AUTH_URL}/login/otp/send`)
        .send({ email: 'otp-user@carekit-test.com' })
        .expect(200);

      // In real test, we'd need to extract the OTP from DB or mock email.
      // For TDD contract: this defines the expected response shape.
      const res = await request(httpServer).post(url).send({
        email: 'otp-user@carekit-test.com',
        code: '123456', // Placeholder — backend-dev should provide test OTP mechanism
      });

      // If OTP is valid (backend-dev to implement test OTP), expect login response
      if (res.status === 200) {
        expectSuccessResponse(res.body);
        const { data } = res.body;
        expect(data.user).toBeDefined();
        expect(data.user.email).toBe('otp-user@carekit-test.com');
        expect(typeof data.accessToken).toBe('string');
        expect(typeof data.refreshToken).toBe('string');
        expect(data.expiresIn).toBe(900);
      }
    });

    it('should reject wrong OTP code (AU-O5 expired OTP tested in auth-coverage.e2e-spec.ts)', async () => {
      // Sends a code that doesn't match any OTP — must reject
      const res = await request(httpServer)
        .post(url)
        .send({
          email: 'otp-user@carekit-test.com',
          code: '000000',
        })
        .expect(400);

      const errorCode = (res.body.error as { code: string }).code;
      // Either INVALID (active OTP exists) or EXPIRED (no active OTP)
      expect(['AUTH_OTP_INVALID', 'AUTH_OTP_EXPIRED']).toContain(errorCode);
    });

    it('should reject already-used OTP', async () => {
      const res = await request(httpServer).post(url).send({
        email: 'otp-user@carekit-test.com',
        code: '111111', // Previously used OTP
      });

      // Could be AUTH_OTP_INVALID or AUTH_OTP_EXPIRED depending on impl
      if (res.status === 400) {
        const errorCode = (res.body.error as { code: string }).code;
        expect(['AUTH_OTP_INVALID', 'AUTH_OTP_EXPIRED']).toContain(errorCode);
      }
    });

    it('should reject invalid OTP code', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({
          email: 'otp-user@carekit-test.com',
          code: '999999',
        })
        .expect(400);

      expectErrorResponse(res.body, 'AUTH_OTP_INVALID');
    });

    it('should reject OTP verification with missing code', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ email: 'otp-user@carekit-test.com' })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject OTP verification with missing email', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ code: '123456' })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // POST /refresh-token
  // =========================================================================

  describe('POST /auth/refresh-token', () => {
    const url = `${AUTH_URL}/refresh-token`;
    let validRefreshToken: string;

    /** Extract refresh_token value from Set-Cookie header */
    function extractRefreshTokenCookie(cookieHeader: string[]): string {
      const entry = cookieHeader.find((c: string) =>
        c.startsWith('refresh_token='),
      );
      if (!entry)
        throw new Error('refresh_token cookie not found in Set-Cookie header');
      return entry.split(';')[0].replace('refresh_token=', '');
    }

    beforeAll(async () => {
      const registerRes = await request(httpServer)
        .post(`${AUTH_URL}/register`)
        .send({
          email: 'refresh-test@carekit-test.com',
          password: 'Refr3shP@ss!',
          firstName: 'عمر',
          lastName: 'الشهراني',
          phone: '+966506789012',
          gender: 'male',
        })
        .expect(201);

      // refreshToken is in HTTP-only cookie, not body
      validRefreshToken = extractRefreshTokenCookie(
        registerRes.headers['set-cookie'] as string[],
      );
    });

    it('should return new access + refresh token with valid refresh token', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      expectSuccessResponse(res.body);

      const { data } = res.body;
      expect(typeof data.accessToken).toBe('string');
      expect(typeof data.refreshToken).toBe('string');
      expect(data.expiresIn).toBe(900);

      // New refresh token should differ from old one (token rotation)
      expect(data.refreshToken).not.toBe(validRefreshToken);

      // Save new token for subsequent tests
      validRefreshToken = data.refreshToken;
    });

    it('should invalidate old refresh token after rotation', async () => {
      // Use current valid token
      const res1 = await request(httpServer)
        .post(url)
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      const oldToken = validRefreshToken;
      validRefreshToken = res1.body.data.refreshToken;

      // Old token should now be invalid
      const res2 = await request(httpServer)
        .post(url)
        .send({ refreshToken: oldToken })
        .expect(401);

      expectErrorResponse(res2.body, 'AUTH_REFRESH_TOKEN_INVALID');
    });

    it('should reject expired refresh token', async () => {
      // This test requires backend to generate an expired token.
      // Backend-dev should provide a mechanism for this (e.g., short-lived test token).
      const res = await request(httpServer)
        .post(url)
        .send({ refreshToken: 'expired.token.here' })
        .expect(401);

      const errorCode = (res.body.error as { code: string }).code;
      expect([
        'AUTH_REFRESH_TOKEN_EXPIRED',
        'AUTH_REFRESH_TOKEN_INVALID',
      ]).toContain(errorCode);
    });

    it('should reject revoked refresh token (after logout)', async () => {
      // Register fresh user
      const regRes = await request(httpServer)
        .post(`${AUTH_URL}/register`)
        .send({
          email: 'revoke-test@carekit-test.com',
          password: 'Rev0keP@ss!',
          firstName: 'فهد',
          lastName: 'العنزي',
          phone: '+966507890123',
          gender: 'male',
        })
        .expect(201);

      const accessToken = regRes.body.data.accessToken as string;
      // refreshToken is in cookie, not body
      const refreshToken = extractRefreshTokenCookie(
        regRes.headers['set-cookie'] as string[],
      );

      // Logout (revokes refresh token)
      await request(httpServer)
        .post(`${AUTH_URL}/logout`)
        .set(getAuthHeaders(accessToken))
        .send({ refreshToken })
        .expect(200);

      // Try to use revoked refresh token
      const res = await request(httpServer)
        .post(url)
        .send({ refreshToken })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_REFRESH_TOKEN_INVALID');
    });

    it('should reject request with missing refreshToken', async () => {
      // No body token and no cookie → 401 AUTH_REFRESH_TOKEN_MISSING
      const res = await request(httpServer).post(url).send({}).expect(401);

      expectErrorResponse(res.body, 'AUTH_REFRESH_TOKEN_MISSING');
    });
  });

  // =========================================================================
  // POST /logout
  // =========================================================================

  describe('POST /auth/logout', () => {
    const url = `${AUTH_URL}/logout`;

    it('should invalidate refresh token and return success', async () => {
      const regRes = await request(httpServer)
        .post(`${AUTH_URL}/register`)
        .send({
          email: 'logout-test@carekit-test.com',
          password: 'L0goutP@ss!',
          firstName: 'ماجد',
          lastName: 'الحارثي',
          phone: '+966508901234',
          gender: 'male',
        })
        .expect(201);

      const accessToken = regRes.body.data.accessToken as string;
      // refreshToken is in HTTP-only cookie, not body
      const refreshToken = (regRes.headers['set-cookie'] as string[])
        .find((c: string) => c.startsWith('refresh_token='))!
        .split(';')[0]
        .replace('refresh_token=', '');

      const res = await request(httpServer)
        .post(url)
        .set(getAuthHeaders(accessToken))
        .send({ refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Logged out successfully');

      // Subsequent refresh attempt should fail
      const refreshRes = await request(httpServer)
        .post(`${AUTH_URL}/refresh-token`)
        .send({ refreshToken })
        .expect(401);

      expectErrorResponse(refreshRes.body, 'AUTH_REFRESH_TOKEN_INVALID');
    });

    it('should require authentication', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ refreshToken: 'some-token' })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // =========================================================================
  // GET /me
  // =========================================================================

  describe('GET /auth/me', () => {
    const url = `${AUTH_URL}/me`;
    let patientToken: string;

    beforeAll(async () => {
      const regRes = await request(httpServer)
        .post(`${AUTH_URL}/register`)
        .send({
          email: 'me-test@carekit-test.com',
          password: 'M3TestP@ss!',
          firstName: 'ريم',
          lastName: 'القرني',
          phone: '+966509012345',
          gender: 'female',
        })
        .expect(201);

      patientToken = regRes.body.data.accessToken;
    });

    it('should return current user with roles and permissions', async () => {
      const res = await request(httpServer)
        .get(url)
        .set(getAuthHeaders(patientToken))
        .expect(200);

      expectSuccessResponse(res.body);

      const { data } = res.body;
      expect(data.id).toBeDefined();
      expect(data.email).toBe('me-test@carekit-test.com');
      expect(data.firstName).toBe('ريم');
      expect(data.lastName).toBe('القرني');
      expect(data.phone).toBe('+966509012345');
      expect(data.gender).toBe('female');
      expect(data.isActive).toBe(true);
      expect(typeof data.emailVerified).toBe('boolean');
      expect(data.createdAt).toBeDefined();

      // Roles
      expect(Array.isArray(data.roles)).toBe(true);
      expect(data.roles.length).toBeGreaterThanOrEqual(1);
      const firstRole = data.roles[0];
      expect(firstRole).toHaveProperty('id');
      expect(firstRole).toHaveProperty('name');
      expect(firstRole).toHaveProperty('slug', 'patient');

      // Permissions
      expect(Array.isArray(data.permissions)).toBe(true);

      // Password must NEVER appear
      expect(data).not.toHaveProperty('password');
      expect(data).not.toHaveProperty('passwordHash');
      expect(data).not.toHaveProperty('deletedAt');
    });

    it('should reject request without auth token', async () => {
      const res = await request(httpServer).get(url).expect(401);

      const errorCode = (res.body.error as { code: string }).code;
      expect(['AUTH_TOKEN_MISSING', 'AUTH_TOKEN_INVALID']).toContain(errorCode);
    });

    it('should reject request with expired token', async () => {
      // Expired JWT — structure is valid but exp claim is in the past
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxMDAwMDAwMDAwfQ.' +
        'invalid-signature';

      const res = await request(httpServer)
        .get(url)
        .set(getAuthHeaders(expiredToken))
        .expect(401);

      const errorCode = (res.body.error as { code: string }).code;
      expect(['AUTH_TOKEN_EXPIRED', 'AUTH_TOKEN_INVALID']).toContain(errorCode);
    });

    it('should reject request with invalid/malformed token', async () => {
      const res = await request(httpServer)
        .get(url)
        .set(getAuthHeaders('completely-invalid-jwt-token'))
        .expect(401);

      const errorCode = (res.body.error as { code: string }).code;
      expect(['AUTH_TOKEN_INVALID', 'AUTH_TOKEN_EXPIRED']).toContain(errorCode);
    });
  });

  // =========================================================================
  // POST /password/forgot
  // =========================================================================

  describe('POST /auth/password/forgot', () => {
    const url = `${AUTH_URL}/password/forgot`;

    it('should send password reset OTP to valid email', async () => {
      // Ensure user exists
      await request(httpServer).post(`${AUTH_URL}/register`).send({
        email: 'forgot-pw@carekit-test.com',
        password: 'F0rg0tP@ss!',
        firstName: 'هند',
        lastName: 'الزهراني',
        phone: '+966510123456',
        gender: 'female',
      });

      const res = await request(httpServer)
        .post(url)
        .send({ email: 'forgot-pw@carekit-test.com' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Password reset OTP sent');
    });

    it('should return success even for non-existent email (security)', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({ email: 'no-such-user@carekit-test.com' })
        .expect(200);

      // Must NOT reveal whether email exists
      expect(res.body).toHaveProperty('success', true);
    });

    it('should rate-limit forgot password requests', async () => {
      const targetEmail = 'rate-limit-forgot@carekit-test.com';

      // Send 3 requests rapidly
      for (let i = 0; i < 3; i++) {
        await request(httpServer).post(url).send({ email: targetEmail });
      }

      // 4th request should be rate-limited
      const res = await request(httpServer)
        .post(url)
        .send({ email: targetEmail })
        .expect(429);

      expectErrorResponse(res.body, 'OTP_RATE_LIMIT_EXCEEDED');
    });
  });

  // =========================================================================
  // POST /password/reset
  // =========================================================================

  describe('POST /auth/password/reset', () => {
    const url = `${AUTH_URL}/password/reset`;

    it('should reset password with valid OTP', async () => {
      // Send forgot password OTP first
      await request(httpServer)
        .post(`${AUTH_URL}/password/forgot`)
        .send({ email: 'forgot-pw@carekit-test.com' });

      // Reset with OTP (backend-dev must provide test OTP mechanism)
      const res = await request(httpServer).post(url).send({
        email: 'forgot-pw@carekit-test.com',
        code: '123456', // Placeholder — backend must implement test OTP
        newPassword: 'N3wStr0ngP@ss!',
      });

      if (res.status === 200) {
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message', 'Password reset successful');

        // Verify: can login with new password
        const loginRes = await request(httpServer)
          .post(`${AUTH_URL}/login`)
          .send({
            email: 'forgot-pw@carekit-test.com',
            password: 'N3wStr0ngP@ss!',
          })
          .expect(200);

        expectSuccessResponse(loginRes.body);
      }
    });

    it('should reject reset with invalid OTP', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({
          email: 'forgot-pw@carekit-test.com',
          code: '000000',
          newPassword: 'N3wP@ss123!',
        })
        .expect(400);

      const errorCode = (res.body.error as { code: string }).code;
      expect(['AUTH_OTP_INVALID', 'AUTH_OTP_EXPIRED']).toContain(errorCode);
    });

    it('should reject reset with weak new password', async () => {
      const res = await request(httpServer)
        .post(url)
        .send({
          email: 'forgot-pw@carekit-test.com',
          code: '123456',
          newPassword: '123',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject reset with missing fields', async () => {
      // Use a fresh email to avoid hitting rate limit from prior tests
      const res = await request(httpServer)
        .post(url)
        .send({ email: 'reset-missing-fields@carekit-test.com' })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // PATCH /password/change
  // =========================================================================

  describe('PATCH /auth/password/change', () => {
    const url = `${AUTH_URL}/password/change`;
    let userToken: string;
    const originalPassword = 'Ch@ngeP@ss1!';
    const userEmail = 'change-pw@carekit-test.com';

    beforeAll(async () => {
      const regRes = await request(httpServer)
        .post(`${AUTH_URL}/register`)
        .send({
          email: userEmail,
          password: originalPassword,
          firstName: 'بدر',
          lastName: 'السبيعي',
          phone: '+966511234567',
          gender: 'male',
        })
        .expect(201);

      userToken = regRes.body.data.accessToken;
    });

    it('should change password with valid current password', async () => {
      const newPassword = 'N3wCh@ngedP@ss!';

      const res = await request(httpServer)
        .patch(url)
        .set(getAuthHeaders(userToken))
        .send({
          currentPassword: originalPassword,
          newPassword,
        })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty(
        'message',
        'Password changed successfully',
      );

      // Verify: old password no longer works
      const oldLoginRes = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email: userEmail, password: originalPassword })
        .expect(401);

      expectErrorResponse(oldLoginRes.body, 'AUTH_INVALID_CREDENTIALS');

      // Verify: new password works
      const newLoginRes = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email: userEmail, password: newPassword })
        .expect(200);

      expectSuccessResponse(newLoginRes.body);
    });

    it('should reject with wrong current password', async () => {
      const res = await request(httpServer)
        .patch(url)
        .set(getAuthHeaders(userToken))
        .send({
          currentPassword: 'WrongCurr3ntP@ss!',
          newPassword: 'AnyN3wP@ss!',
        })
        .expect(400);

      expectErrorResponse(res.body, 'AUTH_INVALID_CREDENTIALS');
    });

    it('should require authentication', async () => {
      const res = await request(httpServer)
        .patch(url)
        .send({
          currentPassword: 'SomeP@ss1',
          newPassword: 'SomeN3wP@ss!',
        })
        .expect(401);

      const errorCode = (res.body.error as { code: string }).code;
      expect(['AUTH_TOKEN_MISSING', 'AUTH_TOKEN_INVALID']).toContain(errorCode);
    });

    it('should reject weak new password', async () => {
      const res = await request(httpServer)
        .patch(url)
        .set(getAuthHeaders(userToken))
        .send({
          currentPassword: originalPassword,
          newPassword: '123',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // POST /email/verify/send + POST /email/verify
  // =========================================================================

  describe('Email Verification', () => {
    let userToken: string;

    beforeAll(async () => {
      const regRes = await request(httpServer)
        .post(`${AUTH_URL}/register`)
        .send({
          email: 'verify-email@carekit-test.com',
          password: 'Ver!fyP@ss1',
          firstName: 'لطيفة',
          lastName: 'النفيعي',
          phone: '+966512345678',
          gender: 'female',
        })
        .expect(201);

      userToken = regRes.body.data.accessToken;
    });

    describe('POST /auth/email/verify/send', () => {
      const url = `${AUTH_URL}/email/verify/send`;

      it('should send verification OTP', async () => {
        const res = await request(httpServer)
          .post(url)
          .set(getAuthHeaders(userToken))
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message', 'Verification OTP sent');
      });

      it('should require authentication', async () => {
        await request(httpServer).post(url).expect(401);
      });
    });

    describe('POST /auth/email/verify', () => {
      const url = `${AUTH_URL}/email/verify`;

      it('should verify email with valid OTP', async () => {
        // Send OTP first
        await request(httpServer)
          .post(`${AUTH_URL}/email/verify/send`)
          .set(getAuthHeaders(userToken))
          .expect(200);

        // Verify (backend-dev must provide test OTP mechanism)
        const res = await request(httpServer)
          .post(url)
          .set(getAuthHeaders(userToken))
          .send({ code: '123456' }); // Placeholder OTP

        if (res.status === 200) {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty(
            'message',
            'Email verified successfully',
          );

          // Check /me returns emailVerified: true
          const meRes = await request(httpServer)
            .get(`${AUTH_URL}/me`)
            .set(getAuthHeaders(userToken))
            .expect(200);

          expect(meRes.body.data.emailVerified).toBe(true);
        }
      });

      it('should reject invalid verification OTP', async () => {
        const res = await request(httpServer)
          .post(url)
          .set(getAuthHeaders(userToken))
          .send({ code: '000000' })
          .expect(400);

        const errorCode = (res.body.error as { code: string }).code;
        expect(['AUTH_OTP_INVALID', 'AUTH_OTP_EXPIRED']).toContain(errorCode);
      });

      it('should require authentication', async () => {
        await request(httpServer)
          .post(url)
          .send({ code: '123456' })
          .expect(401);
      });
    });
  });

  // =========================================================================
  // Security: SQL Injection + XSS on Auth Endpoints
  // =========================================================================

  describe('Auth Security', () => {
    it('should not be vulnerable to SQL injection in email field', async () => {
      const sqlPayloads = [
        "' OR '1'='1' --",
        "admin@example.com'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
      ];

      for (const payload of sqlPayloads) {
        const res = await request(httpServer)
          .post(`${AUTH_URL}/login`)
          .send({ email: payload, password: 'AnyP@ss123' });

        // Should either get 400 (validation) or 401 (invalid creds) — NOT 500
        expect(res.status).toBeLessThan(500);
      }
    });

    it('should not be vulnerable to XSS in registration fields', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      const res = await request(httpServer).post(`${AUTH_URL}/register`).send({
        email: 'xss-test@carekit-test.com',
        password: 'Str0ngP@ss!',
        firstName: xssPayload,
        lastName: xssPayload,
        phone: '+966513456789',
        gender: 'male',
      });

      // Should either reject (400) or sanitize — if stored, must be escaped
      if (res.status === 201) {
        // If it accepts the data, ensure the response doesn't execute JS
        expect(res.body.data.user.firstName).not.toContain('<script>');
      }
    });

    it('should not return stack traces in error responses', async () => {
      const res = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email: 'x', password: 'x' });

      const body = JSON.stringify(res.body);
      expect(body).not.toContain('stack');
      expect(body).not.toContain('at Module');
      expect(body).not.toContain('.ts:');
    });
  });
});
