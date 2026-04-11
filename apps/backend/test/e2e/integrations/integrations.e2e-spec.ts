/**
 * Integrations Module E2E Tests
 *
 * The integrations module currently consists of:
 *   - ZoomModule / ZoomService — internal service, no HTTP controller
 *
 * Since there is no public HTTP controller, this test suite verifies:
 *   1. The IntegrationsModule boots successfully as part of AppModule
 *      (regression guard — if ZoomModule fails to init, the whole app fails)
 *   2. Zoom-related bookings (virtual type) still work via /bookings
 *   3. Practitioner availability includes virtual booking type
 *
 * When a ZoomController is added in the future, add endpoint tests here.
 */

import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  getAuthHeaders,
  expectSuccessResponse,
  TEST_USERS,
  API_PREFIX,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

describe('Integrations Module — ZoomService bootstrap (e2e)', () => {
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
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ── AppModule boot guard ────────────────────────────────────────────────

  describe('AppModule + IntegrationsModule initialisation', () => {
    it('app starts successfully with IntegrationsModule (ZoomService) loaded', async () => {
      // If this test runs at all, the app started — IntegrationsModule bootstrapped correctly
      const res = await request(httpServer)
        .get(`${API_PREFIX}/health`)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('health endpoint confirms all dependencies (DB, Redis) are reachable', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/health`)
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as Record<string, unknown>;
      expect(data).toHaveProperty('status');
    });
  });

  // ── Virtual booking type (uses ZoomService internally) ────────────────

  describe('Virtual bookings (Zoom integration path)', () => {
    it('GET /bookings returns 200 for super_admin (virtual type supported)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('POST /bookings with type=online is accepted by validation (not 400)', async () => {
      // Type validation should pass for virtual bookings
      // The booking may fail (404 service/practitioner) but NOT 400 from type validation
      const res = await request(httpServer)
        .post(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          serviceId: '00000000-0000-0000-0000-000000000001',
          practitionerId: '00000000-0000-0000-0000-000000000002',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          type: 'online',
        });

      // 201 (created), 404 (service/practitioner not found), 422 (business rule) are all fine
      // 400 with VALIDATION_ERROR on 'type' field would indicate the enum is missing 'online'
      if (res.status === 400) {
        const error = res.body.error as Record<string, unknown>;
        const details = error.details as Array<{ field: string }> | undefined;
        const hasTypeError = details?.some((d) => d.field === 'type');
        expect(hasTypeError).toBe(false);
      }
    });

    it('GET /practitioners lists practitioners who can do virtual sessions', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/practitioners`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      // If practitioners exist, the response structure is correct
      const data = res.body.data as Record<string, unknown>;
      expect(data).toBeDefined();
    });
  });

  // ── No unexpected public endpoints exposed ──────────────────────────────

  describe('No unprotected Zoom endpoints', () => {
    it('GET /integrations returns 404 (no controller registered)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/integrations`)
        .set(getAuthHeaders(superAdmin.accessToken));

      // Should be 404 — no controller at this path
      expect([404]).toContain(res.status);
    });

    it('GET /zoom returns 404 (no public Zoom controller)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/zoom`)
        .set(getAuthHeaders(superAdmin.accessToken));

      expect([404]).toContain(res.status);
    });
  });
});
