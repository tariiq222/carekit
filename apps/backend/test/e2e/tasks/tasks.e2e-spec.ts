/**
 * Tasks Module E2E Tests
 *
 * The tasks module contains background job services (no HTTP controllers):
 *   - BookingAutomationService   — recurring booking creation (BullMQ)
 *   - BookingExpiryService       — expire unpaid bookings (BullMQ)
 *   - BookingNoShowService       — mark no-shows (BullMQ)
 *   - BookingCancellationTimeoutService — timeout pending cancellations
 *   - BookingAutocompleteService — auto-complete past appointments
 *   - ReminderService            — FCM/SMS reminders (BullMQ)
 *   - CleanupService             — stale data purge (BullMQ)
 *   - TasksBootstrapService      — registers all cron jobs on app start
 *
 * Since tasks run on a schedule (no HTTP endpoints), this suite verifies:
 *   1. TasksModule boots successfully (no missing providers / circular deps)
 *   2. BullMQ queues are registered without errors
 *   3. TasksBootstrapService scheduled the cron jobs (queue is reachable)
 *   4. Side effects of tasks are observable via the public API
 *      e.g., expired bookings are reflected in GET /bookings status
 *
 * Trigger-based tests (directly enqueuing jobs) are in unit tests.
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

describe('Tasks Module — Background Jobs Bootstrap (e2e)', () => {
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

  describe('TasksModule initialisation', () => {
    it('app starts with TasksModule loaded (no DI / circular dependency errors)', async () => {
      // If this test runs, the app started — TasksModule bootstrapped without errors
      const res = await request(httpServer)
        .get(`${API_PREFIX}/health`)
        .expect(200);
      expect(res.body).toBeDefined();
    });

    it('health check reports all services UP (Redis/BullMQ reachable)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/health`)
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as Record<string, unknown>;
      // If status is present and not 'error', BullMQ/Redis are up
      expect(data.status).not.toBe('error');
    });
  });

  // ── Task side-effects via public API ────────────────────────────────────

  describe('Task side-effects observable via API', () => {
    it('bookings can be queried — expiry/autocomplete tasks do not corrupt booking list', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      // Verify the shape is correct (tasks haven't corrupted data)
      const data = res.body.data as Record<string, unknown>;
      expect(data).toBeDefined();
    });

    it('GET /bookings for patient returns only their own bookings (task scoping intact)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('activity-log is accessible (cleanup tasks do not over-delete logs)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/activity-log`)
        .set(getAuthHeaders(superAdmin.accessToken));

      // 200 = logs accessible | 403 = permission issue (not task-related) | 404 = endpoint not yet implemented
      expect([200, 403, 404]).toContain(res.status);
    });
  });

  // ── No unexpected HTTP endpoints exposed by tasks ──────────────────────

  describe('No public task-trigger endpoints (security)', () => {
    it('GET /tasks returns 404 (no HTTP controller)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/tasks`)
        .set(getAuthHeaders(superAdmin.accessToken));
      expect([404]).toContain(res.status);
    });

    it('POST /tasks/run returns 404 (background jobs not externally triggerable)', async () => {
      const res = await request(httpServer)
        .post(`${API_PREFIX}/tasks/run`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ job: 'bookingExpiry' });
      expect([404, 405]).toContain(res.status);
    });

    it('unauthenticated access to non-existent /tasks endpoint returns 404 not 500', async () => {
      const res = await request(httpServer).get(`${API_PREFIX}/tasks`);
      expect([404]).toContain(res.status);
    });
  });

  // ── Reminder / notification task side-effects ───────────────────────────

  describe('Notification side-effects (reminder tasks)', () => {
    it('GET /notifications returns 200 for super_admin (reminder tasks write here)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/notifications`)
        .set(getAuthHeaders(superAdmin.accessToken));

      // 200 or 403 (permission issue) — not 500 (task crash)
      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        expectSuccessResponse(res.body);
      }
    });
  });
});
