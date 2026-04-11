/**
 * CareKit — Whitelabel Module E2E Tests (Part 2)
 *
 * GET    /whitelabel/config/:key — whitelabel:view
 * DELETE /whitelabel/config/:key — whitelabel:edit
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  createTestUserWithRole,
  registerTestPatient,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const BASE_URL = `${API_PREFIX}/whitelabel`;
const CONFIG_URL = `${BASE_URL}/config`;

const TEST_KEY = 'e2e_key_test';

describe('Whitelabel Keys (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let patient: AuthResult;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );
    patient = await registerTestPatient(httpServer);

    // Seed a test config key for reads and deletes
    await request(httpServer)
      .put(CONFIG_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ configs: [{ key: TEST_KEY, value: 'test_value' }] });
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ─── GET /whitelabel/config/:key ────────────────────────────────

  describe('GET /whitelabel/config/:key', () => {
    it('should return config entry by key for super_admin (200)', async () => {
      const res = await request(httpServer)
        .get(`${CONFIG_URL}/${TEST_KEY}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('key', TEST_KEY);
      expect(res.body.data).toHaveProperty('value');
    });

    it('should return 404 for non-existent key', async () => {
      const res = await request(httpServer)
        .get(`${CONFIG_URL}/non_existent_key_xyz`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without auth', async () => {
      const res = await request(httpServer)
        .get(`${CONFIG_URL}/${TEST_KEY}`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no whitelabel:view)', async () => {
      const res = await request(httpServer)
        .get(`${CONFIG_URL}/${TEST_KEY}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── DELETE /whitelabel/config/:key ─────────────────────────────

  describe('DELETE /whitelabel/config/:key', () => {
    const DELETABLE_KEY = 'e2e_deletable_key';

    beforeEach(async () => {
      // Re-create the key before each delete test
      await request(httpServer)
        .put(CONFIG_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ configs: [{ key: DELETABLE_KEY, value: 'to_delete' }] });
    });

    it('should return 403 for patient (no whitelabel:edit)', async () => {
      const res = await request(httpServer)
        .delete(`${CONFIG_URL}/${DELETABLE_KEY}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 401 without auth', async () => {
      const res = await request(httpServer)
        .delete(`${CONFIG_URL}/${DELETABLE_KEY}`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should delete config entry for super_admin (200)', async () => {
      const res = await request(httpServer)
        .delete(`${CONFIG_URL}/${DELETABLE_KEY}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 404 after deleting the key', async () => {
      await request(httpServer)
        .delete(`${CONFIG_URL}/${DELETABLE_KEY}`)
        .set(getAuthHeaders(superAdmin.accessToken));

      const res = await request(httpServer)
        .get(`${CONFIG_URL}/${DELETABLE_KEY}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 404 for non-existent key', async () => {
      const res = await request(httpServer)
        .delete(`${CONFIG_URL}/does_not_exist_xyz`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });
});
