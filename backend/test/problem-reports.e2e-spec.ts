/**
 * CareKit — Problem Reports Module E2E Tests
 *
 * Endpoints:
 *   POST   /problem-reports              — JWT only (patient with completed booking)
 *   GET    /problem-reports              — requires reports:view
 *   GET    /problem-reports/:id          — requires reports:view
 *   PATCH  /problem-reports/:id/resolve  — requires reports:edit
 *
 * Note: POST requires a completed booking. Tests validate the 404 path
 * (non-existent bookingId) to cover validation without real booking setup.
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  createTestUserWithRole,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from './setup';

const REPORTS_URL = `${API_PREFIX}/problem-reports`;
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

describe('Problem Reports Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let accountant: AuthResult;
  let patient: AuthResult;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    accountant = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.accountant,
      'accountant',
    );

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ─────────────────────────────────────────────────────────────
  // GET /problem-reports — List
  // ─────────────────────────────────────────────────────────────

  describe('GET /problem-reports', () => {
    it('should return 200 with paginated list for super_admin', async () => {
      const res = await request(httpServer)
        .get(REPORTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .get(REPORTS_URL)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no reports:view permission)', async () => {
      const res = await request(httpServer)
        .get(REPORTS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should support ?status=open filter', async () => {
      const res = await request(httpServer)
        .get(REPORTS_URL)
        .query({ status: 'open' })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items = res.body.data.items as Array<{ status?: string }>;
      for (const item of items) {
        if (item.status !== undefined) {
          expect(item.status).toBe('open');
        }
      }
    });

    it('should support ?page=1 pagination', async () => {
      const res = await request(httpServer)
        .get(REPORTS_URL)
        .query({ page: 1 })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.meta).toHaveProperty('page', 1);
    });

    it('should return valid meta shape', async () => {
      const res = await request(httpServer)
        .get(REPORTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const { meta } = res.body.data;
      expect(typeof meta.page).toBe('number');
      expect(typeof meta.perPage).toBe('number');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /problem-reports/:id — Single Report
  // ─────────────────────────────────────────────────────────────

  describe('GET /problem-reports/:id', () => {
    it('should return 404 for non-existent report UUID', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/${FAKE_UUID}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/${FAKE_UUID}`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no reports:view permission)', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/${FAKE_UUID}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /problem-reports — Submit Report
  // ─────────────────────────────────────────────────────────────

  describe('POST /problem-reports', () => {
    it('should return 404 when bookingId does not exist', async () => {
      const res = await request(httpServer)
        .post(REPORTS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          bookingId: FAKE_UUID,
          type: 'billing',
          description: 'Test problem',
        })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .post(REPORTS_URL)
        .send({
          bookingId: FAKE_UUID,
          type: 'billing',
          description: 'Test problem',
        })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /problem-reports/:id/resolve — Resolve Report
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /problem-reports/:id/resolve', () => {
    it('should return 404 for non-existent report', async () => {
      const res = await request(httpServer)
        .patch(`${REPORTS_URL}/${FAKE_UUID}/resolve`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ status: 'resolved', adminNotes: 'Issue addressed' })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .patch(`${REPORTS_URL}/${FAKE_UUID}/resolve`)
        .send({ status: 'resolved' })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no reports:edit permission)', async () => {
      const res = await request(httpServer)
        .patch(`${REPORTS_URL}/${FAKE_UUID}/resolve`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ status: 'resolved' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 404 for accountant (has reports:edit, report not found)', async () => {
      const res = await request(httpServer)
        .patch(`${REPORTS_URL}/${FAKE_UUID}/resolve`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ status: 'dismissed' })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });
});
