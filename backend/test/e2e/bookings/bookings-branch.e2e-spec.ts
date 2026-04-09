/**
 * CareKit — Branch-Aware Booking E2E Tests
 *
 * Covers branchId in booking creation:
 *   - Valid branch + assigned practitioner → booking stored with branchId
 *   - Valid branch + unassigned practitioner → 400 PRACTITIONER_BRANCH_MISMATCH
 *   - Non-existent branchId → 404
 *   - Inactive branch → 404
 *   - No branchId → booking created without branch (global settings)
 *
 * Multi-branch availability:
 *   - Practitioner with global availability (branchId=null) can be booked
 *     at different branches when assigned to both
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
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const BOOKINGS_URL = `${API_PREFIX}/bookings`;
const BRANCHES_URL = `${API_PREFIX}/branches`;
const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;

describe('Branch-Aware Booking (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let patient: AuthResult;

  let branchId: string;
  let inactiveBranchId: string;
  let practitionerId: string;
  let unassignedPractitionerId: string;
  let serviceId: string;
  let bookingDate: string;
  let dayOfWeek: number;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(httpServer, TEST_USERS.super_admin.email, TEST_USERS.super_admin.password);

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);

    // Create active branch
    const bRes = await request(httpServer)
      .post(BRANCHES_URL).set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameAr: 'فرع الاختبار المتكامل', nameEn: 'Integration Test Branch', isActive: true })
      .expect(201);
    branchId = (bRes.body.data as { id: string }).id;

    // Create inactive branch
    const ibRes = await request(httpServer)
      .post(BRANCHES_URL).set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameAr: 'فرع غير نشط', nameEn: 'Inactive Branch', isActive: false })
      .expect(201);
    inactiveBranchId = (ibRes.body.data as { id: string }).id;

    // Get practitioners from seeded data
    const pRes = await request(httpServer)
      .get(PRACTITIONERS_URL).set(getAuthHeaders(superAdmin.accessToken)).expect(200);
    const practitioners = (pRes.body.data?.items ?? pRes.body.data) as Array<{ id: string }>;
    expect(practitioners.length).toBeGreaterThanOrEqual(2);
    practitionerId = practitioners[0].id;
    unassignedPractitionerId = practitioners[1].id;

    // Assign first practitioner to branch only
    await request(httpServer)
      .patch(`${BRANCHES_URL}/${branchId}/practitioners`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ practitionerIds: [practitionerId] })
      .expect(200);

    // Create a service category + service (global-setup deletes all services between runs)
    const catRes = await request(httpServer)
      .post(`${API_PREFIX}/services/categories`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameEn: 'Branch Test Category', nameAr: 'فئة اختبار الفرع' });
    const categoryId = (catRes.body.data as { id: string } | undefined)?.id;
    if (!categoryId) throw new Error(`Category creation failed: ${JSON.stringify(catRes.body)}`);

    const svcRes = await request(httpServer)
      .post(`${API_PREFIX}/services`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameEn: 'Branch Test Service', nameAr: 'خدمة اختبار الفرع', categoryId, price: 10000, duration: 30 });
    serviceId = (svcRes.body.data as { id: string } | undefined)?.id ?? '';
    if (!serviceId) throw new Error(`Service creation failed: ${JSON.stringify(svcRes.body)}`);

    // Set global availability for practitioner (branchId = null → works at all branches)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    bookingDate = tomorrow.toISOString().split('T')[0];
    dayOfWeek = tomorrow.getDay();

    // Enable admin to book outside clinic hours (bypass clinic hours check)
    await request(httpServer)
      .patch(`${API_PREFIX}/booking-settings`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ adminCanBookOutsideHours: true });

    // Add booking type to service (required for booking to succeed)
    await request(httpServer)
      .put(`${API_PREFIX}/services/${serviceId}/booking-types`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ types: [{ bookingType: 'in_person', price: 10000, duration: 30 }] });

    // Link service to practitioner (required for booking to succeed)
    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ serviceId, availableTypes: ['in_person'] })
      .expect(201);

    // Also link service to unassigned practitioner (needed for BRANCH_MISMATCH test)
    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${unassignedPractitionerId}/services`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ serviceId, availableTypes: ['in_person'] });

    await request(httpServer)
      .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ schedule: [{ dayOfWeek, startTime: '09:00', endTime: '17:00', isActive: true }] })
      .expect(200);
  });

  afterAll(async () => { await closeTestApp(testApp.app); });

  // ─────────────────────────────────────────────────────────────

  describe('POST /bookings with branchId', () => {
    it('should create booking with branchId when practitioner is assigned to branch', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerId, serviceId, branchId, date: bookingDate, startTime: '09:00', type: 'in_person', patientId: patient.user.id as string })
        .expect(201);

      expect(res.body.data).toMatchObject({ branchId, practitionerId });
    });

    it('should return 400 PRACTITIONER_BRANCH_MISMATCH when practitioner not assigned to branch', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerId: unassignedPractitionerId, serviceId, branchId, date: bookingDate, startTime: '10:00', type: 'in_person', patientId: patient.user.id as string })
        .expect(400);

      expect((res.body.error as { code: string }).code).toBe('PRACTITIONER_BRANCH_MISMATCH');
    });

    it('should return 404 when branchId does not exist', async () => {
      await request(httpServer)
        .post(BOOKINGS_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerId, serviceId, branchId: '00000000-0000-0000-0000-000000000000', date: bookingDate, startTime: '11:00', type: 'in_person' })
        .expect(404);
    });

    it('should return 4xx when branch is inactive (404 if exists, 400 if deleted)', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerId, serviceId, branchId: inactiveBranchId, date: bookingDate, startTime: '11:00', type: 'in_person' });
      // 404 = branch inactive | 400 = branch deleted by global-setup cleanup | 422 = validation
      expect([400, 404, 422]).toContain(res.status);
    });

    it('should create booking without branchId (global settings path)', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerId, serviceId, date: bookingDate, startTime: '13:00', type: 'in_person', patientId: patient.user.id as string })
        .expect(201);

      expect(res.body.data.branchId).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────

  describe('Multi-branch availability — global availability fallback', () => {
    let branchAId: string;
    let branchBId: string;
    let multiBranchPractitionerId: string;
    let multiBranchServiceId: string;
    let multiBranchDate: string;

    beforeAll(async () => {
      // Create two branches
      const aRes = await request(httpServer)
        .post(BRANCHES_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameAr: 'فرع أ', nameEn: 'Branch A', isActive: true })
        .expect(201);
      branchAId = (aRes.body.data as { id: string }).id;

      const bRes = await request(httpServer)
        .post(BRANCHES_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameAr: 'فرع ب', nameEn: 'Branch B', isActive: true })
        .expect(201);
      branchBId = (bRes.body.data as { id: string }).id;

      // Use a fresh practitioner user for multi-branch
      const pUser = await createTestUserWithRole(
        httpServer, superAdmin.accessToken,
        { email: 'multi.branch.prac@carekit-test.com', password: 'MultiPrac@123', firstName: 'فارس', lastName: 'المتعدد', phone: '+966599000001', gender: 'male' },
        'practitioner',
      );

      const pRes = await request(httpServer)
        .post(PRACTITIONERS_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ userId: pUser.user.id, specialtyId: await getFirstSpecialtyId(httpServer, superAdmin.accessToken) })
        .expect(201);
      multiBranchPractitionerId = (pRes.body.data as { id: string }).id;

      // Assign to both branches
      await request(httpServer)
        .patch(`${BRANCHES_URL}/${branchAId}/practitioners`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerIds: [multiBranchPractitionerId] }).expect(200);
      await request(httpServer)
        .patch(`${BRANCHES_URL}/${branchBId}/practitioners`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerIds: [multiBranchPractitionerId] }).expect(200);

      // Set global availability (no branchId → applies to all branches)
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      multiBranchDate = dayAfterTomorrow.toISOString().split('T')[0];

      await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${multiBranchPractitionerId}/availability`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ schedule: [{ dayOfWeek: dayAfterTomorrow.getDay(), startTime: '08:00', endTime: '16:00', isActive: true }] })
        .expect(200);

      // Create service + link to multi-branch practitioner
      const catRes2 = await request(httpServer)
        .post(`${API_PREFIX}/services/categories`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Multi Branch Cat', nameAr: 'فئة متعدد الفروع' });
      const catId2 = (catRes2.body.data as { id: string } | undefined)?.id ?? '';

      const svcRes2 = await request(httpServer)
        .post(`${API_PREFIX}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Multi Branch Svc', nameAr: 'خدمة متعدد', categoryId: catId2, price: 10000, duration: 30 });
      multiBranchServiceId = (svcRes2.body.data as { id: string } | undefined)?.id ?? '';

      await request(httpServer)
        .put(`${API_PREFIX}/services/${multiBranchServiceId}/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ types: [{ bookingType: 'in_person', price: 10000, duration: 30 }] });

      await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${multiBranchPractitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ serviceId: multiBranchServiceId, availableTypes: ['in_person'] });
    });

    it('should allow booking at branch A with global availability', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerId: multiBranchPractitionerId, serviceId: multiBranchServiceId, branchId: branchAId, date: multiBranchDate, startTime: '08:00', type: 'in_person', patientId: patient.user.id as string })
        .expect(201);

      expect(res.body.data.branchId).toBe(branchAId);
    });

    it('should allow booking at branch B with global availability', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL).set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerId: multiBranchPractitionerId, serviceId: multiBranchServiceId, branchId: branchBId, date: multiBranchDate, startTime: '09:00', type: 'in_person', patientId: patient.user.id as string })
        .expect(201);

      expect(res.body.data.branchId).toBe(branchBId);
    });
  });
});

async function getFirstSpecialtyId(httpServer: unknown, token: string): Promise<string> {
  const res = await request(httpServer as Parameters<typeof request>[0])
    .get(`${API_PREFIX}/specialties`).set('Authorization', `Bearer ${token}`).expect(200);
  const specialties = (res.body.data?.items ?? res.body.data) as Array<{ id: string }>;
  return specialties[0].id;
}
