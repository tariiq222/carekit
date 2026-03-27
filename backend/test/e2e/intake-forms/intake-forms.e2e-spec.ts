/**
 * CareKit — Intake Forms Module E2E Tests
 *
 * GET    /intake-forms                    — intake_forms:view
 * GET    /intake-forms/:formId            — intake_forms:view
 * POST   /intake-forms                    — intake_forms:create
 * PATCH  /intake-forms/:formId            — intake_forms:edit
 * DELETE /intake-forms/:formId            — intake_forms:delete
 * PUT    /intake-forms/:formId/fields     — intake_forms:edit
 * POST   /intake-forms/:formId/responses  — JWT only (patient)
 * GET    /intake-forms/responses/:bookingId — bookings:view
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

const URL = `${API_PREFIX}/intake-forms`;
const FAKE_ID = '00000000-0000-0000-0000-000000000000';

const validForm = {
  nameAr: 'استمارة المريض',
  nameEn: 'Patient Intake Form',
  type: 'pre_booking',
  scope: 'global',
  isActive: true,
};

const validFields = {
  fields: [
    { labelAr: 'العمر', labelEn: 'Age', fieldType: 'number', isRequired: true, sortOrder: 0 },
    { labelAr: 'الأعراض', labelEn: 'Symptoms', fieldType: 'text', isRequired: false, sortOrder: 1 },
  ],
};

describe('Intake Forms Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let accountant: AuthResult;
  let patient: AuthResult;

  let formId: string;
  let deletableFormId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(httpServer, TEST_USERS.super_admin.email, TEST_USERS.super_admin.password);
    receptionist = await createTestUserWithRole(httpServer, superAdmin.accessToken, TEST_USERS.receptionist, 'receptionist');
    accountant = await createTestUserWithRole(httpServer, superAdmin.accessToken, TEST_USERS.accountant, 'accountant');
    patient = await registerTestPatient(httpServer);
  });

  afterAll(async () => { await closeTestApp(testApp.app); });

  // ─── POST /intake-forms ───────────────────────────────────────

  describe('POST /intake-forms', () => {
    it('should create form as super_admin (201)', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(superAdmin.accessToken)).send(validForm).expect(201);
      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('nameEn', validForm.nameEn);
      expect(res.body.data).toHaveProperty('type', validForm.type);
      formId = res.body.data.id as string;
    });

    it('should create deletable form (201)', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ ...validForm, nameEn: 'Form To Delete', nameAr: 'استمارة للحذف' })
        .expect(201);
      deletableFormId = res.body.data.id as string;
    });

    it('should return 403 for receptionist (no intake_forms:create)', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(receptionist.accessToken))
        .send({ ...validForm, nameEn: 'Receptionist Form', nameAr: 'استمارة الاستقبال' })
        .expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(superAdmin.accessToken)).send({}).expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).post(URL).send(validForm).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no intake_forms:create)', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(patient.accessToken)).send(validForm).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 403 for accountant (no intake_forms:create)', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(accountant.accessToken)).send(validForm).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── GET /intake-forms ────────────────────────────────────────

  describe('GET /intake-forms', () => {
    it('should return forms list for super_admin (200)', async () => {
      const res = await request(httpServer)
        .get(URL).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
      const data = res.body.data;
      expect(Array.isArray(data) || Array.isArray(data?.items)).toBe(true);
    });

    it('should return 403 for receptionist (no intake_forms:view)', async () => {
      const res = await request(httpServer)
        .get(URL).set(getAuthHeaders(receptionist.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).get(URL).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no intake_forms:view)', async () => {
      const res = await request(httpServer)
        .get(URL).set(getAuthHeaders(patient.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 403 for accountant (no intake_forms:view)', async () => {
      const res = await request(httpServer)
        .get(URL).set(getAuthHeaders(accountant.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── GET /intake-forms/:formId ────────────────────────────────

  describe('GET /intake-forms/:formId', () => {
    it('should return form by ID (200)', async () => {
      const res = await request(httpServer)
        .get(`${URL}/${formId}`).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id', formId);
      expect(res.body.data).toHaveProperty('type');
    });

    it('should return 404 for non-existent form', async () => {
      const res = await request(httpServer)
        .get(`${URL}/${FAKE_ID}`).set(getAuthHeaders(superAdmin.accessToken)).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).get(`${URL}/${formId}`).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no intake_forms:view)', async () => {
      const res = await request(httpServer)
        .get(`${URL}/${formId}`).set(getAuthHeaders(patient.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── PATCH /intake-forms/:formId ──────────────────────────────

  describe('PATCH /intake-forms/:formId', () => {
    it('should partial-update form as super_admin (200)', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${formId}`).set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Updated Intake Form', isActive: false }).expect(200);
      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('nameEn', 'Updated Intake Form');
    });

    it('should return 403 for receptionist (no intake_forms:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${formId}`).set(getAuthHeaders(receptionist.accessToken))
        .send({ nameAr: 'استمارة المريض المحدثة' }).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 404 for non-existent form', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${FAKE_ID}`).set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Ghost' }).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${formId}`).send({ nameEn: 'Unauthorized' }).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no intake_forms:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${formId}`).set(getAuthHeaders(patient.accessToken))
        .send({ nameEn: 'Hijacked' }).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── PUT /intake-forms/:formId/fields ────────────────────────

  describe('PUT /intake-forms/:formId/fields', () => {
    it('should replace fields as super_admin (200)', async () => {
      const res = await request(httpServer)
        .put(`${URL}/${formId}/fields`).set(getAuthHeaders(superAdmin.accessToken))
        .send(validFields).expect(200);
      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should accept empty fields array (clears all fields) (200)', async () => {
      const res = await request(httpServer)
        .put(`${URL}/${formId}/fields`).set(getAuthHeaders(superAdmin.accessToken))
        .send({ fields: [] }).expect(200);
      expectSuccessResponse(res.body);
    });

    it('should return 403 for receptionist (no intake_forms:edit)', async () => {
      const res = await request(httpServer)
        .put(`${URL}/${formId}/fields`).set(getAuthHeaders(receptionist.accessToken))
        .send(validFields).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 400 for missing fields array', async () => {
      const res = await request(httpServer)
        .put(`${URL}/${formId}/fields`).set(getAuthHeaders(superAdmin.accessToken))
        .send({}).expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 404 for non-existent form', async () => {
      const res = await request(httpServer)
        .put(`${URL}/${FAKE_ID}/fields`).set(getAuthHeaders(superAdmin.accessToken))
        .send(validFields).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer)
        .put(`${URL}/${formId}/fields`).send(validFields).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no intake_forms:edit)', async () => {
      const res = await request(httpServer)
        .put(`${URL}/${formId}/fields`).set(getAuthHeaders(patient.accessToken))
        .send(validFields).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── DELETE /intake-forms/:formId ────────────────────────────

  describe('DELETE /intake-forms/:formId', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).delete(`${URL}/${deletableFormId}`).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no intake_forms:delete)', async () => {
      const res = await request(httpServer)
        .delete(`${URL}/${deletableFormId}`).set(getAuthHeaders(patient.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 403 for accountant (no intake_forms:delete)', async () => {
      const res = await request(httpServer)
        .delete(`${URL}/${deletableFormId}`).set(getAuthHeaders(accountant.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should delete form as super_admin (200)', async () => {
      const res = await request(httpServer)
        .delete(`${URL}/${deletableFormId}`).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
    });

    it('should return 404 for non-existent form', async () => {
      const res = await request(httpServer)
        .delete(`${URL}/${FAKE_ID}`).set(getAuthHeaders(superAdmin.accessToken)).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 404 when deleting already-deleted form', async () => {
      const res = await request(httpServer)
        .delete(`${URL}/${deletableFormId}`).set(getAuthHeaders(superAdmin.accessToken)).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });
});
