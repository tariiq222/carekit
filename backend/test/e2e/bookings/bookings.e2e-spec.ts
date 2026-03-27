/**
 * CareKit — Bookings Module E2E Tests (TDD RED Phase)
 *
 * Tests all booking endpoints per docs/api-spec.md:
 *   GET    /bookings              — list (PERMISSION:bookings:view, paginated)
 *   GET    /bookings/:id          — details (PERMISSION:bookings:view or OWNER)
 *   POST   /bookings              — create (PERMISSION:bookings:create or ROLE:patient)
 *   PATCH  /bookings/:id          — reschedule (PERMISSION:bookings:edit)
 *   POST   /bookings/:id/confirm  — confirm (PERMISSION:bookings:edit)
 *   POST   /bookings/:id/complete — complete (PERMISSION:bookings:edit)
 *   POST   /bookings/:id/cancel-request — patient request (OWNER)
 *   POST   /bookings/:id/cancel/approve — admin approve (PERMISSION:bookings:edit)
 *   POST   /bookings/:id/cancel/reject  — admin reject (PERMISSION:bookings:edit)
 *   GET    /bookings/my           — patient's own bookings (JWT patient)
 *   GET    /bookings/today        — practitioner's today bookings (JWT practitioner)
 *
 * Permission matrix (bookings module):
 *   super_admin  → view, create, edit, delete
 *   receptionist → view, create, edit
 *   accountant   → view
 *   practitioner → own (view own bookings)
 *   patient      → own (view own) + create
 *
 * These tests will FAIL until backend-dev implements the bookings module.
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
  expectValidationError,
  TEST_USERS,
  TEST_PATIENT_2,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const BOOKINGS_URL = `${API_PREFIX}/bookings`;

describe('Bookings Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let accountant: AuthResult;
  let practitionerAuth: AuthResult;
  let patient: AuthResult;
  let patient2: AuthResult;

  // IDs populated during setup / tests
  let practitionerId: string;
  let serviceId: string;
  let bookingId: string;
  let patient2BookingId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    // Login super_admin (seeded)
    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    // Create staff users
    receptionist = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.receptionist,
      'receptionist',
    );

    accountant = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.accountant,
      'accountant',
    );

    practitionerAuth = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.practitioner,
      'practitioner',
    );

    // Register patients
    patient = await registerTestPatient(httpServer);
    patient2 = await registerTestPatient(httpServer, TEST_PATIENT_2);

    // Discover practitioner and service IDs from existing data
    // (created by seed or prior test suites)
    const practRes = await request(httpServer)
      .get(`${API_PREFIX}/practitioners`)
      .expect(200);

    if (practRes.body.data?.items?.length > 0) {
      practitionerId = practRes.body.data.items[0].id;
    } else if (practRes.body.data?.length > 0) {
      practitionerId = practRes.body.data[0].id;
    }

    const servRes = await request(httpServer)
      .get(`${API_PREFIX}/services`)
      .expect(200);

    if (servRes.body.data?.items?.length > 0) {
      serviceId = servRes.body.data.items[0].id;
    } else if (servRes.body.data?.length > 0) {
      serviceId = servRes.body.data[0].id;
    }

    // If no service exists, create a category and service for the tests
    if (!serviceId) {
      const catRes = await request(httpServer)
        .post(`${API_PREFIX}/services/categories`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'General', nameAr: 'عام' })
        .expect(201);

      const categoryId =
        catRes.body.data?.id ?? catRes.body.id;

      const svcRes = await request(httpServer)
        .post(`${API_PREFIX}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'General Consultation',
          nameAr: 'استشارة عامة',
          categoryId,
          price: 15000,
          duration: 30,
        })
        .expect(201);

      serviceId = svcRes.body.data?.id ?? svcRes.body.id;
    }
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ─────────────────────────────────────────────────────────────
  // POST /bookings — Create Booking
  // ─────────────────────────────────────────────────────────────

  describe('POST /bookings', () => {
    const futureDate = '2026-06-01'; // well in the future

    it('should create a clinic_visit booking as patient', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: futureDate,
          startTime: '09:00',
          notes: 'أول زيارة',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('type', 'clinic_visit');
      expect(res.body.data).toHaveProperty('status', 'pending');
      expect(res.body.data).toHaveProperty('startTime', '09:00');
      expect(res.body.data).toHaveProperty('endTime'); // auto-calculated from service duration
      expect(res.body.data).toHaveProperty('practitioner');
      expect(res.body.data).toHaveProperty('service');

      bookingId = res.body.data.id as string;
    });

    it('should create a phone_consultation booking', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'phone_consultation',
          date: futureDate,
          startTime: '11:00',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('type', 'phone_consultation');
      // Phone consultation should NOT have Zoom links
      expect(res.body.data.zoomJoinUrl).toBeNull();
      expect(res.body.data.zoomHostUrl).toBeNull();
    });

    it('should create a video_consultation booking with Zoom links', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'video_consultation',
          date: futureDate,
          startTime: '14:00',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('type', 'video_consultation');
      expect(res.body.data).toHaveProperty('zoomJoinUrl');
      expect(res.body.data).toHaveProperty('zoomHostUrl');
      expect(typeof res.body.data.zoomJoinUrl).toBe('string');
      expect(typeof res.body.data.zoomHostUrl).toBe('string');
    });

    it('should create a booking as receptionist (has bookings:create)', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: futureDate,
          startTime: '16:00',
        })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should create a booking as super_admin', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: '2026-06-02',
          startTime: '09:00',
        })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should reject booking without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: futureDate,
          startTime: '10:00',
        })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject booking by accountant (403 — no bookings:create)', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(accountant.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: futureDate,
          startTime: '10:00',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject booking by practitioner (403 — no bookings:create)', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: futureDate,
          startTime: '10:00',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject booking without required fields', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({})
        .expect(400);

      expectValidationError(res.body, [
        'practitionerId',
        'serviceId',
        'type',
        'date',
        'startTime',
      ]);
    });

    it('should reject booking with invalid booking type', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'invalid_type',
          date: futureDate,
          startTime: '09:00',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject booking with invalid date format', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: '01-06-2026', // Wrong format
          startTime: '09:00',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject booking with invalid time format', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: futureDate,
          startTime: '9am', // Wrong format
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject booking with non-existent practitioner', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId: '00000000-0000-0000-0000-000000000000',
          serviceId,
          type: 'clinic_visit',
          date: futureDate,
          startTime: '09:00',
        })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should reject booking with non-existent service', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId: '00000000-0000-0000-0000-000000000000',
          type: 'clinic_visit',
          date: futureDate,
          startTime: '09:00',
        })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should reject booking in the past', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: '2024-01-01',
          startTime: '09:00',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject double-booking (409 Conflict)', async () => {
      // Create second booking at same time as bookingId (09:00 on futureDate)
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient2.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: futureDate,
          startTime: '09:00',
        })
        .expect(409);

      expectErrorResponse(res.body, 'BOOKING_CONFLICT');
    });

    it('should allow patient2 to book at a different time', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient2.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: futureDate,
          startTime: '10:00',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      patient2BookingId = res.body.data.id as string;
    });

    it('should auto-calculate endTime from service duration', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      // If service duration is 30 min and startTime is 09:00, endTime should be 09:30
      expect(res.body.data).toHaveProperty('endTime');
      expect(typeof res.body.data.endTime).toBe('string');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /bookings — List Bookings (PERMISSION:bookings:view)
  // ─────────────────────────────────────────────────────────────

  describe('GET /bookings', () => {
    it('should return paginated bookings as super_admin', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
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

    it('should return bookings as receptionist (has bookings:view)', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should return bookings as accountant (has bookings:view)', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject listing without authentication (401)', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should filter by status', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .query({ status: 'pending' })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const items = res.body.data.items as Array<{ status: string }>;
      for (const item of items) {
        expect(item.status).toBe('pending');
      }
    });

    it('should filter by type', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .query({ type: 'clinic_visit' })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const items = res.body.data.items as Array<{ type: string }>;
      for (const item of items) {
        expect(item.type).toBe('clinic_visit');
      }
    });

    it('should filter by practitionerId', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .query({ practitionerId })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items = res.body.data.items as Array<{
        practitioner: { id: string };
      }>;
      for (const item of items) {
        expect(item.practitioner.id).toBe(practitionerId);
      }
    });

    it('should filter by date range (dateFrom + dateTo)', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .query({
          dateFrom: '2026-06-01',
          dateTo: '2026-06-30',
        })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should apply pagination', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .query({ page: 1, perPage: 2 })
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(res.body.data.meta.perPage).toBe(2);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
    });

    it('should return bookings with correct shape', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const items = res.body.data.items as Array<Record<string, unknown>>;
      for (const item of items) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('startTime');
        expect(item).toHaveProperty('endTime');
        expect(item).toHaveProperty('status');
        expect(item).toHaveProperty('practitioner');
        expect(item).toHaveProperty('service');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /bookings/:id — Booking Details
  // ─────────────────────────────────────────────────────────────

  describe('GET /bookings/:id', () => {
    it('should return booking details as super_admin', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id', bookingId);
      expect(res.body.data).toHaveProperty('type');
      expect(res.body.data).toHaveProperty('date');
      expect(res.body.data).toHaveProperty('startTime');
      expect(res.body.data).toHaveProperty('endTime');
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('practitioner');
      expect(res.body.data).toHaveProperty('service');
      expect(res.body.data).toHaveProperty('patient');
    });

    it('should return booking details to the owning patient', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id', bookingId);
    });

    it('should reject access by non-owning patient (403)', async () => {
      // patient2 tries to view patient's booking
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return own booking to the assigned practitioner', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject access without authentication (401)', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${bookingId}`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 404 for non-existent booking', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /bookings/my — Patient's Own Bookings
  // ─────────────────────────────────────────────────────────────

  describe('GET /bookings/my', () => {
    it('should return only the patient\'s own bookings', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/my`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data.items || res.body.data)).toBe(true);

      const items = (res.body.data.items || res.body.data) as Array<{
        patient: { id: string };
      }>;
      for (const item of items) {
        expect(item.patient.id).toBe(patient.user.id);
      }
    });

    it('should return different bookings for patient2', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/my`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items = (res.body.data.items || res.body.data) as Array<{
        patient: { id: string };
      }>;
      for (const item of items) {
        expect(item.patient.id).toBe(patient2.user.id);
      }
    });

    it('should reject without authentication (401)', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/my`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /bookings/today — Practitioner's Today Bookings
  // ─────────────────────────────────────────────────────────────

  describe('GET /bookings/today', () => {
    it('should return today\'s bookings for the practitioner', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/today`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data.items || res.body.data)).toBe(true);
    });

    it('should reject for non-practitioner user (403)', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/today`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject without authentication (401)', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/today`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /bookings/:id — Reschedule (PERMISSION:bookings:edit)
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /bookings/:id (Reschedule)', () => {
    it('should reschedule a booking as super_admin', async () => {
      const res = await request(httpServer)
        .patch(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          date: '2026-06-03',
          startTime: '10:00',
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('date');
      expect(res.body.data).toHaveProperty('startTime', '10:00');
    });

    it('should reschedule as receptionist (has bookings:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          date: '2026-06-04',
          startTime: '11:00',
        })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject reschedule by patient (403 — no bookings:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          date: '2026-06-05',
          startTime: '09:00',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject reschedule by accountant (403 — no bookings:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({
          date: '2026-06-05',
          startTime: '09:00',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject reschedule without authentication (401)', async () => {
      const res = await request(httpServer)
        .patch(`${BOOKINGS_URL}/${bookingId}`)
        .send({ date: '2026-06-05', startTime: '09:00' })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject reschedule to a conflicting time (409)', async () => {
      // patient2BookingId is at 10:00 on 2026-06-01
      // Try to move bookingId to same practitioner + same date + same time
      const res = await request(httpServer)
        .patch(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          date: '2026-06-01',
          startTime: '10:00',
        })
        .expect(409);

      expectErrorResponse(res.body, 'BOOKING_CONFLICT');
    });

    it('should return 404 for non-existent booking', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .patch(`${BOOKINGS_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ date: '2026-06-05', startTime: '09:00' })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /bookings/:id/confirm — Confirm Booking
  // ─────────────────────────────────────────────────────────────

  describe('POST /bookings/:id/confirm', () => {
    it('should confirm a pending booking as super_admin', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${bookingId}/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'confirmed');
      expect(res.body.data).toHaveProperty('confirmedAt');
    });

    it('should confirm a booking as receptionist (has bookings:edit)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${patient2BookingId}/confirm`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'confirmed');
    });

    it('should reject confirm by patient (403 — no bookings:edit)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${bookingId}/confirm`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject confirm without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${bookingId}/confirm`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject confirming an already confirmed booking (409)', async () => {
      // bookingId was confirmed above
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${bookingId}/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(409);

      expectErrorResponse(res.body, 'CONFLICT');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /bookings/:id/complete — Mark as Completed
  // ─────────────────────────────────────────────────────────────

  describe('POST /bookings/:id/complete', () => {
    it('should complete a confirmed booking as super_admin', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${bookingId}/complete`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'completed');
      expect(res.body.data).toHaveProperty('completedAt');
    });

    it('should reject completing a pending booking (must be confirmed first)', async () => {
      // Create a new pending booking for this test
      const newBookingRes = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: '2026-07-01',
          startTime: '09:00',
        })
        .expect(201);

      const pendingBookingId = newBookingRes.body.data.id;

      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingBookingId}/complete`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(409);

      expectErrorResponse(res.body, 'CONFLICT');
    });

    it('should reject complete by patient (403)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${patient2BookingId}/complete`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject complete without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${bookingId}/complete`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /bookings/:id/cancel-request — Patient Requests Cancellation (OWNER)
  // ─────────────────────────────────────────────────────────────

  describe('POST /bookings/:id/cancel-request', () => {
    let cancellableBookingId: string;

    beforeAll(async () => {
      // Create a fresh booking for cancellation flow
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: '2026-08-01',
          startTime: '09:00',
        })
        .expect(201);

      cancellableBookingId = res.body.data.id as string;

      // Confirm it first
      await request(httpServer)
        .post(`${BOOKINGS_URL}/${cancellableBookingId}/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);
    });

    it('should submit cancellation request as the owning patient', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${cancellableBookingId}/cancel-request`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ reason: 'تعارض في الجدول' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'pending_cancellation');
      expect(res.body.data).toHaveProperty('cancellationReason', 'تعارض في الجدول');
      expect(res.body).toHaveProperty('message');
    });

    it('should reject cancellation request by non-owning patient (403)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${cancellableBookingId}/cancel-request`)
        .set(getAuthHeaders(patient2.accessToken))
        .send({ reason: 'Not my booking' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject cancellation request without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${cancellableBookingId}/cancel-request`)
        .send({ reason: 'test' })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject cancellation request on already pending_cancellation booking (409)', async () => {
      // Already submitted above
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${cancellableBookingId}/cancel-request`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ reason: 'Duplicate request' })
        .expect(409);

      expectErrorResponse(res.body, 'CONFLICT');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /bookings/:id/cancel/approve — Admin Approves Cancellation
  // ─────────────────────────────────────────────────────────────

  describe('POST /bookings/:id/cancel/approve', () => {
    let approvalBookingId: string;

    beforeAll(async () => {
      // Create booking → confirm → cancel-request
      const createRes = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'phone_consultation',
          date: '2026-09-01',
          startTime: '09:00',
        })
        .expect(201);

      approvalBookingId = createRes.body.data.id;

      await request(httpServer)
        .post(`${BOOKINGS_URL}/${approvalBookingId}/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      await request(httpServer)
        .post(`${BOOKINGS_URL}/${approvalBookingId}/cancel-request`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ reason: 'Schedule conflict' })
        .expect(200);
    });

    it('should approve cancellation with full refund as super_admin', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${approvalBookingId}/cancel/approve`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          refundType: 'full',
          adminNotes: 'Approved per clinic policy',
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'cancelled');
      expect(res.body.data).toHaveProperty('cancelledAt');
      expect(res.body).toHaveProperty('message');
    });

    it('should reject approval by patient (403)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${approvalBookingId}/cancel/approve`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ refundType: 'full' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject approval without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${approvalBookingId}/cancel/approve`)
        .send({ refundType: 'full' })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject approval with invalid refundType', async () => {
      // Create another booking with pending_cancellation
      const createRes = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient2.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: '2026-09-02',
          startTime: '09:00',
        })
        .expect(201);

      const bId = createRes.body.data.id;

      await request(httpServer)
        .post(`${BOOKINGS_URL}/${bId}/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      await request(httpServer)
        .post(`${BOOKINGS_URL}/${bId}/cancel-request`)
        .set(getAuthHeaders(patient2.accessToken))
        .send({ reason: 'Test' })
        .expect(200);

      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${bId}/cancel/approve`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ refundType: 'invalid_type' })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should accept partial and none refund types', async () => {
      // Create booking for partial refund test
      const createRes = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: '2026-09-10',
          startTime: '09:00',
        })
        .expect(201);

      const bId = createRes.body.data.id;

      await request(httpServer)
        .post(`${BOOKINGS_URL}/${bId}/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      await request(httpServer)
        .post(`${BOOKINGS_URL}/${bId}/cancel-request`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ reason: 'Change of plans' })
        .expect(200);

      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${bId}/cancel/approve`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          refundType: 'partial',
          adminNotes: 'Partial refund — late cancellation',
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'cancelled');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /bookings/:id/cancel/reject — Admin Rejects Cancellation
  // ─────────────────────────────────────────────────────────────

  describe('POST /bookings/:id/cancel/reject', () => {
    let rejectBookingId: string;

    beforeAll(async () => {
      const createRes = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: '2026-10-01',
          startTime: '09:00',
        })
        .expect(201);

      rejectBookingId = createRes.body.data.id;

      await request(httpServer)
        .post(`${BOOKINGS_URL}/${rejectBookingId}/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      await request(httpServer)
        .post(`${BOOKINGS_URL}/${rejectBookingId}/cancel-request`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ reason: 'Want to cancel' })
        .expect(200);
    });

    it('should reject cancellation request as super_admin (status back to confirmed)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${rejectBookingId}/cancel/reject`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ adminNotes: 'Cannot cancel within 24 hours of appointment' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'confirmed');
    });

    it('should reject by patient (403)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${rejectBookingId}/cancel/reject`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ adminNotes: 'test' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${rejectBookingId}/cancel/reject`)
        .send({ adminNotes: 'test' })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject rejecting a booking not in pending_cancellation state (409)', async () => {
      // rejectBookingId is now back to 'confirmed'
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${rejectBookingId}/cancel/reject`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ adminNotes: 'Invalid state' })
        .expect(409);

      expectErrorResponse(res.body, 'CONFLICT');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Security & Edge Cases
  // ─────────────────────────────────────────────────────────────

  describe('Security & Edge Cases', () => {
    it('should not expose internal fields (deletedAt, zoom credentials) in list', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const items = res.body.data.items as Array<Record<string, unknown>>;
      for (const item of items) {
        expect(item).not.toHaveProperty('deletedAt');
        expect(item).not.toHaveProperty('zoomMeetingId');
      }
    });

    it('should store dates in UTC (ISO 8601)', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${bookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const date = res.body.data.date as string;
      // ISO 8601 format check
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return 400 for invalid UUID format in path', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/not-a-uuid`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should handle expired JWT token (401)', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .set(getAuthHeaders('expired.jwt.token'))
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });
});
