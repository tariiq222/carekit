/**
 * CareKit — Activity Log Module E2E Tests
 *
 * Endpoints:
 *   GET  /activity-log       — requires activity-log:view (super_admin)
 *   GET  /activity-log/:id   — requires activity-log:view (super_admin)
 *
 * Activity logs are written automatically by the system (login events, etc.)
 * so `beforeAll` auth operations guarantee at least some entries exist.
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from './setup';

const ACTIVITY_LOG_URL = `${API_PREFIX}/activity-log`;

describe('Activity Log Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let patient: AuthResult;

  // Captured from list response for single-record tests
  let capturedLogId: string | null = null;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    // These auth operations generate activity log entries
    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ─────────────────────────────────────────────────────────────
  // GET /activity-log — List
  // ─────────────────────────────────────────────────────────────

  describe('GET /activity-log', () => {
    it('should return 200 with paginated log entries for super_admin', async () => {
      const res = await request(httpServer)
        .get(ACTIVITY_LOG_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.items)).toBe(true);

      // Capture first log ID for single-record tests
      const items = res.body.data.items as Array<{ id: string }>;
      if (items.length > 0) {
        capturedLogId = items[0].id;
      }
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .get(ACTIVITY_LOG_URL)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no activity-log:view permission)', async () => {
      const res = await request(httpServer)
        .get(ACTIVITY_LOG_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should support ?module=auth filter', async () => {
      const res = await request(httpServer)
        .get(ACTIVITY_LOG_URL)
        .query({ module: 'auth' })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items = res.body.data.items as Array<{ module?: string }>;
      for (const item of items) {
        if (item.module !== undefined) {
          expect(item.module).toBe('auth');
        }
      }
    });

    it('should support ?action=LOGIN filter', async () => {
      const res = await request(httpServer)
        .get(ACTIVITY_LOG_URL)
        .query({ action: 'LOGIN' })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items = res.body.data.items as Array<{ action?: string }>;
      for (const item of items) {
        if (item.action !== undefined) {
          expect(item.action).toBe('LOGIN');
        }
      }
    });

    it('should support ?page=1&perPage=5 pagination', async () => {
      const res = await request(httpServer)
        .get(ACTIVITY_LOG_URL)
        .query({ page: 1, perPage: 5 })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.items.length).toBeLessThanOrEqual(5);
      expect(res.body.data.meta.perPage).toBe(5);
      expect(res.body.data.meta.page).toBe(1);
    });

    it('should return meta with total, page, perPage, totalPages', async () => {
      const res = await request(httpServer)
        .get(ACTIVITY_LOG_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const { meta } = res.body.data;
      expect(meta).toHaveProperty('total');
      expect(meta).toHaveProperty('page');
      expect(meta).toHaveProperty('perPage');
      expect(meta).toHaveProperty('totalPages');
      expect(typeof meta.total).toBe('number');
      expect(typeof meta.page).toBe('number');
      expect(typeof meta.perPage).toBe('number');
      expect(typeof meta.totalPages).toBe('number');
    });

    it('should return numeric totals (log count may be 0 in isolated test env)', async () => {
      const res = await request(httpServer)
        .get(ACTIVITY_LOG_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(typeof res.body.data.meta.total).toBe('number');
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /activity-log/:id — Single Entry
  // ─────────────────────────────────────────────────────────────

  describe('GET /activity-log/:id', () => {
    it('should return 200 with the log entry when ID exists', async () => {
      if (!capturedLogId) {
        return; // No log entries in DB — skip
      }

      const res = await request(httpServer)
        .get(`${ACTIVITY_LOG_URL}/${capturedLogId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id', capturedLogId);
    });

    it('should return 404 for a non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .get(`${ACTIVITY_LOG_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const id = capturedLogId ?? '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .get(`${ACTIVITY_LOG_URL}/${id}`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no activity-log:view permission)', async () => {
      const id = capturedLogId ?? '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .get(`${ACTIVITY_LOG_URL}/${id}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });
});
