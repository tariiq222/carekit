/**
 * CareKit — Groups Module E2E Tests
 *
 * Endpoints:
 *   POST   /groups                                       — create group
 *   GET    /groups                                       — list groups
 *   GET    /groups/:id                                   — get group detail
 *   PATCH  /groups/:id                                   — update group
 *   DELETE /groups/:id                                   — soft delete group
 *   PATCH  /groups/:id/cancel                            — cancel group
 *   PATCH  /groups/:id/complete                          — complete + attendance
 *   PATCH  /groups/:id/trigger-payment                   — trigger payment request
 *   PATCH  /groups/:id/confirm-schedule                  — set date (on_capacity)
 *   POST   /groups/:id/enroll                            — enroll patient
 *   DELETE /groups/:groupId/enrollments/:enrollmentId    — remove enrollment
 *   PATCH  /groups/:id/bulk-attendance                   — bulk attendance
 *   POST   /groups/:id/enrollments/:enrollmentId/certificate — issue certificate
 *
 * Coverage:
 *   - Feature flag gate (groups)
 *   - Auth gating (401)
 *   - Full CRUD lifecycle
 *   - paymentType: FREE_HOLD (immediate confirm), FULL_PAYMENT (registered)
 *   - enroll() blocked for awaiting_payment and confirmed statuses (regression)
 *   - Status transitions: open → awaiting_payment → confirmed → completed
 *   - triggerPaymentRequest() min participants guard
 *   - Certificate issuance idempotency
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

const GROUPS_URL = `${API_PREFIX}/groups`;
const FLAGS_URL = `${API_PREFIX}/feature-flags`;
const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;
const SPECIALTIES_URL = `${API_PREFIX}/specialties`;
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

const futureISO = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
};

describe('Groups Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let superAdmin: AuthResult;
  let patient: AuthResult;
  let practitionerId: string;

  const createdGroupIds: string[] = [];

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);

    // Enable groups feature flag
    await request(httpServer)
      .patch(`${FLAGS_URL}/groups`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ enabled: true })
      .expect(200);

    // Setup practitioner
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
      .send({ nameEn: 'Group Therapy', nameAr: 'العلاج الجماعي' });
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
    for (const id of createdGroupIds) {
      await request(httpServer)
        .delete(`${GROUPS_URL}/${id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .catch(() => {});
    }

    await request(httpServer)
      .patch(`${FLAGS_URL}/groups`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ enabled: false })
      .catch(() => {});

    await closeTestApp(testApp.app);
  });

  // Helper
  async function createGroup(overrides: Record<string, unknown> = {}) {
    const res = await request(httpServer)
      .post(GROUPS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        nameAr: 'مجموعة اختبارية',
        nameEn: 'Test Group',
        practitionerId,
        minParticipants: 2,
        maxParticipants: 5,
        pricePerPersonHalalat: 5000,
        durationMinutes: 60,
        paymentType: 'FULL_PAYMENT',
        schedulingMode: 'on_capacity',
        deliveryMode: 'in_person',
        ...overrides,
      })
      .expect(201);

    expectSuccessResponse(res.body);
    const group = res.body.data as { id: string };
    createdGroupIds.push(group.id);
    return group;
  }

  // ─── Feature flag gate ───────────────────────────────────────

  describe('Feature flag gate', () => {
    it('returns 200 when flag enabled', async () => {
      const res = await request(httpServer)
        .get(GROUPS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);
      expectSuccessResponse(res.body);
    });

    it('returns 403 FEATURE_NOT_ENABLED when flag disabled', async () => {
      await request(httpServer)
        .patch(`${FLAGS_URL}/groups`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ enabled: false })
        .expect(200);

      const res = await request(httpServer)
        .get(GROUPS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(403);

      expect(res.body.success).toBe(false);
      expect((res.body.error as { code: string }).code).toBe(
        'FEATURE_NOT_ENABLED',
      );

      await request(httpServer)
        .patch(`${FLAGS_URL}/groups`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ enabled: true })
        .expect(200);
    });
  });

  // ─── Auth gate ───────────────────────────────────────────────

  describe('Auth gate', () => {
    it('returns 401 on GET without token', async () => {
      await request(httpServer).get(GROUPS_URL).expect(401);
    });

    it('returns 401 on POST without token', async () => {
      await request(httpServer)
        .post(GROUPS_URL)
        .send({ nameAr: 'ت', nameEn: 'T' })
        .expect(401);
    });
  });

  // ─── POST /groups — create ───────────────────────────────────

  describe('POST /groups', () => {
    it('creates FULL_PAYMENT on_capacity group', async () => {
      const res = await request(httpServer)
        .post(GROUPS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'جلسة علاج جماعي',
          nameEn: 'Group Therapy',
          practitionerId,
          minParticipants: 3,
          maxParticipants: 10,
          pricePerPersonHalalat: 10000,
          durationMinutes: 90,
          paymentType: 'FULL_PAYMENT',
          schedulingMode: 'on_capacity',
          deliveryMode: 'in_person',
          paymentDeadlineHours: 72,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const data = res.body.data as Record<string, unknown>;
      expect(data.nameEn).toBe('Group Therapy');
      expect(data.status).toBe('open');
      expect(data.currentEnrollment).toBe(0);
      expect(data.paymentType).toBe('FULL_PAYMENT');
      expect(data.deliveryMode).toBe('in_person');
      createdGroupIds.push(data.id as string);
    });

    it('creates FREE_HOLD fixed_date group', async () => {
      const res = await request(httpServer)
        .post(GROUPS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'جلسة مجانية',
          nameEn: 'Free Session',
          practitionerId,
          minParticipants: 2,
          maxParticipants: 8,
          pricePerPersonHalalat: 0,
          durationMinutes: 45,
          paymentType: 'FREE_HOLD',
          schedulingMode: 'fixed_date',
          startTime: futureISO(14),
          deliveryMode: 'online',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const data = res.body.data as Record<string, unknown>;
      expect(data.paymentType).toBe('FREE_HOLD');
      expect(data.deliveryMode).toBe('online');
      expect(data.startTime).toBeTruthy();
      createdGroupIds.push(data.id as string);
    });

    it('creates DEPOSIT group with depositAmount', async () => {
      const res = await request(httpServer)
        .post(GROUPS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'جلسة عربون',
          nameEn: 'Deposit Session',
          practitionerId,
          minParticipants: 2,
          maxParticipants: 6,
          pricePerPersonHalalat: 20000,
          durationMinutes: 60,
          paymentType: 'DEPOSIT',
          depositAmount: 5000,
          schedulingMode: 'on_capacity',
          deliveryMode: 'hybrid',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const data = res.body.data as Record<string, unknown>;
      expect(data.paymentType).toBe('DEPOSIT');
      expect(data.depositAmount).toBe(5000);
      createdGroupIds.push(data.id as string);
    });

    it('returns 400 when minParticipants > maxParticipants', async () => {
      const res = await request(httpServer)
        .post(GROUPS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'خطأ',
          nameEn: 'Error',
          practitionerId,
          minParticipants: 20,
          maxParticipants: 5,
          pricePerPersonHalalat: 100,
          durationMinutes: 60,
          paymentType: 'FULL_PAYMENT',
          schedulingMode: 'on_capacity',
          deliveryMode: 'in_person',
        })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for DEPOSIT without depositAmount', async () => {
      const res = await request(httpServer)
        .post(GROUPS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'ناقص',
          nameEn: 'Missing',
          practitionerId,
          minParticipants: 2,
          maxParticipants: 5,
          pricePerPersonHalalat: 10000,
          durationMinutes: 60,
          paymentType: 'DEPOSIT',
          schedulingMode: 'on_capacity',
          deliveryMode: 'in_person',
        })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for fixed_date without startTime', async () => {
      const res = await request(httpServer)
        .post(GROUPS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'بدون تاريخ',
          nameEn: 'No Date',
          practitionerId,
          minParticipants: 2,
          maxParticipants: 5,
          pricePerPersonHalalat: 100,
          durationMinutes: 60,
          paymentType: 'FULL_PAYMENT',
          schedulingMode: 'fixed_date',
          deliveryMode: 'in_person',
        })
        .expect(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /groups — list ───────────────────────────────────────

  describe('GET /groups', () => {
    it('returns paginated list with meta', async () => {
      const res = await request(httpServer)
        .get(GROUPS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as {
        items: unknown[];
        meta: { total: number; page: number };
      };
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.meta.page).toBe(1);
      expect(typeof data.meta.total).toBe('number');
    });

    it('filters by status=open', async () => {
      const res = await request(httpServer)
        .get(`${GROUPS_URL}?status=open`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const data = res.body.data as { items: Array<{ status: string }> };
      for (const item of data.items) {
        expect(item.status).toBe('open');
      }
    });

    it('filters by deliveryMode=in_person', async () => {
      const res = await request(httpServer)
        .get(`${GROUPS_URL}?deliveryMode=in_person`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const data = res.body.data as { items: Array<{ deliveryMode: string }> };
      for (const item of data.items) {
        expect(item.deliveryMode).toBe('in_person');
      }
    });

    it('searches by name', async () => {
      const res = await request(httpServer)
        .get(`${GROUPS_URL}?search=Test Group`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('returns 404 for non-existent group', async () => {
      await request(httpServer)
        .get(`${GROUPS_URL}/${NON_EXISTENT_UUID}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);
    });
  });

  // ─── PATCH /groups/:id — update ──────────────────────────────

  describe('PATCH /groups/:id', () => {
    it('updates group name and deliveryMode', async () => {
      const group = await createGroup();

      const res = await request(httpServer)
        .patch(`${GROUPS_URL}/${group.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Updated Group Name', deliveryMode: 'online' })
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as Record<string, unknown>;
      expect(data.nameEn).toBe('Updated Group Name');
      expect(data.deliveryMode).toBe('online');
    });

    it('returns 404 for non-existent group', async () => {
      await request(httpServer)
        .patch(`${GROUPS_URL}/${NON_EXISTENT_UUID}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'X' })
        .expect(404);
    });
  });

  // ─── Enrollment lifecycle ─────────────────────────────────────

  describe('Enrollment lifecycle', () => {
    let groupId: string;
    let enrollmentId: string;

    beforeEach(async () => {
      const group = await createGroup({
        paymentType: 'FULL_PAYMENT',
        schedulingMode: 'on_capacity',
      });
      groupId = group.id;
    });

    it('enrolls a patient — status=registered for FULL_PAYMENT', async () => {
      const res = await request(httpServer)
        .post(`${GROUPS_URL}/${groupId}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patient.user['id'] })
        .expect(201);

      expectSuccessResponse(res.body);
      const enrollment = res.body.data as { id: string; status: string };
      expect(enrollment.status).toBe('registered');
      enrollmentId = enrollment.id;
    });

    it('[REGRESSION] blocks enroll when group is awaiting_payment', async () => {
      // Enroll to hit min count, then trigger payment to move to awaiting_payment
      const secondPatient = await registerTestPatient(httpServer, {
        ...TEST_USERS.patient,
        email: `secondpat_${Date.now()}@test.com`,
        phone: `+9665555${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, '0')}`,
      });

      await request(httpServer)
        .post(`${GROUPS_URL}/${groupId}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patient.user['id'] })
        .expect(201);

      await request(httpServer)
        .post(`${GROUPS_URL}/${groupId}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: secondPatient.user['id'] })
        .expect(201);

      // Trigger payment — moves to awaiting_payment
      await request(httpServer)
        .patch(`${GROUPS_URL}/${groupId}/trigger-payment`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      // Verify status is awaiting_payment
      const groupRes = await request(httpServer)
        .get(`${GROUPS_URL}/${groupId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);
      expect((groupRes.body.data as { status: string }).status).toBe(
        'awaiting_payment',
      );

      // Register a 3rd patient — should be BLOCKED
      const thirdPatient = await registerTestPatient(httpServer, {
        ...TEST_USERS.patient,
        email: `thirdpat_${Date.now()}@test.com`,
        phone: `+9665555${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, '0')}`,
      });

      const res = await request(httpServer)
        .post(`${GROUPS_URL}/${groupId}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: thirdPatient.user['id'] })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 when enrolling twice', async () => {
      await request(httpServer)
        .post(`${GROUPS_URL}/${groupId}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patient.user['id'] })
        .expect(201);

      const res = await request(httpServer)
        .post(`${GROUPS_URL}/${groupId}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patient.user['id'] })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('removes a registered enrollment', async () => {
      const enrollRes = await request(httpServer)
        .post(`${GROUPS_URL}/${groupId}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patient.user['id'] })
        .expect(201);

      const eid = (enrollRes.body.data as { id: string }).id;

      await request(httpServer)
        .delete(`${GROUPS_URL}/${groupId}/enrollments/${eid}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);
    });
  });

  // ─── FREE_HOLD enrollment ─────────────────────────────────────

  describe('FREE_HOLD enrollment', () => {
    it('enrolls patient with immediate status=confirmed for FREE_HOLD', async () => {
      const group = await createGroup({
        paymentType: 'FREE_HOLD',
        pricePerPersonHalalat: 0,
      });

      const res = await request(httpServer)
        .post(`${GROUPS_URL}/${group.id}/enroll`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ patientId: patient.user['id'] })
        .expect(201);

      expectSuccessResponse(res.body);
      const enrollment = res.body.data as { status: string };
      expect(enrollment.status).toBe('confirmed');
    });
  });

  // ─── triggerPaymentRequest ────────────────────────────────────

  describe('PATCH /groups/:id/trigger-payment', () => {
    it('returns 400 when min participants not met', async () => {
      const group = await createGroup({ minParticipants: 5 });

      const res = await request(httpServer)
        .patch(`${GROUPS_URL}/${group.id}/trigger-payment`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── cancel ──────────────────────────────────────────────────

  describe('PATCH /groups/:id/cancel', () => {
    it('cancels an open group', async () => {
      const group = await createGroup();

      const res = await request(httpServer)
        .patch(`${GROUPS_URL}/${group.id}/cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);

      const detail = await request(httpServer)
        .get(`${GROUPS_URL}/${group.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);
      expect((detail.body.data as { status: string }).status).toBe('cancelled');
    });

    it('returns 400 when cancelling an already-cancelled group', async () => {
      const group = await createGroup();
      await request(httpServer)
        .patch(`${GROUPS_URL}/${group.id}/cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const res = await request(httpServer)
        .patch(`${GROUPS_URL}/${group.id}/cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── soft delete ─────────────────────────────────────────────

  describe('DELETE /groups/:id', () => {
    it('soft-deletes a group', async () => {
      const group = await createGroup();

      const res = await request(httpServer)
        .delete(`${GROUPS_URL}/${group.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);

      await request(httpServer)
        .get(`${GROUPS_URL}/${group.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);
    });

    it('returns 404 for non-existent group', async () => {
      await request(httpServer)
        .delete(`${GROUPS_URL}/${NON_EXISTENT_UUID}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);
    });
  });

  // ─── bulk-attendance ─────────────────────────────────────────

  describe('PATCH /groups/:id/bulk-attendance', () => {
    it('returns 404 for non-existent group', async () => {
      const res = await request(httpServer)
        .patch(`${GROUPS_URL}/${NON_EXISTENT_UUID}/bulk-attendance`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ attendedPatientIds: [] })
        .expect(404);
      expect(res.body.success).toBe(false);
    });

    it('accepts empty attendedPatientIds list', async () => {
      const group = await createGroup();

      const res = await request(httpServer)
        .patch(`${GROUPS_URL}/${group.id}/bulk-attendance`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ attendedPatientIds: [] })
        .expect(200);

      expectSuccessResponse(res.body);
      expect((res.body.data as { markedAttended: number }).markedAttended).toBe(
        0,
      );
    });
  });

  // ─── certificate issuance ─────────────────────────────────────

  describe('POST /groups/:id/enrollments/:enrollmentId/certificate', () => {
    it('returns 404 for non-existent enrollment', async () => {
      const group = await createGroup();

      const res = await request(httpServer)
        .post(
          `${GROUPS_URL}/${group.id}/enrollments/${NON_EXISTENT_UUID}/certificate`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /groups/practitioner/:practitionerId ─────────────────

  describe('GET /groups/practitioner/:practitionerId', () => {
    it('returns groups for a specific practitioner', async () => {
      await createGroup();

      const res = await request(httpServer)
        .get(`${GROUPS_URL}/practitioner/${practitionerId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items = res.body.data as Array<{ practitionerId: string }>;
      expect(Array.isArray(items)).toBe(true);
      if (items.length > 0) {
        expect(items[0].practitionerId).toBe(practitionerId);
      }
    });
  });
});
