/**
 * CareKit — Branch Practitioner Assignment E2E Tests
 *
 * Covers full M2M cycle:
 *   - Assign practitioner → appears in GET /branches/:id/practitioners
 *   - Idempotent assign (no duplicates)
 *   - Remove practitioner → disappears from GET
 *   - 404 when removing unassigned practitioner
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  getAuthHeaders,
  expectSuccessResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const BRANCHES_URL = `${API_PREFIX}/branches`;
const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;

describe('Branch Practitioner Assignment (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let superAdmin: AuthResult;
  let cycleBranchId: string;
  let practitionerId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(httpServer, TEST_USERS.super_admin.email, TEST_USERS.super_admin.password);

    const bRes = await request(httpServer)
      .post(BRANCHES_URL).set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameAr: 'فرع دورة الاختبار', nameEn: 'Test Cycle Branch' })
      .expect(201);
    cycleBranchId = (bRes.body.data as { id: string }).id;

    const pRes = await request(httpServer)
      .get(PRACTITIONERS_URL).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
    const practitioners = (pRes.body.data?.items ?? pRes.body.data) as Array<{ id: string }>;
    expect(practitioners.length).toBeGreaterThan(0);
    practitionerId = practitioners[0].id;
  });

  afterAll(async () => { await closeTestApp(testApp.app); });

  it('should assign practitioners and reflect in GET response', async () => {
    await request(httpServer)
      .patch(`${BRANCHES_URL}/${cycleBranchId}/practitioners`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ practitionerIds: [practitionerId] })
      .expect(200);

    const res = await request(httpServer)
      .get(`${BRANCHES_URL}/${cycleBranchId}/practitioners`)
      .set(getAuthHeaders(superAdmin.accessToken)).expect(200);
    expectSuccessResponse(res.body);
    const items = (res.body.data?.items ?? res.body.data) as Array<{ practitioner: { id: string } }>;
    expect(items.some((p) => p.practitioner.id === practitionerId)).toBe(true);
  });

  it('should be idempotent — assigning same practitioner twice does not duplicate', async () => {
    await request(httpServer)
      .patch(`${BRANCHES_URL}/${cycleBranchId}/practitioners`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ practitionerIds: [practitionerId] })
      .expect(200);

    const res = await request(httpServer)
      .get(`${BRANCHES_URL}/${cycleBranchId}/practitioners`)
      .set(getAuthHeaders(superAdmin.accessToken)).expect(200);
    const items = (res.body.data?.items ?? res.body.data) as Array<{ practitioner: { id: string } }>;
    const matches = items.filter((p) => p.practitioner.id === practitionerId);
    expect(matches).toHaveLength(1);
  });

  it('should remove practitioner from branch', async () => {
    await request(httpServer)
      .delete(`${BRANCHES_URL}/${cycleBranchId}/practitioners/${practitionerId}`)
      .set(getAuthHeaders(superAdmin.accessToken)).expect(200);

    const res = await request(httpServer)
      .get(`${BRANCHES_URL}/${cycleBranchId}/practitioners`)
      .set(getAuthHeaders(superAdmin.accessToken)).expect(200);
    const items = (res.body.data?.items ?? res.body.data) as Array<{ practitioner: { id: string } }>;
    expect(items.every((p) => p.practitioner.id !== practitionerId)).toBe(true);
  });

  it('should return 404 when removing practitioner not assigned to branch', async () => {
    await request(httpServer)
      .delete(`${BRANCHES_URL}/${cycleBranchId}/practitioners/${practitionerId}`)
      .set(getAuthHeaders(superAdmin.accessToken)).expect(404);
  });
});
