/**
 * CareKit — Whitelabel Module E2E Tests (Part 1)
 *
 * GET  /whitelabel/public      — PUBLIC (no auth)
 * GET  /whitelabel/config      — whitelabel:view
 * GET  /whitelabel/config/map  — whitelabel:view
 * PUT  /whitelabel/config      — whitelabel:edit
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
const PUBLIC_URL = `${BASE_URL}/public`;
const CONFIG_URL = `${BASE_URL}/config`;
const CONFIG_MAP_URL = `${BASE_URL}/config/map`;

describe('Whitelabel Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let patient: AuthResult;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );
    receptionist = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.receptionist,
      'receptionist',
    );
    patient = await registerTestPatient(httpServer);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ─── GET /whitelabel/public ──────────────────────────────────────

  describe('GET /whitelabel/public', () => {
    it('should return branding data without auth (200)', async () => {
      const res = await request(httpServer).get(PUBLIC_URL).expect(200);

      expectSuccessResponse(res.body);
      expect(typeof res.body.data).toBe('object');
    });

    it('should also work with auth token present', async () => {
      const res = await request(httpServer)
        .get(PUBLIC_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });
  });

  // ─── GET /whitelabel/config ──────────────────────────────────────

  describe('GET /whitelabel/config', () => {
    it('should return config entries for super_admin (200)', async () => {
      const res = await request(httpServer)
        .get(CONFIG_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const res = await request(httpServer).get(CONFIG_URL).expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no whitelabel:view)', async () => {
      const res = await request(httpServer)
        .get(CONFIG_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 403 for receptionist (no whitelabel:view)', async () => {
      const res = await request(httpServer)
        .get(CONFIG_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── GET /whitelabel/config/map ─────────────────────────────────

  describe('GET /whitelabel/config/map', () => {
    it('should return a flat key-value map for super_admin (200)', async () => {
      const res = await request(httpServer)
        .get(CONFIG_MAP_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(typeof res.body.data).toBe('object');
      expect(Array.isArray(res.body.data)).toBe(false);
    });

    it('should return 401 without auth', async () => {
      const res = await request(httpServer).get(CONFIG_MAP_URL).expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient', async () => {
      const res = await request(httpServer)
        .get(CONFIG_MAP_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── PUT /whitelabel/config ──────────────────────────────────────

  describe('PUT /whitelabel/config', () => {
    const validConfig = {
      configs: [
        { key: 'e2e_test_key', value: 'e2e_test_value', type: 'string' },
      ],
    };

    it('should upsert config entries for super_admin (200)', async () => {
      const res = await request(httpServer)
        .put(CONFIG_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validConfig)
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should update an existing key', async () => {
      const updated = {
        configs: [{ key: 'e2e_test_key', value: 'updated_value' }],
      };

      const res = await request(httpServer)
        .put(CONFIG_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(updated)
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 400 for empty configs array', async () => {
      const res = await request(httpServer)
        .put(CONFIG_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ configs: [] })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 400 for missing key field', async () => {
      const res = await request(httpServer)
        .put(CONFIG_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ configs: [{ value: 'no_key' }] })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 400 for missing value field', async () => {
      const res = await request(httpServer)
        .put(CONFIG_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ configs: [{ key: 'no_value' }] })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 403 for patient (no whitelabel:edit)', async () => {
      const res = await request(httpServer)
        .put(CONFIG_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send(validConfig)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 401 without auth', async () => {
      const res = await request(httpServer)
        .put(CONFIG_URL)
        .send(validConfig)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });
});
