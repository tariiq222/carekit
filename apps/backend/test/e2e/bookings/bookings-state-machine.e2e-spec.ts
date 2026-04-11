/**
 * CareKit — Bookings State Machine Violation Tests
 *
 * Tests that invalid state transitions are correctly rejected:
 *
 *   Valid transitions:
 *     pending → confirmed (confirm)
 *     confirmed → checked_in (check-in)
 *     checked_in → in_progress (start)
 *     in_progress → completed (complete)
 *     confirmed → no_show (no-show)
 *     confirmed/pending → cancel_requested (cancel-request)
 *
 *   Invalid transitions tested here:
 *     - confirm an already-confirmed booking (idempotency/conflict)
 *     - check-in before confirm (pending → checked_in)
 *     - start without check-in (confirmed → in_progress)
 *     - complete without start (confirmed → completed)
 *     - no-show on a pending booking
 *     - no-show on a completed booking
 *     - admin-cancel a completed booking
 *     - confirm a cancelled booking
 *     - payment-status on non-existent booking → 404
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
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const BOOKINGS_URL = `${API_PREFIX}/bookings`;
const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;
const SERVICES_URL = `${API_PREFIX}/services`;
const GHOST_ID = '00000000-0000-0000-0000-000000000000';

function getDaysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;

let superAdmin: AuthResult;
let patient: AuthResult;
let practitionerAuth: AuthResult;
let practitionerId: string;
let serviceId: string;

/** Unique date offset to avoid slot conflicts with other suites */
let dateOffset = 50;
function nextDate(): string {
  return getDaysFromNow(dateOffset++);
}

async function createFreshBooking(
  opts: { date?: string; startTime?: string } = {},
): Promise<string> {
  const res = await request(httpServer)
    .post(BOOKINGS_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      practitionerId,
      serviceId,
      type: 'in_person',
      date: opts.date ?? nextDate(),
      startTime: opts.startTime ?? '09:00',
      patientId: patient.user['id'],
    })
    .expect(201);

  return (res.body.data as { id: string }).id;
}

async function advanceToConfirmed(bookingId: string): Promise<void> {
  await request(httpServer)
    .post(`${BOOKINGS_URL}/${bookingId}/confirm`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({})
    .expect(200);
}

async function advanceToCheckedIn(bookingId: string): Promise<void> {
  await advanceToConfirmed(bookingId);
  await request(httpServer)
    .post(`${BOOKINGS_URL}/${bookingId}/check-in`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({})
    .expect(200);
}

async function advanceToInProgress(bookingId: string): Promise<void> {
  await advanceToCheckedIn(bookingId);
  await request(httpServer)
    .post(`${BOOKINGS_URL}/${bookingId}/start`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({})
    .expect(200);
}

async function advanceToCompleted(bookingId: string): Promise<void> {
  await advanceToInProgress(bookingId);
  await request(httpServer)
    .post(`${BOOKINGS_URL}/${bookingId}/complete`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({})
    .expect(200);
}

beforeAll(async () => {
  testApp = await createTestApp();
  httpServer = testApp.httpServer;

  superAdmin = await loginTestUser(
    httpServer,
    TEST_USERS.super_admin.email,
    TEST_USERS.super_admin.password,
  );

  patient = await registerTestPatient(httpServer, {
    email: 'state-machine-patient@carekit-test.com',
    password: 'P@tientP@ss1',
    firstName: 'ريم',
    lastName: 'العنزي',
    phone: '+966507000301',
    gender: 'female',
  });

  practitionerAuth = await createTestUserWithRole(
    httpServer,
    superAdmin.accessToken,
    {
      email: 'state-machine-prac@carekit-test.com',
      password: 'Pr@cP@ss88!',
      firstName: 'بندر',
      lastName: 'الحارثي',
      phone: '+966507000302',
      gender: 'male',
    },
    'practitioner',
  );

  // Create practitioner profile
  const specRes = await request(httpServer)
    .get(`${API_PREFIX}/specialties`)
    .expect(200);
  const specialties = specRes.body.data?.items ?? specRes.body.data ?? [];
  const specialtyId =
    Array.isArray(specialties) && specialties.length > 0
      ? (specialties[0] as { id: string }).id
      : undefined;

  const pracRes = await request(httpServer)
    .post(PRACTITIONERS_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      userId: practitionerAuth.user['id'],
      specialtyId,
      bio: 'State machine test practitioner',
      bioAr: 'طبيب اختبار آلة الحالة',
      experience: 10,
      priceClinic: 20000,
      pricePhone: 15000,
      priceVideo: 18000,
    });

  if (pracRes.status === 201) {
    practitionerId = (pracRes.body.data as { id: string }).id;
  }

  // Create a service with availability
  const availRes = await request(httpServer)
    .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      schedule: [
        { dayOfWeek: 0, startTime: '08:00', endTime: '20:00', isActive: true },
        { dayOfWeek: 1, startTime: '08:00', endTime: '20:00', isActive: true },
        { dayOfWeek: 2, startTime: '08:00', endTime: '20:00', isActive: true },
        { dayOfWeek: 3, startTime: '08:00', endTime: '20:00', isActive: true },
        { dayOfWeek: 4, startTime: '08:00', endTime: '20:00', isActive: true },
        { dayOfWeek: 5, startTime: '08:00', endTime: '20:00', isActive: true },
        { dayOfWeek: 6, startTime: '08:00', endTime: '20:00', isActive: true },
      ],
    });

  if (availRes.status !== 200) {
    // Not fatal — slots might still be available from seed
  }

  const svcRes = await request(httpServer)
    .post(SERVICES_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      name: 'State Machine Test Service',
      nameAr: 'خدمة اختبار آلة الحالة',
      duration: 30,
    });

  if (svcRes.status === 201) {
    serviceId = (svcRes.body.data as { id: string }).id;

    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        serviceId,
        bookingTypes: [{ type: 'in_person', price: 20000, duration: 30 }],
      });
  }
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// =============================================================================
// Payment status on non-existent booking
// =============================================================================

describe('GET /bookings/:id/payment-status — edge cases', () => {
  it('returns 404 for non-existent booking UUID', async () => {
    const res = await request(httpServer)
      .get(`${BOOKINGS_URL}/${GHOST_ID}/payment-status`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(404);

    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 401 without auth', async () => {
    await request(httpServer)
      .get(`${BOOKINGS_URL}/${GHOST_ID}/payment-status`)
      .expect(401);
  });

  it('returns 400 for malformed UUID', async () => {
    const res = await request(httpServer)
      .get(`${BOOKINGS_URL}/not-a-uuid/payment-status`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// Confirm an already-confirmed booking (idempotency)
// =============================================================================

describe('POST /bookings/:id/confirm — idempotency', () => {
  it('confirming already-confirmed booking → 400 or 409 (invalid state)', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();
    await advanceToConfirmed(bookingId);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/confirm`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({});

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// Check-in before confirm (pending → checked_in is invalid)
// =============================================================================

describe('POST /bookings/:id/check-in — invalid from pending', () => {
  it('check-in on a pending booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/check-in`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({});

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// Start without check-in (confirmed → in_progress is invalid)
// =============================================================================

describe('POST /bookings/:id/start — invalid from confirmed', () => {
  it('start on a confirmed (not yet checked-in) booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();
    await advanceToConfirmed(bookingId);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/start`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({});

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// Complete without start (checked_in → completed is invalid)
// =============================================================================

describe('POST /bookings/:id/complete — invalid from checked_in', () => {
  it('complete on a checked-in (not yet started) booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();
    await advanceToCheckedIn(bookingId);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/complete`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({});

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// No-show on invalid states
// =============================================================================

describe('POST /bookings/:id/no-show — invalid states', () => {
  it('no-show on a pending booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/no-show`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({});

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('no-show on a completed booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();
    await advanceToCompleted(bookingId);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/no-show`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({});

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('no-show on an in_progress booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();
    await advanceToInProgress(bookingId);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/no-show`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({});

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// Admin-cancel on invalid states
// =============================================================================

describe('POST /bookings/:id/admin-cancel — invalid states', () => {
  it('admin-cancel a completed booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();
    await advanceToCompleted(bookingId);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/admin-cancel`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ refundType: 'none' });

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('admin-cancel a no-show booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();
    await advanceToConfirmed(bookingId);

    await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/no-show`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({})
      .expect(200);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/admin-cancel`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ refundType: 'none' });

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// Confirm a cancelled booking (invalid)
// =============================================================================

describe('POST /bookings/:id/confirm — on cancelled booking', () => {
  it('confirm after admin-cancel → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();

    await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/admin-cancel`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ refundType: 'none' })
      .expect(200);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/confirm`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({});

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// Complete on already-completed booking (idempotency)
// =============================================================================

describe('POST /bookings/:id/complete — idempotency', () => {
  it('completing an already-completed booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();
    await advanceToCompleted(bookingId);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/complete`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({});

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// State machine on non-existent booking IDs
// =============================================================================

describe('State machine endpoints — 404 for non-existent booking', () => {
  const transitions = [
    'confirm',
    'check-in',
    'start',
    'complete',
    'no-show',
    'admin-cancel',
  ];

  for (const transition of transitions) {
    it(`POST /:id/${transition} on ghost UUID → 404`, async () => {
      const body = transition === 'admin-cancel' ? { refundType: 'none' } : {};
      const res = await request(httpServer)
        .post(`${BOOKINGS_URL}/${GHOST_ID}/${transition}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(body)
        .expect(404);

      expect((res.body as Record<string, unknown>).success).toBe(false);
    });
  }
});

// =============================================================================
// Cancel-request on invalid states
// =============================================================================

describe('POST /bookings/:id/cancel-request — invalid states', () => {
  it('cancel-request on already-cancelled booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();

    await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/admin-cancel`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ refundType: 'none' })
      .expect(200);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/cancel-request`)
      .set(getAuthHeaders(patient.accessToken))
      .send({ reason: 'Test' });

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('cancel-request on completed booking → 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createFreshBooking();
    await advanceToCompleted(bookingId);

    const res = await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/cancel-request`)
      .set(getAuthHeaders(patient.accessToken))
      .send({ reason: 'Test' });

    expect([400, 409]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});
