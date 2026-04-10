/**
 * Auth DB Assertions E2E Tests
 *
 * Verifies that write operations are actually persisted in the database,
 * not just inferred from a successful HTTP response.
 *
 *   AU-FP3-DB: passwordHash changes in DB after password reset
 *   AU-CP1-DB: all refreshToken rows deleted from DB after password change
 */

import request from 'supertest';
import { PrismaService } from '../../../src/database/prisma.service.js';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  getAuthHeaders,
  type TestApp,
} from '../setup/setup.js';
import { registerFresh, getLatestOtp } from './auth-test-helpers.js';

const AUTH_URL = `${API_PREFIX}/auth`;

describe('Auth DB Assertions (e2e)', () => {
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
  // AU-FP3-DB — passwordHash changes in DB after reset
  // =========================================================================

  describe('AU-FP3-DB: passwordHash changes in DB after password reset', () => {
    it('should store a new passwordHash (different from original) in DB', async () => {
      const { email, userId } = await registerFresh(httpServer, 'fp3-db');

      // Capture hash before reset
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { passwordHash: true },
      });

      // Trigger OTP
      await request(httpServer)
        .post(`${AUTH_URL}/password/forgot`)
        .send({ email })
        .expect(200);

      const code = await getLatestOtp(prisma, userId, 'reset_password');

      // Perform reset
      await request(httpServer)
        .post(`${AUTH_URL}/password/reset`)
        .send({ email, code, newPassword: 'N3wHash@DbTest1' })
        .expect(200);

      // Verify DB
      const after = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { passwordHash: true },
      });

      expect(after.passwordHash).not.toBe(before.passwordHash);
      expect(after.passwordHash).not.toBe('N3wHash@DbTest1'); // never plaintext
      expect(after.passwordHash.length).toBeGreaterThan(20);
    });

    it('should not accept the old password after DB hash is changed', async () => {
      const { email, password, userId } = await registerFresh(
        httpServer,
        'fp3-db-old',
      );

      await request(httpServer)
        .post(`${AUTH_URL}/password/forgot`)
        .send({ email })
        .expect(200);

      const code = await getLatestOtp(prisma, userId, 'reset_password');

      await request(httpServer)
        .post(`${AUTH_URL}/password/reset`)
        .send({ email, code, newPassword: 'Totally$New9Pass' })
        .expect(200);

      // Old password must be rejected at DB level
      await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email, password })
        .expect(401);
    });
  });

  // =========================================================================
  // AU-CP1-DB — all refreshToken DB rows deleted after password change
  // =========================================================================

  describe('AU-CP1-DB: all refreshToken rows deleted from DB after password change', () => {
    it('should delete ALL refreshToken rows for the user', async () => {
      const { email, password, accessToken, userId } = await registerFresh(
        httpServer,
        'cp1-db',
      );

      // Create a second session by logging in again
      await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email, password })
        .expect(200);

      // At least 2 refresh token rows must exist before change
      const countBefore = await prisma.refreshToken.count({
        where: { userId },
      });
      expect(countBefore).toBeGreaterThanOrEqual(2);

      // Change password
      await request(httpServer)
        .patch(`${AUTH_URL}/password/change`)
        .set(getAuthHeaders(accessToken))
        .send({ currentPassword: password, newPassword: 'N3wDb@Change1' })
        .expect(200);

      // All rows gone
      const countAfter = await prisma.refreshToken.count({ where: { userId } });
      expect(countAfter).toBe(0);
    });

    it('should delete ALL refreshToken rows after password reset too', async () => {
      const { email, password, userId } = await registerFresh(
        httpServer,
        'cp1-db-reset',
      );

      // Create two sessions
      await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email, password })
        .expect(200);

      const countBefore = await prisma.refreshToken.count({
        where: { userId },
      });
      expect(countBefore).toBeGreaterThanOrEqual(2);

      // Reset password via OTP
      await request(httpServer)
        .post(`${AUTH_URL}/password/forgot`)
        .send({ email })
        .expect(200);

      const code = await getLatestOtp(prisma, userId, 'reset_password');

      await request(httpServer)
        .post(`${AUTH_URL}/password/reset`)
        .send({ email, code, newPassword: 'N3wReset@Db9' })
        .expect(200);

      const countAfter = await prisma.refreshToken.count({ where: { userId } });
      expect(countAfter).toBe(0);
    });
  });
});
