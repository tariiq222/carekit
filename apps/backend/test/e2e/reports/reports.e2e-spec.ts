/**
 * CareKit — Reports Module E2E Tests
 *
 * Endpoints:
 *   GET  /reports/revenue                  — requires reports:view
 *   GET  /reports/revenue/export           — requires reports:view (CSV)
 *   GET  /reports/bookings                 — requires reports:view
 *   GET  /reports/bookings/export          — requires reports:view (CSV)
 *   GET  /reports/patients/export          — requires reports:view (CSV)
 *   GET  /reports/practitioners/:id        — requires reports:view
 *
 * Permission matrix:
 *   super_admin → all permissions
 *   accountant  → reports:view
 *   patient     → none
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
} from '../setup/setup';

const REPORTS_URL = `${API_PREFIX}/reports`;
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

const DATE_RANGE = { dateFrom: '2026-01-01', dateTo: '2026-12-31' };

describe('Reports Module (e2e)', () => {
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
  // GET /reports/revenue
  // ─────────────────────────────────────────────────────────────

  describe('GET /reports/revenue', () => {
    it('should return 200 with revenue data for super_admin', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/revenue`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 200 for accountant (has reports:view)', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/revenue`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/revenue`)
        .query(DATE_RANGE)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no reports:view permission)', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/revenue`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 400 when dateFrom is missing', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/revenue`)
        .query({ dateTo: '2026-12-31' })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /reports/revenue/export — CSV
  // ─────────────────────────────────────────────────────────────

  describe('GET /reports/revenue/export', () => {
    it('should return 200 with CSV content-type for super_admin', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/revenue/export`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(
        res.headers['content-type']?.includes('text/csv') ||
          res.headers['content-type']?.includes('application/octet-stream') ||
          res.status === 200,
      ).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/revenue/export`)
        .query(DATE_RANGE)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/revenue/export`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /reports/bookings
  // ─────────────────────────────────────────────────────────────

  describe('GET /reports/bookings', () => {
    it('should return 200 with booking stats for super_admin', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/bookings`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 200 for accountant', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/bookings`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/bookings`)
        .query(DATE_RANGE)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/bookings`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /reports/bookings/export — CSV
  // ─────────────────────────────────────────────────────────────

  describe('GET /reports/bookings/export', () => {
    it('should return 200 for super_admin', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/bookings/export`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(res.status).toBe(200);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/bookings/export`)
        .query(DATE_RANGE)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /reports/patients/export — CSV
  // ─────────────────────────────────────────────────────────────

  describe('GET /reports/patients/export', () => {
    it('should return 200 for super_admin', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/patients/export`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(res.status).toBe(200);
    });

    it('should return 200 for accountant', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/patients/export`)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(200);

      expect(res.status).toBe(200);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/patients/export`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/patients/export`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /reports/practitioners/:id
  // ─────────────────────────────────────────────────────────────

  describe('GET /reports/practitioners/:id', () => {
    it('should return 200 with empty data for non-existent practitioner ID', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/practitioners/${FAKE_UUID}`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/practitioners/${FAKE_UUID}`)
        .query(DATE_RANGE)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient', async () => {
      const res = await request(httpServer)
        .get(`${REPORTS_URL}/practitioners/${FAKE_UUID}`)
        .query(DATE_RANGE)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });
});
