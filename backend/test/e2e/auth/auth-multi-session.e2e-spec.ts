/**
 * Auth Multi-Session Invalidation E2E Tests
 *
 * Verifies that password change/reset invalidates ALL active sessions,
 * not just the current one.
 *
 *   AU-CP1-MULTI: both device sessions rejected after password change
 *   AU-CP1-MULTI-RESET: both sessions rejected after password reset
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  getAuthHeaders,
  expectErrorResponse,
  type TestApp,
} from '../setup/setup.js';
import {
  registerFresh,
  extractCookieToken,
  getLatestOtp,
} from './auth-test-helpers.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const AUTH_URL = `${API_PREFIX}/auth`;

describe('Auth Multi-Session Invalidation (e2e)', () => {
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
  // AU-CP1-MULTI — password change invalidates BOTH sessions
  // =========================================================================

  describe('AU-CP1-MULTI: Password change invalidates all active sessions', () => {
    it('should reject BOTH refreshTokens (device 1 and device 2) after password change', async () => {
      const { email, password, accessToken, refreshToken: token1 } =
        await registerFresh(httpServer, 'multi-cp1');

      // Second session — login from "device 2"
      const loginRes = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email, password })
        .expect(200);
      const token2 = extractCookieToken(loginRes.headers['set-cookie'] as string[]);

      // Sanity: token2 is a different value than token1
      expect(token2).not.toBe(token1);

      // Change password using device 1's access token
      await request(httpServer)
        .patch(`${AUTH_URL}/password/change`)
        .set(getAuthHeaders(accessToken))
        .send({ currentPassword: password, newPassword: 'Multi$Changed1' })
        .expect(200);

      // token1 (device 1) must be invalid
      const res1 = await request(httpServer)
        .post(`${AUTH_URL}/refresh-token`)
        .send({ refreshToken: token1 })
        .expect(401);
      expectErrorResponse(res1.body, 'AUTH_REFRESH_TOKEN_INVALID');

      // token2 (device 2) must also be invalid
      const res2 = await request(httpServer)
        .post(`${AUTH_URL}/refresh-token`)
        .send({ refreshToken: token2 })
        .expect(401);
      expectErrorResponse(res2.body, 'AUTH_REFRESH_TOKEN_INVALID');
    });

    it('should allow login with the new password after invalidating all sessions', async () => {
      const { email, password, accessToken } =
        await registerFresh(httpServer, 'multi-cp1-newlogin');

      await request(httpServer)
        .patch(`${AUTH_URL}/password/change`)
        .set(getAuthHeaders(accessToken))
        .send({ currentPassword: password, newPassword: 'Multi$NewLogin1' })
        .expect(200);

      const res = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email, password: 'Multi$NewLogin1' })
        .expect(200);

      expect(typeof res.body.data.accessToken).toBe('string');
    });
  });

  // =========================================================================
  // AU-CP1-MULTI-RESET — password RESET invalidates BOTH sessions
  // =========================================================================

  describe('AU-CP1-MULTI-RESET: Password reset invalidates all active sessions', () => {
    it('should reject BOTH refreshTokens after password reset via OTP', async () => {
      const { email, password, refreshToken: token1, userId } =
        await registerFresh(httpServer, 'multi-reset');

      // Second session
      const loginRes = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email, password })
        .expect(200);
      const token2 = extractCookieToken(loginRes.headers['set-cookie'] as string[]);

      // Trigger password reset OTP
      await request(httpServer)
        .post(`${AUTH_URL}/password/forgot`)
        .send({ email })
        .expect(200);

      const code = await getLatestOtp(prisma, userId, 'reset_password');

      await request(httpServer)
        .post(`${AUTH_URL}/password/reset`)
        .send({ email, code, newPassword: 'Multi$Reset9Pass' })
        .expect(200);

      // Both tokens must be rejected
      const res1 = await request(httpServer)
        .post(`${AUTH_URL}/refresh-token`)
        .send({ refreshToken: token1 })
        .expect(401);
      expectErrorResponse(res1.body, 'AUTH_REFRESH_TOKEN_INVALID');

      const res2 = await request(httpServer)
        .post(`${AUTH_URL}/refresh-token`)
        .send({ refreshToken: token2 })
        .expect(401);
      expectErrorResponse(res2.body, 'AUTH_REFRESH_TOKEN_INVALID');
    });
  });
});
