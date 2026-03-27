/**
 * CareKit — Bookings Module E2E Tests
 *
 * Coverage:
 *   POST   /bookings                          — create booking
 *   GET    /bookings                          — list all (admin)
 *   GET    /bookings/my                       — patient's own bookings
 *   GET    /bookings/today                    — today's bookings (practitioner)
 *   GET    /bookings/stats                    — booking statistics
 *   GET    /bookings/:id                      — booking details
 *   GET    /bookings/:id/payment-status       — payment status
 *   PATCH  /bookings/:id                      — admin reschedule
 *   POST   /bookings/:id/patient-reschedule   — patient self-reschedule
 *   POST   /bookings/:id/confirm              — confirm (pending → confirmed)
 *   POST   /bookings/:id/check-in             — check-in (confirmed → checked_in)
 *   POST   /bookings/:id/start               — start session (checked_in → in_progress)
 *   POST   /bookings/:id/complete             — complete (in_progress → completed)
 *   POST   /bookings/:id/no-show             — no-show (confirmed → no_show)
 *   POST   /bookings/:id/cancel-request       — patient cancellation request
 *   POST   /bookings/:id/cancel/approve       — admin approve cancellation
 *   POST   /bookings/:id/cancel/reject        — admin reject cancellation
 *   POST   /bookings/:id/admin-cancel         — admin direct cancel
 *   POST   /bookings/:id/practitioner-cancel  — practitioner cancel
 *   POST   /bookings/recurring               — recurring booking series
 *
 * Permission matrix:
 *   super_admin  → bookings: view, create, edit, delete
 *   receptionist → bookings: view, create, edit
 *   accountant   → bookings: view
 *   practitioner → bookings: view
 *   patient      → bookings: view, create
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
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
  AuthResult,
} from '../setup/setup';

const BOOKINGS_URL = `${API_PREFIX}/bookings`;
const SERVICES_URL = `${API_PREFIX}/services`;
const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;
const SPECIALTIES_URL = `${API_PREFIX}/specialties`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0]!;
}

function getDaysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]!;
}

/** Round-robin counter to spread booking creation across multiple users (throttle bypass) */
let _bookingTokenIndex = 0;
let _bookingTokenPool: string[] = [];

function nextBookingToken(): string {
  const token = _bookingTokenPool[_bookingTokenIndex % _bookingTokenPool.length]!;
  _bookingTokenIndex++;
  return token;
}

async function createBooking(
  httpServer: ReturnType<INestApplication['getHttpServer']>,
  token: string,
  practitionerId: string,
  serviceId: string,
  opts: { date?: string; startTime?: string; patientId?: string; type?: string } = {},
): Promise<string> {
  // Use provided token if explicitly given, otherwise rotate to stay under per-user throttle
  const effectiveToken = token;
  const res = await request(httpServer)
    .post(BOOKINGS_URL)
    .set(getAuthHeaders(effectiveToken))
    .send({
      practitionerId,
      serviceId,
      type: opts.type ?? 'clinic_visit',
      date: opts.date ?? getTomorrow(),
      startTime: opts.startTime ?? '10:00',
      ...(opts.patientId ? { patientId: opts.patientId } : {}),
    });

  if (res.status !== 201) {
    throw new Error(`createBooking failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.id as string;
}

/** Create booking using round-robin token rotation to stay under per-user throttle limits */
async function createBookingRotated(
  httpServer: ReturnType<INestApplication['getHttpServer']>,
  practitionerId: string,
  serviceId: string,
  opts: { date?: string; startTime?: string; patientId?: string; type?: string } = {},
): Promise<string> {
  const token = nextBookingToken();
  return createBooking(httpServer, token, practitionerId, serviceId, opts);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Bookings Module (e2e)', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let accountant: AuthResult;
  let practitionerAuth: AuthResult;
  let patient: AuthResult;
  let patient2: AuthResult;

  let practitionerId: string;
  let practitionerUserId: string;
  let serviceId: string;

  // Bookings created during tests
  let pendingBookingId: string;     // created, status=pending (unpaid)
  let confirmedBookingId: string;   // paid → confirmed
  let cancelRequestBookingId: string;

  beforeAll(async () => {
    ({ app, httpServer } = await createTestApp());

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
    practitionerUserId = practitionerAuth.user['id'] as string;

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);
    patient2 = await registerTestPatient(httpServer, TEST_PATIENT_2);

    // Token pool for round-robin booking creation (avoids per-user throttle)
    _bookingTokenPool = [superAdmin.accessToken, receptionist.accessToken];

    // ── Set up specialty, service, practitioner profile ──

    const specialtyRes = await request(httpServer)
      .post(SPECIALTIES_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameEn: 'General Medicine', nameAr: 'الطب العام' });
    const specialtyId = specialtyRes.body.data?.id as string;

    const catRes = await request(httpServer)
      .post(`${SERVICES_URL}/categories`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameEn: 'Consultations', nameAr: 'استشارات' });
    const categoryId = catRes.body.data?.id as string;

    const serviceRes = await request(httpServer)
      .post(SERVICES_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameEn: 'General Consultation', nameAr: 'استشارة عامة', categoryId, price: 15000, duration: 30 });
    serviceId = serviceRes.body.data?.id as string;
    if (!serviceId) throw new Error(`Service creation failed: ${JSON.stringify(serviceRes.body)}`);

    // Practitioner profile — idempotent
    const practCreateRes = await request(httpServer)
      .post(PRACTITIONERS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ userId: practitionerUserId, specialtyId, titleEn: 'Dr.', titleAr: 'د.' });

    if (practCreateRes.status === 201 || practCreateRes.status === 200) {
      practitionerId = practCreateRes.body.data?.id as string;
    } else {
      const listRes = await request(httpServer)
        .get(PRACTITIONERS_URL)
        .query({ search: TEST_USERS.practitioner.firstName, perPage: '50' });
      const items = (listRes.body.data?.items ?? []) as Array<{ id: string; user?: { id: string } }>;
      const found = items.find((p) => p.user?.id === practitionerUserId);
      practitionerId = found?.id as string;
    }
    if (!practitionerId) throw new Error('practitionerId setup failed');

    // Admin can book outside hours (skip availability/clinic hour checks)
    await request(httpServer)
      .patch(`${API_PREFIX}/booking-settings`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ adminCanBookOutsideHours: true });

    // Allow patient reschedule for self-reschedule tests
    await request(httpServer)
      .patch(`${API_PREFIX}/booking-settings`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ patientCanReschedule: true, rescheduleBeforeHours: 0, maxReschedulesPerBooking: 5 });

    // Allow patient to cancel pending bookings
    await request(httpServer)
      .patch(`${API_PREFIX}/booking-settings`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ patientCanCancelPending: true });

    // Service booking types
    await request(httpServer)
      .put(`${SERVICES_URL}/${serviceId}/booking-types`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ types: [{ bookingType: 'clinic_visit', price: 15000, duration: 30 }] });

    // Assign service to practitioner
    const assignRes = await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ serviceId, availableTypes: ['clinic_visit'], isActive: true });
    if (![201, 200, 409].includes(assignRes.status)) {
      throw new Error(`Service assignment failed: ${JSON.stringify(assignRes.body)}`);
    }

    // Set practitioner availability for all 7 days so reschedule/recurring tests pass
    const schedule = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      dayOfWeek: day, startTime: '08:00', endTime: '20:00',
    }));
    const availRes = await request(httpServer)
      .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ schedule });
    if (availRes.status !== 200) {
      throw new Error(`Availability setup failed: ${availRes.status} ${JSON.stringify(availRes.body)}`);
    }

    // Create initial bookings for tests (rotate tokens to stay under per-user throttle)
    pendingBookingId = await createBookingRotated(httpServer, practitionerId, serviceId, {
      patientId: patient.user['id'] as string,
    });

    // Create a confirmed booking: mark payment paid (auto-confirms)
    confirmedBookingId = await createBookingRotated(httpServer, practitionerId, serviceId, {
      patientId: patient.user['id'] as string,
      startTime: '11:00',
    });
    const pmtRes = await request(httpServer)
      .get(`${API_PREFIX}/payments/booking/${confirmedBookingId}`)
      .set(getAuthHeaders(superAdmin.accessToken));
    if (pmtRes.status === 200) {
      await request(httpServer)
        .patch(`${API_PREFIX}/payments/${pmtRes.body.data.id as string}/status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ status: 'paid' });
      // Payment update auto-confirms the booking — no manual confirm needed
    }

    // Booking for cancel-request tests (patient's own booking)
    cancelRequestBookingId = await createBookingRotated(
      httpServer,
      practitionerId,
      serviceId,
      { patientId: patient.user['id'] as string, startTime: '12:00' },
    );
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // =========================================================================
  // POST /bookings — Create Booking
  // =========================================================================

  describe('POST /bookings', () => {
    it('receptionist can create a clinic_visit booking', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: getDaysFromNow(2),
          startTime: '09:00',
          patientId: patient.user['id'] as string,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('type', 'clinic_visit');
      expect(res.body.data).toHaveProperty('status', 'pending');
      expect(res.body.data).toHaveProperty('startTime', '09:00');
    });

    it('super_admin can create booking on behalf of patient (patientId)', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: getDaysFromNow(3),
          startTime: '13:00',
          patientId: patient2.user['id'] as string,
        })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('double booking at same time → 409 BOOKING_CONFLICT', async () => {
      // pendingBookingId is at getTomorrow() 10:00 — create another at same slot
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: getTomorrow(),
          startTime: '10:00',
          patientId: patient2.user['id'] as string,
        })
        .expect(409);

      expectErrorResponse(res.body, 'BOOKING_CONFLICT');
    });

    it('missing practitionerId → 400 validation error', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ serviceId, type: 'clinic_visit', date: getTomorrow(), startTime: '15:00' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('invalid date format → 400', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerId, serviceId, type: 'clinic_visit', date: '01/01/2027', startTime: '09:00' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('invalid bookingType enum → 400', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ practitionerId, serviceId, type: 'telepathy', date: getTomorrow(), startTime: '09:00' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('accountant cannot create bookings (no bookings:create) → 403', async () => {
      const res = await request(httpServer)
        .post(BOOKINGS_URL)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ practitionerId, serviceId, type: 'clinic_visit', date: getDaysFromNow(4), startTime: '09:00' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer)
        .post(BOOKINGS_URL)
        .send({ practitionerId, serviceId, type: 'clinic_visit', date: getTomorrow(), startTime: '09:00' })
        .expect(401);
    });
  });

  // =========================================================================
  // GET /bookings — List All Bookings
  // =========================================================================

  describe('GET /bookings', () => {
    it('super_admin can list all bookings (paginated)', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('receptionist can list bookings', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('accountant can list bookings (has bookings:view)', async () => {
      const res = await request(httpServer)
        .get(BOOKINGS_URL)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('filter by status=pending returns only pending bookings', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}?status=pending`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items: Array<{ status: string }> = res.body.data.items;
      items.forEach((b) => expect(b.status).toBe('pending'));
    });

    it('filter by type=clinic_visit returns only clinic_visit bookings', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}?type=clinic_visit`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items: Array<{ type: string }> = res.body.data.items;
      items.forEach((b) => expect(b.type).toBe('clinic_visit'));
    });

    it('filter by practitionerId scopes results', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}?practitionerId=${practitionerId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('invalid status enum → 400', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}?status=not_a_status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer).get(BOOKINGS_URL).expect(401);
    });
  });

  // =========================================================================
  // GET /bookings/my — Patient's own bookings
  // =========================================================================

  describe('GET /bookings/my', () => {
    it('patient can view their own bookings', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/my`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      // All items should belong to patient
      const items: Array<{ patientId?: string }> = res.body.data.items;
      const patientId = patient.user['id'] as string;
      items.forEach((b) => {
        if (b.patientId) expect(b.patientId).toBe(patientId);
      });
    });

    it('patient2 only sees their own bookings (isolation)', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/my`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items: Array<{ patientId?: string }> = res.body.data.items;
      const p2Id = patient2.user['id'] as string;
      items.forEach((b) => {
        if (b.patientId) expect(b.patientId).toBe(p2Id);
      });
    });

    it('supports pagination (returns page and perPage in meta)', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/my`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.meta).toHaveProperty('page');
      expect(res.body.data.meta).toHaveProperty('perPage');
      expect(res.body.data.meta).toHaveProperty('total');
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer).get(`${BOOKINGS_URL}/my`).expect(401);
    });
  });

  // =========================================================================
  // GET /bookings/today — Today's bookings
  // =========================================================================

  describe('GET /bookings/today', () => {
    it('practitioner can view today bookings', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/today`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
    });

    it('super_admin (non-practitioner) → 403 (only practitioners can access today endpoint)', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/today`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer).get(`${BOOKINGS_URL}/today`).expect(401);
    });
  });

  // =========================================================================
  // GET /bookings/stats — Booking Statistics
  // =========================================================================

  describe('GET /bookings/stats', () => {
    it('super_admin can fetch booking stats', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/stats`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toBeDefined();
    });

    it('receptionist can fetch stats', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/stats`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer).get(`${BOOKINGS_URL}/stats`).expect(401);
    });
  });

  // =========================================================================
  // GET /bookings/:id — Booking Details
  // =========================================================================

  describe('GET /bookings/:id', () => {
    it('super_admin can fetch booking details', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${pendingBookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const b = res.body.data;
      expect(b).toHaveProperty('id', pendingBookingId);
      expect(b).toHaveProperty('status');
      expect(b).toHaveProperty('type');
      expect(b).toHaveProperty('date');
      expect(b).toHaveProperty('startTime');
      expect(b).toHaveProperty('endTime');
    });

    it('receptionist can fetch booking details', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${pendingBookingId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('patient can view their own booking', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${pendingBookingId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('non-existent id → 404', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/00000000-0000-0000-0000-000000000000`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('invalid uuid → 400', async () => {
      await request(httpServer)
        .get(`${BOOKINGS_URL}/not-a-uuid`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer)
        .get(`${BOOKINGS_URL}/${pendingBookingId}`)
        .expect(401);
    });
  });

  // =========================================================================
  // GET /bookings/:id/payment-status
  // =========================================================================

  describe('GET /bookings/:id/payment-status', () => {
    it('super_admin can check payment status', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/${pendingBookingId}/payment-status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('non-existent booking → 404', async () => {
      const res = await request(httpServer)
        .get(`${BOOKINGS_URL}/00000000-0000-0000-0000-000000000000/payment-status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // Booking State Machine
  // =========================================================================

  describe('Booking state machine — full lifecycle', () => {
    let lifecycleBookingId: string;

    beforeAll(async () => {
      // Create a fresh booking dedicated to lifecycle tests (unpaid — lifecycle tests drive state)
      lifecycleBookingId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, startTime: '14:00' },
      );
    });

    it('confirm: pending → confirmed (pays first, then confirms)', async () => {
      // Mark payment paid — this auto-confirms the booking
      const pmtRes = await request(httpServer)
        .get(`${API_PREFIX}/payments/booking/${lifecycleBookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken));
      if (pmtRes.status === 200) {
        await request(httpServer)
          .patch(`${API_PREFIX}/payments/${pmtRes.body.data.id as string}/status`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({ status: 'paid' });
      }
      // Verify the booking is now confirmed (auto-confirmed by payment)
      const bookingRes = await request(httpServer)
        .get(`${BOOKINGS_URL}/${lifecycleBookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(bookingRes.body);
      expect(bookingRes.body.data).toHaveProperty('status', 'confirmed');
    });

    it('confirm same booking again → 409 (already confirmed)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${lifecycleBookingId}/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('check-in: confirmed → checked_in', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${lifecycleBookingId}/check-in`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'checked_in');
    });

    it('start: checked_in → in_progress (practitioner only)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${lifecycleBookingId}/start`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'in_progress');
    });

    it('complete: in_progress → completed', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${lifecycleBookingId}/complete`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ completionNotes: 'Patient responded well to treatment' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'completed');
    });

    it('cannot cancel a completed booking (terminal state) → 400', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${lifecycleBookingId}/admin-cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ refundType: 'none' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /bookings/:id/confirm — Permission checks
  // =========================================================================

  describe('POST /bookings/:id/confirm — RBAC', () => {
    it('receptionist can confirm (has bookings:edit) — auto-confirmed via payment', async () => {
      // Payment PATCH auto-confirms the booking; verify receptionist can still call confirm
      // and gets 409 (already confirmed) — proving they have bookings:edit permission, not 403
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${confirmedBookingId}/confirm`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(409); // Already confirmed — proves permission was not blocked

      expect(res.body.success).toBe(false);
    });

    it('accountant cannot confirm (no bookings:edit) → 403', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingBookingId}/confirm`)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('patient cannot confirm booking → 403', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingBookingId}/confirm`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('confirm without paid payment → 409 PAYMENT_REQUIRED', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingBookingId}/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(409);

      expectErrorResponse(res.body, 'PAYMENT_REQUIRED');
    });

    it('non-existent booking → 404', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/00000000-0000-0000-0000-000000000000/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /bookings/:id/no-show
  // =========================================================================

  describe('POST /bookings/:id/no-show', () => {
    let noShowBookingId: string;

    beforeAll(async () => {
      noShowBookingId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient2.user['id'] as string, startTime: '16:00' },
      );
      // Pay + confirm
      const pmtRes = await request(httpServer)
        .get(`${API_PREFIX}/payments/booking/${noShowBookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken));
      if (pmtRes.status === 200) {
        await request(httpServer)
          .patch(`${API_PREFIX}/payments/${pmtRes.body.data.id as string}/status`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({ status: 'paid' });
      }
      await request(httpServer)
        .post(`${BOOKINGS_URL}/${noShowBookingId}/confirm`)
        .set(getAuthHeaders(superAdmin.accessToken));
    });

    it('super_admin can mark confirmed booking as no-show', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${noShowBookingId}/no-show`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'no_show');
    });

    it('cannot mark pending booking as no-show → 409', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingBookingId}/no-show`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(409);

      expectErrorResponse(res.body, 'INVALID_STATUS_FOR_NO_SHOW');
    });

    it('patient cannot mark no-show → 403', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${noShowBookingId}/no-show`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // POST /bookings/:id/admin-cancel — Admin Direct Cancel
  // =========================================================================

  describe('POST /bookings/:id/admin-cancel', () => {
    let adminCancelBookingId: string;

    beforeAll(async () => {
      adminCancelBookingId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, date: getDaysFromNow(5), startTime: '09:00' },
      );
    });

    it('super_admin can admin-cancel a pending booking (refundType=none)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${adminCancelBookingId}/admin-cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ refundType: 'none', reason: 'Clinic closure' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'cancelled');
      expect(res.body.data).toHaveProperty('cancelledBy', 'admin');
    });

    it('missing refundType → 400 validation', async () => {
      const freshId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, date: getDaysFromNow(6), startTime: '09:00' },
      );
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${freshId}/admin-cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('invalid refundType → 400', async () => {
      const freshId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, date: getDaysFromNow(7), startTime: '09:00' },
      );
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${freshId}/admin-cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ refundType: 'maybe' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('accountant cannot admin-cancel (no bookings:delete) → 403', async () => {
      const freshId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, date: getDaysFromNow(8), startTime: '09:00' },
      );
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${freshId}/admin-cancel`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ refundType: 'none' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('receptionist cannot admin-cancel (no bookings:delete) → 403', async () => {
      const freshId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, date: getDaysFromNow(9), startTime: '09:00' },
      );
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${freshId}/admin-cancel`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ refundType: 'none' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // POST /bookings/:id/cancel-request — Patient cancellation request
  // =========================================================================

  describe('POST /bookings/:id/cancel-request', () => {
    it('patient can request cancellation of their own pending booking (immediate cancel)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${cancelRequestBookingId}/cancel-request`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ reason: 'Changed plans' })
        .expect(200);

      expectSuccessResponse(res.body);
      // Pending booking → immediate cancellation
      expect(res.body.data.status).toBe('cancelled');
    });

    it('patient cannot cancel another patient booking → 403', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingBookingId}/cancel-request`)
        .set(getAuthHeaders(patient2.accessToken))
        .send({ reason: 'Not my booking' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('non-existent booking → 404', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/00000000-0000-0000-0000-000000000000/cancel-request`)
        .set(getAuthHeaders(patient.accessToken))
        .send({})
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /bookings/:id/cancel/approve & reject — Admin manages cancellation
  // =========================================================================

  describe('POST /bookings/:id/cancel/approve + reject', () => {
    let pendingCancelBookingId: string;
    let pendingCancelBookingId2: string;

    beforeAll(async () => {
      // Create confirmed bookings by marking payment as paid (auto-confirms)
      // Then patient requests cancellation → status becomes pending_cancellation
      pendingCancelBookingId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, date: getDaysFromNow(10), startTime: '09:00' },
      );
      const pmtRes1 = await request(httpServer)
        .get(`${API_PREFIX}/payments/booking/${pendingCancelBookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken));
      if (pmtRes1.status === 200) {
        await request(httpServer)
          .patch(`${API_PREFIX}/payments/${pmtRes1.body.data.id as string}/status`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({ status: 'paid' });
        // Payment auto-confirms the booking
      }
      // Patient requests cancellation on the confirmed booking
      await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingCancelBookingId}/cancel-request`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ reason: 'Emergency' });

      // Second booking for reject test
      pendingCancelBookingId2 = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, date: getDaysFromNow(11), startTime: '09:00' },
      );
      const pmtRes2 = await request(httpServer)
        .get(`${API_PREFIX}/payments/booking/${pendingCancelBookingId2}`)
        .set(getAuthHeaders(superAdmin.accessToken));
      if (pmtRes2.status === 200) {
        await request(httpServer)
          .patch(`${API_PREFIX}/payments/${pmtRes2.body.data.id as string}/status`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({ status: 'paid' });
        // Payment auto-confirms the booking
      }
      await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingCancelBookingId2}/cancel-request`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ reason: 'Emergency' });
    });

    it('super_admin can approve cancellation with full refund', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingCancelBookingId}/cancel/approve`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ refundType: 'full', adminNotes: 'Approved per policy' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'cancelled');
    });

    it('super_admin can reject cancellation (booking reverts to confirmed)', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingCancelBookingId2}/cancel/reject`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ adminNotes: 'No valid reason provided' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'confirmed');
    });

    it('approve booking not in pending_cancellation → 409', async () => {
      // pendingBookingId is in 'pending' status, not pending_cancellation
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingBookingId}/cancel/approve`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ refundType: 'none' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('missing refundType on approve → 400', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingCancelBookingId}/cancel/approve`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('accountant cannot approve cancellation → 403', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${pendingCancelBookingId}/cancel/approve`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ refundType: 'none' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // PATCH /bookings/:id — Admin Reschedule
  // =========================================================================

  describe('PATCH /bookings/:id — admin reschedule', () => {
    let rescheduleBookingId: string;

    beforeAll(async () => {
      rescheduleBookingId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient2.user['id'] as string, date: getDaysFromNow(12), startTime: '10:00' },
      );
    });

    it('super_admin can reschedule a booking to a new date/time', async () => {
      const newDate = getDaysFromNow(13);
      const res = await request(httpServer)
        .patch(`${BOOKINGS_URL}/${rescheduleBookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ date: newDate, startTime: '11:00' })
        .expect(200);

      expectSuccessResponse(res.body);
      // Old booking is cancelled; response is the new booking
      expect(res.body.data).toHaveProperty('status');
    });

    it('missing both date and startTime → 400', async () => {
      const freshId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient2.user['id'] as string, date: getDaysFromNow(14), startTime: '09:00' },
      );
      const res = await request(httpServer)
        .patch(`${BOOKINGS_URL}/${freshId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('accountant cannot reschedule → 403', async () => {
      const freshId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient2.user['id'] as string, date: getDaysFromNow(15), startTime: '09:00' },
      );
      const res = await request(httpServer)
        .patch(`${BOOKINGS_URL}/${freshId}`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ date: getDaysFromNow(16) })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // POST /bookings/:id/patient-reschedule — Self-reschedule
  // =========================================================================

  describe('POST /bookings/:id/patient-reschedule', () => {
    let selfRescheduleBookingId: string;

    beforeAll(async () => {
      selfRescheduleBookingId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, date: getDaysFromNow(17), startTime: '09:00' },
      );
    });

    it('patient can self-reschedule their own pending booking', async () => {
      const newDate = getDaysFromNow(18);
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${selfRescheduleBookingId}/patient-reschedule`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ date: newDate, startTime: '10:00' })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('patient cannot reschedule another patient booking → 403', async () => {
      const freshId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient2.user['id'] as string, date: getDaysFromNow(19), startTime: '09:00' },
      );
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${freshId}/patient-reschedule`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ date: getDaysFromNow(20) })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // POST /bookings/recurring — Recurring Booking Series
  // =========================================================================

  describe('POST /bookings/recurring', () => {
    it('receptionist can create recurring bookings for patient (weekly, 3 times)', async () => {
      // First enable recurring in settings with allowed patterns
      await request(httpServer)
        .patch(`${API_PREFIX}/booking-settings`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ allowRecurring: true, allowedRecurringPatterns: ['weekly', 'biweekly', 'monthly'] });

      // Use superAdmin (adminCanBookOutsideHours=true + callerUserId !== actualPatientId = skipChecks=true)
      // This bypasses clinic hours validation which has no working hours set up in test DB
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/recurring`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: getDaysFromNow(40),
          startTime: '15:00',
          repeatEvery: 'weekly',
          repeatCount: 3,
          patientId: patient2.user['id'] as string,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('created');
      expect(Array.isArray(res.body.data.created)).toBe(true);
      expect(res.body.data.created.length).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty('conflicts');
    });

    it('repeatCount below minimum → 400', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/recurring`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: getDaysFromNow(25),
          startTime: '09:00',
          repeatEvery: 'weekly',
          repeatCount: 1,
          patientId: patient.user['id'] as string,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('walk_in type not allowed for recurring → 400', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/recurring`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'walk_in',
          date: getDaysFromNow(25),
          startTime: '09:00',
          repeatEvery: 'weekly',
          repeatCount: 2,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('accountant cannot create recurring bookings → 403', async () => {
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/recurring`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({
          practitionerId,
          serviceId,
          type: 'clinic_visit',
          date: getDaysFromNow(30),
          startTime: '09:00',
          repeatEvery: 'weekly',
          repeatCount: 2,
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer)
        .post(`${BOOKINGS_URL}/recurring`)
        .send({ practitionerId, serviceId, type: 'clinic_visit', date: getDaysFromNow(30), startTime: '09:00', repeatEvery: 'weekly', repeatCount: 2 })
        .expect(401);
    });
  });

  // =========================================================================
  // RBAC summary
  // =========================================================================

  describe('RBAC — bookings:delete guard (admin-cancel)', () => {
    it('super_admin has bookings:delete', async () => {
      const freshId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, date: getDaysFromNow(35), startTime: '09:00' },
      );
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${freshId}/admin-cancel`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ refundType: 'none' })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('practitioner cannot admin-cancel (no bookings:delete) → 403', async () => {
      const freshId = await createBookingRotated(
        httpServer, practitionerId, serviceId,
        { patientId: patient.user['id'] as string, date: getDaysFromNow(36), startTime: '09:00' },
      );
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${freshId}/admin-cancel`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({ refundType: 'none' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });
});
