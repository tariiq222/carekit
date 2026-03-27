/**
 * CareKit — Clinic Hours & Holidays E2E Tests
 *
 * GET    /clinic/hours          — whitelabel:view
 * PUT    /clinic/hours          — whitelabel:edit
 * GET    /clinic/holidays       — whitelabel:view (optional ?year=)
 * POST   /clinic/holidays       — whitelabel:edit
 * DELETE /clinic/holidays/:id   — whitelabel:edit
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

const HOURS_URL = `${API_PREFIX}/clinic/hours`;
const HOLIDAYS_URL = `${API_PREFIX}/clinic/holidays`;
const FAKE_ID = '00000000-0000-0000-0000-000000000000';

const validHours = {
  hours: [
    { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
    { dayOfWeek: 0, startTime: '10:00', endTime: '14:00', isActive: true },
  ],
};

const validHoliday = {
  date: '2026-12-25',
  nameAr: 'إجازة',
  nameEn: 'Holiday',
  isRecurring: false,
};

describe('Clinic Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let accountant: AuthResult;
  let patient: AuthResult;

  let deletableHolidayId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(httpServer, TEST_USERS.super_admin.email, TEST_USERS.super_admin.password);
    receptionist = await createTestUserWithRole(httpServer, superAdmin.accessToken, TEST_USERS.receptionist, 'receptionist');
    accountant = await createTestUserWithRole(httpServer, superAdmin.accessToken, TEST_USERS.accountant, 'accountant');
    patient = await registerTestPatient(httpServer);
  });

  afterAll(async () => { await closeTestApp(testApp.app); });

  // ─── GET /clinic/hours ────────────────────────────────────────

  describe('GET /clinic/hours', () => {
    it('should return hours array for super_admin (200)', async () => {
      const res = await request(httpServer)
        .get(HOURS_URL).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 403 for receptionist (no whitelabel:view)', async () => {
      const res = await request(httpServer)
        .get(HOURS_URL).set(getAuthHeaders(receptionist.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).get(HOURS_URL).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no whitelabel:view)', async () => {
      const res = await request(httpServer)
        .get(HOURS_URL).set(getAuthHeaders(patient.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 403 for accountant (no whitelabel:view)', async () => {
      const res = await request(httpServer)
        .get(HOURS_URL).set(getAuthHeaders(accountant.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── PUT /clinic/hours ────────────────────────────────────────

  describe('PUT /clinic/hours', () => {
    it('should replace clinic hours as super_admin (200)', async () => {
      const res = await request(httpServer)
        .put(HOURS_URL).set(getAuthHeaders(superAdmin.accessToken)).send(validHours).expect(200);
      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 400 for invalid hours (startTime >= endTime)', async () => {
      const res = await request(httpServer)
        .put(HOURS_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ hours: [{ dayOfWeek: 1, startTime: '17:00', endTime: '09:00', isActive: true }] })
        .expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 400 for missing hours array', async () => {
      const res = await request(httpServer)
        .put(HOURS_URL).set(getAuthHeaders(superAdmin.accessToken)).send({}).expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).put(HOURS_URL).send(validHours).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no whitelabel:edit)', async () => {
      const res = await request(httpServer)
        .put(HOURS_URL).set(getAuthHeaders(patient.accessToken)).send(validHours).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 403 for accountant (no whitelabel:edit)', async () => {
      const res = await request(httpServer)
        .put(HOURS_URL).set(getAuthHeaders(accountant.accessToken)).send(validHours).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── GET /clinic/holidays ─────────────────────────────────────

  describe('GET /clinic/holidays', () => {
    it('should return holidays array for super_admin (200)', async () => {
      const res = await request(httpServer)
        .get(HOLIDAYS_URL).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return holidays filtered by year (200)', async () => {
      const res = await request(httpServer)
        .get(HOLIDAYS_URL).query({ year: 2026 }).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).get(HOLIDAYS_URL).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no whitelabel:view)', async () => {
      const res = await request(httpServer)
        .get(HOLIDAYS_URL).set(getAuthHeaders(patient.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── POST /clinic/holidays ────────────────────────────────────

  describe('POST /clinic/holidays', () => {
    it('should create a holiday as super_admin (201)', async () => {
      const res = await request(httpServer)
        .post(HOLIDAYS_URL).set(getAuthHeaders(superAdmin.accessToken)).send(validHoliday).expect(201);
      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('nameEn', validHoliday.nameEn);
      expect(res.body.data).toHaveProperty('nameAr', validHoliday.nameAr);
    });

    it('should create a deletable holiday for delete tests (201)', async () => {
      const res = await request(httpServer)
        .post(HOLIDAYS_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ ...validHoliday, date: '2026-11-11', nameEn: 'Holiday To Delete', nameAr: 'إجازة للحذف' })
        .expect(201);
      deletableHolidayId = res.body.data.id as string;
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(httpServer)
        .post(HOLIDAYS_URL).set(getAuthHeaders(superAdmin.accessToken)).send({}).expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).post(HOLIDAYS_URL).send(validHoliday).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no whitelabel:edit)', async () => {
      const res = await request(httpServer)
        .post(HOLIDAYS_URL).set(getAuthHeaders(patient.accessToken)).send(validHoliday).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 403 for accountant (no whitelabel:edit)', async () => {
      const res = await request(httpServer)
        .post(HOLIDAYS_URL).set(getAuthHeaders(accountant.accessToken)).send(validHoliday).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── DELETE /clinic/holidays/:id ──────────────────────────────

  describe('DELETE /clinic/holidays/:id', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).delete(`${HOLIDAYS_URL}/${deletableHolidayId}`).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no whitelabel:edit)', async () => {
      const res = await request(httpServer)
        .delete(`${HOLIDAYS_URL}/${deletableHolidayId}`).set(getAuthHeaders(patient.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should delete holiday as super_admin (200)', async () => {
      const res = await request(httpServer)
        .delete(`${HOLIDAYS_URL}/${deletableHolidayId}`).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
    });

    it('should return 404 for non-existent holiday', async () => {
      const res = await request(httpServer)
        .delete(`${HOLIDAYS_URL}/${FAKE_ID}`).set(getAuthHeaders(superAdmin.accessToken)).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 404 when deleting already-deleted holiday', async () => {
      const res = await request(httpServer)
        .delete(`${HOLIDAYS_URL}/${deletableHolidayId}`).set(getAuthHeaders(superAdmin.accessToken)).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });
});
