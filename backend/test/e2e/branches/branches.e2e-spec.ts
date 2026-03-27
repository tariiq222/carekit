/**
 * CareKit — Branches Module E2E Tests
 *
 * GET    /branches                        — branches:view
 * GET    /branches/:id                    — branches:view
 * POST   /branches                        — branches:create
 * PATCH  /branches/:id                    — branches:edit
 * DELETE /branches/:id                    — branches:delete
 * GET    /branches/:id/practitioners      — branches:view
 * PATCH  /branches/:id/practitioners      — branches:edit
 * DELETE /branches/:id/practitioners/:pid — branches:edit
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

const URL = `${API_PREFIX}/branches`;
const FAKE_ID = '00000000-0000-0000-0000-000000000000';

const validBranch = {
  nameAr: 'فرع الرياض',
  nameEn: 'Riyadh Branch',
  address: 'King Fahad Road',
  phone: '+966501234567',
  isMain: false,
  isActive: true,
};

describe('Branches Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let accountant: AuthResult;
  let patient: AuthResult;

  let branchId: string;
  let deletableBranchId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(httpServer, TEST_USERS.super_admin.email, TEST_USERS.super_admin.password);
    receptionist = await createTestUserWithRole(httpServer, superAdmin.accessToken, TEST_USERS.receptionist, 'receptionist');
    accountant = await createTestUserWithRole(httpServer, superAdmin.accessToken, TEST_USERS.accountant, 'accountant');
    patient = await registerTestPatient(httpServer);
  });

  afterAll(async () => { await closeTestApp(testApp.app); });

  // ─── POST /branches ───────────────────────────────────────────

  describe('POST /branches', () => {
    it('should create branch as super_admin (201)', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(superAdmin.accessToken)).send(validBranch).expect(201);
      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('nameEn', validBranch.nameEn);
      branchId = res.body.data.id as string;
    });

    it('should create deletable branch (201)', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ ...validBranch, nameEn: 'Branch To Delete', nameAr: 'فرع للحذف', phone: '+966501234568' })
        .expect(201);
      deletableBranchId = res.body.data.id as string;
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(superAdmin.accessToken)).send({}).expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).post(URL).send(validBranch).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no branches:create)', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(patient.accessToken)).send(validBranch).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 403 for accountant (no branches:create)', async () => {
      const res = await request(httpServer)
        .post(URL).set(getAuthHeaders(accountant.accessToken)).send(validBranch).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── GET /branches ────────────────────────────────────────────

  describe('GET /branches', () => {
    it('should return branches list for super_admin (200)', async () => {
      const res = await request(httpServer)
        .get(URL).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
      const data = res.body.data;
      expect(Array.isArray(data) || Array.isArray(data?.items)).toBe(true);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).get(URL).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no branches:view)', async () => {
      const res = await request(httpServer)
        .get(URL).set(getAuthHeaders(patient.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── GET /branches/:id ────────────────────────────────────────

  describe('GET /branches/:id', () => {
    it('should return branch by ID (200)', async () => {
      const res = await request(httpServer)
        .get(`${URL}/${branchId}`).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id', branchId);
    });

    it('should return 404 for non-existent branch', async () => {
      const res = await request(httpServer)
        .get(`${URL}/${FAKE_ID}`).set(getAuthHeaders(superAdmin.accessToken)).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).get(`${URL}/${branchId}`).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no branches:view)', async () => {
      const res = await request(httpServer)
        .get(`${URL}/${branchId}`).set(getAuthHeaders(patient.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── PATCH /branches/:id ──────────────────────────────────────

  describe('PATCH /branches/:id', () => {
    it('should update branch as super_admin (200)', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${branchId}`).set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Riyadh Branch Updated', address: 'Olaya Street' }).expect(200);
      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('nameEn', 'Riyadh Branch Updated');
    });

    it('should return 403 for receptionist (no branches:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${branchId}`).set(getAuthHeaders(receptionist.accessToken))
        .send({ nameAr: 'فرع الرياض المحدث' }).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 404 for non-existent branch', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${FAKE_ID}`).set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Ghost' }).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${branchId}`).send({ nameEn: 'Unauthorized' }).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no branches:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${branchId}`).set(getAuthHeaders(patient.accessToken))
        .send({ nameEn: 'Hijacked' }).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── GET /branches/:id/practitioners ─────────────────────────

  describe('GET /branches/:id/practitioners', () => {
    it('should return practitioners list for branch (200)', async () => {
      const res = await request(httpServer)
        .get(`${URL}/${branchId}/practitioners`).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
      const data = res.body.data;
      expect(Array.isArray(data) || Array.isArray(data?.items)).toBe(true);
    });

    it('should return 404 for non-existent branch', async () => {
      const res = await request(httpServer)
        .get(`${URL}/${FAKE_ID}/practitioners`).set(getAuthHeaders(superAdmin.accessToken)).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).get(`${URL}/${branchId}/practitioners`).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ─── PATCH /branches/:id/practitioners ───────────────────────

  describe('PATCH /branches/:id/practitioners', () => {
    it('should return 400 for empty practitioner list (min 1 required)', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${branchId}/practitioners`).set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerIds: [] }).expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${branchId}/practitioners`).send({ practitionerIds: [] }).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no branches:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${URL}/${branchId}/practitioners`).set(getAuthHeaders(patient.accessToken))
        .send({ practitionerIds: [] }).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── DELETE /branches/:id ─────────────────────────────────────

  describe('DELETE /branches/:id', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(httpServer).delete(`${URL}/${deletableBranchId}`).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no branches:delete)', async () => {
      const res = await request(httpServer)
        .delete(`${URL}/${deletableBranchId}`).set(getAuthHeaders(patient.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 403 for receptionist (no branches:delete)', async () => {
      const res = await request(httpServer)
        .delete(`${URL}/${deletableBranchId}`).set(getAuthHeaders(receptionist.accessToken)).expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should soft-delete branch as super_admin (200)', async () => {
      const res = await request(httpServer)
        .delete(`${URL}/${deletableBranchId}`).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
      expectSuccessResponse(res.body);
    });

    it('should return 404 for non-existent branch', async () => {
      const res = await request(httpServer)
        .delete(`${URL}/${FAKE_ID}`).set(getAuthHeaders(superAdmin.accessToken)).expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });
});
