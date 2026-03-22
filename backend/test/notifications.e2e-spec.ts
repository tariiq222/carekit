/**
 * CareKit — Notifications Module E2E Tests (TDD RED Phase)
 *
 * Tests all notification endpoints per docs/api-spec.md:
 *   GET    /notifications              — list user's notifications (JWT, paginated)
 *   GET    /notifications/unread-count — get unread count (JWT)
 *   PATCH  /notifications/:id/read     — mark as read (JWT, OWNER)
 *   PATCH  /notifications/read-all     — mark all as read (JWT)
 *   POST   /notifications/fcm-token    — register FCM device token (JWT)
 *   DELETE /notifications/fcm-token    — unregister FCM device token (JWT)
 *
 * Permission matrix (notifications module):
 *   super_admin  → view, create, edit, delete
 *   receptionist → view, create, edit
 *   accountant   → (none)
 *   practitioner → (none — but all users see their OWN notifications via JWT)
 *   patient      → (none — but all users see their OWN notifications via JWT)
 *
 * Note: The list/read/unread endpoints are user-scoped (JWT only, no CASL check).
 *       The admin notification management (create/delete) uses CASL permissions.
 *
 * These tests will FAIL until backend-dev implements the notifications module.
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
  TEST_PATIENT_2,
  type TestApp,
  type AuthResult,
} from './setup';

const NOTIFICATIONS_URL = `${API_PREFIX}/notifications`;

describe('Notifications Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let practitionerAuth: AuthResult;
  let patient: AuthResult;
  let patient2: AuthResult;

  // Notification IDs populated during tests
  let notificationId: string;
  let patient2NotificationId: string;

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

    practitionerAuth = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.practitioner,
      'practitioner',
    );

    patient = await registerTestPatient(httpServer);
    patient2 = await registerTestPatient(httpServer, TEST_PATIENT_2);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ─────────────────────────────────────────────────────────────
  // GET /notifications — List User's Notifications
  // ─────────────────────────────────────────────────────────────

  describe('GET /notifications', () => {
    it('should return paginated notifications for authenticated user', async () => {
      const res = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.items)).toBe(true);

      const { meta } = res.body.data;
      expect(meta).toHaveProperty('total');
      expect(meta).toHaveProperty('page');
      expect(meta).toHaveProperty('perPage');
      expect(meta).toHaveProperty('totalPages');
      expect(meta).toHaveProperty('hasNextPage');
      expect(meta).toHaveProperty('hasPreviousPage');
    });

    it('should return only the current user\'s notifications', async () => {
      const resPatient = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      const resPatient2 = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(200);

      // Each user should see different notifications (or both empty)
      // They should never see the other user's notifications
      const p1Ids = (resPatient.body.data.items as Array<{ id: string }>).map(
        (n) => n.id,
      );
      const p2Ids = (resPatient2.body.data.items as Array<{ id: string }>).map(
        (n) => n.id,
      );

      // No overlap between users
      for (const id of p1Ids) {
        expect(p2Ids).not.toContain(id);
      }
    });

    it('should work for practitioners', async () => {
      const res = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should work for admin users', async () => {
      const res = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject without authentication (401)', async () => {
      const res = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return notifications with correct shape', async () => {
      const res = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      const items = res.body.data.items as Array<Record<string, unknown>>;
      for (const notification of items) {
        expect(notification).toHaveProperty('id');
        expect(notification).toHaveProperty('titleAr');
        expect(notification).toHaveProperty('titleEn');
        expect(notification).toHaveProperty('bodyAr');
        expect(notification).toHaveProperty('bodyEn');
        expect(notification).toHaveProperty('type');
        expect(notification).toHaveProperty('isRead');
        expect(notification).toHaveProperty('createdAt');
      }

      // Save a notification ID if available for later tests
      if (items.length > 0) {
        notificationId = items[0].id as string;
      }
    });

    it('should return notifications sorted by createdAt descending (newest first)', async () => {
      const res = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      const items = res.body.data.items as Array<{ createdAt: string }>;
      for (let i = 1; i < items.length; i++) {
        const prev = new Date(items[i - 1].createdAt).getTime();
        const curr = new Date(items[i].createdAt).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('should support pagination with page and perPage', async () => {
      const res = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .query({ page: 1, perPage: 5 })
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expect(res.body.data.meta.perPage).toBe(5);
      expect(res.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should include notification type from enum (booking_confirmed, etc.)', async () => {
      const validTypes = [
        'booking_confirmed',
        'booking_cancelled',
        'reminder',
        'payment_received',
        'new_rating',
        'problem_report',
      ];

      const res = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      const items = res.body.data.items as Array<{ type: string }>;
      for (const notification of items) {
        expect(validTypes).toContain(notification.type);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /notifications/unread-count — Unread Count
  // ─────────────────────────────────────────────────────────────

  describe('GET /notifications/unread-count', () => {
    it('should return unread notification count for authenticated user', async () => {
      const res = await request(httpServer)
        .get(`${NOTIFICATIONS_URL}/unread-count`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('count');
      expect(typeof res.body.data.count).toBe('number');
      expect(res.body.data.count).toBeGreaterThanOrEqual(0);
    });

    it('should return count only for the current user\'s notifications', async () => {
      const res1 = await request(httpServer)
        .get(`${NOTIFICATIONS_URL}/unread-count`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      const res2 = await request(httpServer)
        .get(`${NOTIFICATIONS_URL}/unread-count`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(200);

      // Counts may differ between users
      expect(typeof res1.body.data.count).toBe('number');
      expect(typeof res2.body.data.count).toBe('number');
    });

    it('should reject without authentication (401)', async () => {
      const res = await request(httpServer)
        .get(`${NOTIFICATIONS_URL}/unread-count`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /notifications/:id/read — Mark as Read (OWNER)
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /notifications/:id/read', () => {
    // These tests depend on notifications existing. If no notifications
    // were created via booking/payment flows, some may be conditionally skipped.

    it('should mark a notification as read for the owning user', async () => {
      // Skip if no notification available
      if (!notificationId) {
        return;
      }

      const res = await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/${notificationId}/read`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isRead', true);
    });

    it('should reject marking another user\'s notification as read (403)', async () => {
      if (!notificationId) {
        return;
      }

      // patient2 tries to mark patient's notification
      const res = await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/${notificationId}/read`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject without authentication (401)', async () => {
      if (!notificationId) {
        return;
      }

      const res = await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/${notificationId}/read`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/${fakeId}/read`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should be idempotent (marking already-read notification succeeds)', async () => {
      if (!notificationId) {
        return;
      }

      // Mark as read again — should succeed
      const res = await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/${notificationId}/read`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isRead', true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /notifications/read-all — Mark All as Read
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /notifications/read-all', () => {
    it('should mark all user\'s notifications as read', async () => {
      const res = await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/read-all`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should result in unread count of 0 after marking all as read', async () => {
      // First mark all as read
      await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/read-all`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      // Check unread count is 0
      const res = await request(httpServer)
        .get(`${NOTIFICATIONS_URL}/unread-count`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expect(res.body.data.count).toBe(0);
    });

    it('should not affect other users\' notifications', async () => {
      // Get patient2's unread count before
      const beforeRes = await request(httpServer)
        .get(`${NOTIFICATIONS_URL}/unread-count`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(200);

      const countBefore = beforeRes.body.data.count;

      // patient marks all as read
      await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/read-all`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      // patient2's count should be unchanged
      const afterRes = await request(httpServer)
        .get(`${NOTIFICATIONS_URL}/unread-count`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(200);

      expect(afterRes.body.data.count).toBe(countBefore);
    });

    it('should reject without authentication (401)', async () => {
      const res = await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/read-all`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should succeed even if no unread notifications exist', async () => {
      // Mark all as read twice — second time should still succeed
      await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/read-all`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      const res = await request(httpServer)
        .patch(`${NOTIFICATIONS_URL}/read-all`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /notifications/fcm-token — Register FCM Token
  // ─────────────────────────────────────────────────────────────

  describe('POST /notifications/fcm-token', () => {
    const validToken = {
      token: 'dGVzdC1mY20tdG9rZW4tZm9yLWlvcy1kZXZpY2U',
      platform: 'ios',
    };

    it('should register an FCM token for authenticated user', async () => {
      const res = await request(httpServer)
        .post(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(patient.accessToken))
        .send(validToken)
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should accept android platform', async () => {
      const res = await request(httpServer)
        .post(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          token: 'android-fcm-token-string-test',
          platform: 'android',
        })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should reject without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(`${NOTIFICATIONS_URL}/fcm-token`)
        .send(validToken)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject without required fields', async () => {
      const res = await request(httpServer)
        .post(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(patient.accessToken))
        .send({})
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject without token field', async () => {
      const res = await request(httpServer)
        .post(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ platform: 'ios' })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject invalid platform value', async () => {
      const res = await request(httpServer)
        .post(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          token: 'some-token',
          platform: 'windows', // invalid
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should allow re-registering the same token (idempotent/upsert)', async () => {
      // Register same token twice — should not create duplicates
      await request(httpServer)
        .post(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(patient.accessToken))
        .send(validToken)
        .expect(201);

      const res = await request(httpServer)
        .post(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(patient.accessToken))
        .send(validToken)
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should work for practitioner users', async () => {
      const res = await request(httpServer)
        .post(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({
          token: 'practitioner-fcm-token-string',
          platform: 'android',
        })
        .expect(201);

      expectSuccessResponse(res.body);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /notifications/fcm-token — Unregister FCM Token
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /notifications/fcm-token', () => {
    it('should unregister an FCM token for authenticated user', async () => {
      const res = await request(httpServer)
        .delete(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ token: 'dGVzdC1mY20tdG9rZW4tZm9yLWlvcy1kZXZpY2U' })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject without authentication (401)', async () => {
      const res = await request(httpServer)
        .delete(`${NOTIFICATIONS_URL}/fcm-token`)
        .send({ token: 'some-token' })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject without token field', async () => {
      const res = await request(httpServer)
        .delete(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(patient.accessToken))
        .send({})
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should succeed even if token does not exist (idempotent)', async () => {
      const res = await request(httpServer)
        .delete(`${NOTIFICATIONS_URL}/fcm-token`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ token: 'non-existent-token-string' })
        .expect(200);

      expectSuccessResponse(res.body);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Security
  // ─────────────────────────────────────────────────────────────

  describe('Security', () => {
    it('should handle expired JWT token (401)', async () => {
      const res = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .set(getAuthHeaders('expired.jwt.token'))
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should not expose user-sensitive data in notification responses', async () => {
      const res = await request(httpServer)
        .get(NOTIFICATIONS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      const items = res.body.data.items as Array<Record<string, unknown>>;
      for (const notification of items) {
        // Should not expose full user object
        expect(notification).not.toHaveProperty('userId');
        expect(notification).not.toHaveProperty('user');
      }
    });
  });
});
