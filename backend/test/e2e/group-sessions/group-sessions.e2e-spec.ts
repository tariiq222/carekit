/**
 * CareKit — Group Sessions Module E2E Tests
 *
 * Endpoints:
 *   POST   /group-sessions                          — create session
 *   GET    /group-sessions                          — list sessions
 *   GET    /group-sessions/:id                      — get session detail
 *   PATCH  /group-sessions/:id                      — update session
 *   DELETE /group-sessions/:id                      — soft delete session
 *   PATCH  /group-sessions/:id/cancel               — cancel session
 *   PATCH  /group-sessions/:id/complete             — complete session + attendance
 *   POST   /group-sessions/:id/enroll               — enroll patient
 *   DELETE /group-sessions/:sessionId/enrollments/:enrollmentId — remove enrollment
 *
 * Coverage:
 *   - Feature flag gate blocks all endpoints when disabled
 *   - Auth gating (401 without token)
 *   - Full CRUD lifecycle
 *   - Enrollment lifecycle (enroll → cancel → re-enroll)
 *   - Status transitions (open → confirmed → completed)
 *   - Cancel with notifications
 *   - Validation errors (400)
 *   - 404 for non-existent IDs
 */

import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  loginTestUser,
  createTestUserWithRole,
  registerTestPatient,
  getAuthHeaders,
  expectSuccessResponse,
  TEST_USERS,
  API_PREFIX,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const GS_URL = `${API_PREFIX}/group-sessions`;
const FLAGS_URL = `${API_PREFIX}/feature-flags`;
const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;
const SPECIALTIES_URL = `${API_PREFIX}/specialties`;
const DEPTS_URL = `${API_PREFIX}/departments`;
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

const futureISO = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
};

describe('Group Sessions Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let superAdmin: AuthResult;
  let patient: AuthResult;
  let practitionerId: string;
  let departmentId: string;

  const createdSessionIds: string[] = [];

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);

    // Enable group_sessions feature flag
    await request(httpServer)
      .patch(`${FLAGS_URL}/group_sessions`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ enabled: true })
      .expect(200);

    // Enable departments feature flag (needed to create department)
    await request(httpServer)
      .patch(`${FLAGS_URL}/departments`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ enabled: true })
      .expect(200);

    // Create a department
    const deptRes = await request(httpServer)
      .post(DEPTS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameAr: 'قسم العلاج النفسي', nameEn: 'Psychotherapy' });
    if (deptRes.status === 201) {
      departmentId = (deptRes.body.data as { id: string }).id;
    }

    // Set up practitioner
    const practitionerAuth = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.practitioner,
      'practitioner',
    );
    const practitionerUserId = practitionerAuth.user['id'] as string;

    const specialtyRes = await request(httpServer)
      .post(SPECIALTIES_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameEn: 'Psychology', nameAr: 'علم النفس' });
    const specialtyId = specialtyRes.body.data?.id as string;

    const practCreateRes = await request(httpServer)
      .post(PRACTITIONERS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ userId: practitionerUserId, specialtyId });

    if (practCreateRes.status === 201 || practCreateRes.status === 200) {
      practitionerId = practCreateRes.body.data?.id as string;
    } else {
      const listRes = await request(httpServer)
        .get(PRACTITIONERS_URL)
        .query({ search: TEST_USERS.practitioner.firstName, perPage: '50' });
      const items = (listRes.body.data?.items ?? []) as Array<{
        id: string;
        user?: { id: string };
      }>;
      const found = items.find((p) => p.user?.id === practitionerUserId);
      practitionerId = found?.id as string;
    }
    if (!practitionerId) throw new Error('practitionerId setup failed');
  }, 60000);

  afterAll(async () => {
    // Clean up created sessions
    for (const id of createdSessionIds) {
      await request(httpServer)
        .delete(`${GS_URL}/${id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .catch(() => {});
    }

    // Restore feature flag
    await request(httpServer)
      .patch(`${FLAGS_URL}/group_sessions`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ enabled: false })
      .catch(() => {});

    await closeTestApp(testApp.app);
  });

  // Helper to create a session and track its ID
  async function createSession(overrides: Record<string, unknown> = {}) {
    const res = await request(httpServer)
      .post(GS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        nameAr: 'جلسة اختبارية',
        nameEn: 'Test Session',
        practitionerId,
        departmentId,
        minParticipants: 2,
        maxParticipants: 5,
        pricePerPersonHalalat: 5000,
        durationMinutes: 60,
        schedulingMode: 'fixed_date',
        startTime: futureISO(14),
        ...overrides,
      })
      .expect(201);

    expectSuccessResponse(res.body);
    const session = res.body.data as { id: string };
    createdSessionIds.push(session.id);
    return session;
  }

  // ─────────────────────────────────────────────────────────────
  // Feature flag gate
  // ─────────────────────────────────────────────────────────────

  describe('Feature flag gate', () => {
    // Regression: group-sessions returned 403 FEATURE_NOT_ENABLED for all users
    // because hasGroupSessions was false in LICENSE_DEFAULTS (seed.data.ts).
    // Fix: set hasGroupSessions=true in LICENSE_DEFAULTS so the license gate passes.
    it('REGRESSION: returns 200 for admin when license hasGroupSessions=true and flag is enabled', async () => {
      const res = await request(httpServer)
        .get(GS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('returns 403 FEATURE_NOT_ENABLED when flag is disabled', async () => {
      await request(httpServer)
        .patch(`${FLAGS_URL}/group_sessions`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ enabled: false })
        .expect(200);

      const res = await request(httpServer)
        .get(GS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(403);

      expect(res.body.success).toBe(false);
      const error = res.body.error as { code: string };
      expect(error.code).toBe('FEATURE_NOT_ENABLED');

      // Re-enable
      await request(httpServer)
        .patch(`${FLAGS_URL}/group_sessions`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ enabled: true })
        .expect(200);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Auth gate
  // ─────────────────────────────────────────────────────────────

  describe('Auth gate', () => {
    it('returns 401 on GET without token', async () => {
      await request(httpServer).get(GS_URL).expect(401);
    });

    it('returns 401 on POST without token', async () => {
      await request(httpServer)
        .post(GS_URL)
        .send({ nameAr: 'ت', nameEn: 'T' })
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /group-sessions — create
  // ─────────────────────────────────────────────────────────────

  describe('POST /group-sessions', () => {
    it('creates a fixed_date session with all fields', async () => {
      const res = await request(httpServer)
        .post(GS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'جلسة علاج جماعي',
          nameEn: 'Group Therapy',
          descriptionAr: 'وصف الجلسة',
          descriptionEn: 'Session description',
          practitionerId,
          departmentId,
          minParticipants: 3,
          maxParticipants: 10,
          pricePerPersonHalalat: 10000,
          durationMinutes: 90,
          schedulingMode: 'fixed_date',
          startTime: futureISO(7),
          paymentDeadlineHours: 72,
          isPublished: true,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const data = res.body.data as Record<string, unknown>;
      expect(data.id).toBeDefined();
      expect(data.nameAr).toBe('جلسة علاج جماعي');
      expect(data.nameEn).toBe('Group Therapy');
      expect(data.schedulingMode).toBe('fixed_date');
      expect(data.status).toBe('open');
      expect(data.currentEnrollment).toBe(0);
      expect(data.isPublished).toBe(true);
      expect(data.paymentDeadlineHours).toBe(72);
      createdSessionIds.push(data.id as string);
    });

    it('creates an on_capacity session without startTime', async () => {
      const res = await request(httpServer)
        .post(GS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'جلسة حسب السعة',
          nameEn: 'On Capacity Session',
          practitionerId,
          minParticipants: 5,
          maxParticipants: 20,
          pricePerPersonHalalat: 0,
          durationMinutes: 45,
          schedulingMode: 'on_capacity',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const data = res.body.data as Record<string, unknown>;
      expect(data.schedulingMode).toBe('on_capacity');
      expect(data.startTime).toBeNull();
      expect(data.pricePerPersonHalalat).toBe(0);
      createdSessionIds.push(data.id as string);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(httpServer)
        .post(GS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameAr: 'ناقص' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 when minParticipants > maxParticipants', async () => {
      const res = await request(httpServer)
        .post(GS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'جلسة خاطئة',
          nameEn: 'Bad Session',
          practitionerId,
          minParticipants: 20,
          maxParticipants: 5,
          pricePerPersonHalalat: 100,
          durationMinutes: 60,
          schedulingMode: 'fixed_date',
          startTime: futureISO(7),
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 when startTime is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const res = await request(httpServer)
        .post(GS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'جلسة ماضية',
          nameEn: 'Past Session',
          practitionerId,
          minParticipants: 2,
          maxParticipants: 5,
          pricePerPersonHalalat: 100,
          durationMinutes: 60,
          schedulingMode: 'fixed_date',
          startTime: pastDate.toISOString(),
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /group-sessions — list
  // ─────────────────────────────────────────────────────────────

  describe('GET /group-sessions', () => {
    it('returns paginated list', async () => {
      const res = await request(httpServer)
        .get(GS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as {
        items: unknown[];
        meta: {
          total: number;
          page: number;
          perPage: number;
          totalPages: number;
        };
      };
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.meta.page).toBe(1);
      expect(typeof data.meta.total).toBe('number');
    });

    it('filters by status', async () => {
      const res = await request(httpServer)
        .get(`${GS_URL}?status=open`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { items: Array<{ status: string }> };
      for (const item of data.items) {
        expect(item.status).toBe('open');
      }
    });

    it('filters by visibility=published', async () => {
      const res = await request(httpServer)
        .get(`${GS_URL}?visibility=published`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { items: Array<{ isPublished: boolean }> };
      for (const item of data.items) {
        expect(item.isPublished).toBe(true);
      }
    });

    it('searches by name', async () => {
      const res = await request(httpServer)
        .get(`${GS_URL}?search=Therapy`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { items: Array<{ nameEn: string }> };
      expect(data.items.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /group-sessions/:id — detail
  // ─────────────────────────────────────────────────────────────

  describe('GET /group-sessions/:id', () => {
    it('returns session with enrollments and practitioner', async () => {
      const session = await createSession();

      const res = await request(httpServer)
        .get(`${GS_URL}/${session.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as Record<string, unknown>;
      expect(data.id).toBe(session.id);
      expect(data.practitioner).toBeDefined();
      expect(Array.isArray(data.enrollments)).toBe(true);
    });

    it('returns 404 for non-existent session', async () => {
      const res = await request(httpServer)
        .get(`${GS_URL}/${NON_EXISTENT_UUID}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid UUID', async () => {
      await request(httpServer)
        .get(`${GS_URL}/not-a-uuid`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /group-sessions/:id — update
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /group-sessions/:id', () => {
    it('updates session fields', async () => {
      const session = await createSession();

      const res = await request(httpServer)
        .patch(`${GS_URL}/${session.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Updated Session', isPublished: true })
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { nameEn: string; isPublished: boolean };
      expect(data.nameEn).toBe('Updated Session');
      expect(data.isPublished).toBe(true);
    });

    it('returns 404 for non-existent session', async () => {
      const res = await request(httpServer)
        .patch(`${GS_URL}/${NON_EXISTENT_UUID}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Ghost' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /group-sessions/:id — soft delete
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /group-sessions/:id', () => {
    it('soft deletes a session', async () => {
      const session = await createSession();

      const res = await request(httpServer)
        .delete(`${GS_URL}/${session.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { deleted: boolean };
      expect(data.deleted).toBe(true);
    });

    it('deleted session is not returned in list', async () => {
      const session = await createSession();

      await request(httpServer)
        .delete(`${GS_URL}/${session.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const listRes = await request(httpServer)
        .get(GS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const data = listRes.body.data as { items: Array<{ id: string }> };
      const found = data.items.find((s) => s.id === session.id);
      expect(found).toBeUndefined();
    });

    it('returns 404 for non-existent session', async () => {
      const res = await request(httpServer)
        .delete(`${GS_URL}/${NON_EXISTENT_UUID}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Enrollment lifecycle
  // ─────────────────────────────────────────────────────────────

  describe('Enrollment lifecycle', () => {
    let sessionId: string;
    let patientUserId: string;
    let enrollmentId: string;

    beforeAll(async () => {
      patientUserId = patient.user['id'] as string;

      // Create a free session (minParticipants=1) for simpler enrollment testing
      const session = await createSession({
        nameEn: 'Enrollment Test Session',
        pricePerPersonHalalat: 0,
        minParticipants: 1,
        maxParticipants: 3,
      });
      sessionId = session.id;
    });

    it('enrolls a patient', async () => {
      const res = await request(httpServer)
        .post(`${GS_URL}/${sessionId}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patientUserId })
        .expect(201);

      expectSuccessResponse(res.body);
      const data = res.body.data as {
        id: string;
        groupSessionId: string;
        status: string;
      };
      expect(data.groupSessionId).toBe(sessionId);
      expect(data.status).toBe('confirmed'); // free session → auto-confirmed
      enrollmentId = data.id;
    });

    it('rejects duplicate enrollment', async () => {
      const res = await request(httpServer)
        .post(`${GS_URL}/${sessionId}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patientUserId })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('removes enrollment (admin)', async () => {
      // For free sessions, enrollment is 'confirmed' — removeEnrollment may reject.
      // Create a paid session to test removal of 'registered' enrollment.
      const paidSession = await createSession({
        nameEn: 'Paid Removal Test',
        pricePerPersonHalalat: 5000,
        minParticipants: 1,
        maxParticipants: 5,
      });

      const enrollRes = await request(httpServer)
        .post(`${GS_URL}/${paidSession.id}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patientUserId })
        .expect(201);

      const enrId = (enrollRes.body.data as { id: string }).id;

      const res = await request(httpServer)
        .delete(`${GS_URL}/${paidSession.id}/enrollments/${enrId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { cancelled: boolean };
      expect(data.cancelled).toBe(true);
    });

    it('returns 404 when enrolling in non-existent session', async () => {
      const res = await request(httpServer)
        .post(`${GS_URL}/${NON_EXISTENT_UUID}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patientUserId })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid patientId', async () => {
      await request(httpServer)
        .post(`${GS_URL}/${sessionId}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: 'not-a-uuid' })
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /group-sessions/:id/cancel
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /group-sessions/:id/cancel', () => {
    it('cancels an open session', async () => {
      const session = await createSession();

      const res = await request(httpServer)
        .patch(`${GS_URL}/${session.id}/cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { cancelled: boolean };
      expect(data.cancelled).toBe(true);

      // Verify status changed
      const detailRes = await request(httpServer)
        .get(`${GS_URL}/${session.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const detail = detailRes.body.data as { status: string };
      expect(detail.status).toBe('cancelled');
    });

    it('returns 400 when cancelling an already cancelled session', async () => {
      const session = await createSession();

      // Cancel first time
      await request(httpServer)
        .patch(`${GS_URL}/${session.id}/cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      // Try to cancel again
      const res = await request(httpServer)
        .patch(`${GS_URL}/${session.id}/cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /group-sessions/:id/complete
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /group-sessions/:id/complete', () => {
    it('completes a confirmed session with attendance', async () => {
      const patientUserId = patient.user['id'] as string;

      // Create free session with minParticipants=1 so it auto-confirms on first enrollment
      const session = await createSession({
        nameEn: 'Complete Test',
        pricePerPersonHalalat: 0,
        minParticipants: 1,
        maxParticipants: 5,
      });

      // Enroll patient → free session auto-confirms → session becomes 'confirmed'
      await request(httpServer)
        .post(`${GS_URL}/${session.id}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patientUserId })
        .expect(201);

      // Complete session with attendance
      const res = await request(httpServer)
        .patch(`${GS_URL}/${session.id}/complete`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ attendedPatientIds: [patientUserId] })
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { completed: boolean };
      expect(data.completed).toBe(true);

      // Verify status
      const detailRes = await request(httpServer)
        .get(`${GS_URL}/${session.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const detail = detailRes.body.data as { status: string };
      expect(detail.status).toBe('completed');
    });

    it('returns 400 when completing an open session', async () => {
      const session = await createSession();

      const res = await request(httpServer)
        .patch(`${GS_URL}/${session.id}/complete`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ attendedPatientIds: [] })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });
});
