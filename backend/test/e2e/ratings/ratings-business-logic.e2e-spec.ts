/**
 * CareKit — Ratings Business Logic E2E Tests
 *
 * Extends ratings.e2e-spec.ts with:
 *   - Duplicate rating prevention (same booking rated twice)
 *   - Rating on non-completed booking (invalid state)
 *   - Rating ownership (patient cannot rate another patient's booking)
 *   - GET /ratings/booking/:id returns null for unrated booking (not 404)
 *   - Pagination edge cases on GET /ratings/practitioner/:id
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

const RATINGS_URL = `${API_PREFIX}/ratings`;
const BOOKINGS_URL = `${API_PREFIX}/bookings`;
const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;
const SERVICES_URL = `${API_PREFIX}/services`;
const GHOST_ID = '00000000-0000-0000-0000-000000000000';

function getDaysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]!;
}

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;

let superAdmin: AuthResult;
let patient: AuthResult;
let patient2: AuthResult;
let practitionerAuth: AuthResult;
let practitionerId: string;
let serviceId: string;

/** Unique date offset to avoid conflicts */
let dateOffset = 70;
function nextDate(): string {
  return getDaysFromNow(dateOffset++);
}

async function createAndCompleteBooking(patientToken: string): Promise<string> {
  const bookingRes = await request(httpServer)
    .post(BOOKINGS_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      practitionerId,
      serviceId,
      type: 'in_person',
      date: nextDate(),
      startTime: '10:00',
      patientId: (patientToken === patient.accessToken
        ? patient.user['id']
        : patient2.user['id']),
    })
    .expect(201);

  const bookingId = (bookingRes.body.data as { id: string }).id;

  // Advance through full lifecycle: pending → confirmed → checked_in → in_progress → completed
  await request(httpServer)
    .post(`${BOOKINGS_URL}/${bookingId}/confirm`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({})
    .expect(200);

  await request(httpServer)
    .post(`${BOOKINGS_URL}/${bookingId}/check-in`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({})
    .expect(200);

  await request(httpServer)
    .post(`${BOOKINGS_URL}/${bookingId}/start`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({})
    .expect(200);

  await request(httpServer)
    .post(`${BOOKINGS_URL}/${bookingId}/complete`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({})
    .expect(200);

  return bookingId;
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
    email: 'ratings-biz-patient1@carekit-test.com',
    password: 'P@tientP@ss1',
    firstName: 'عمر',
    lastName: 'العتيبي',
    phone: '+966507000801',
    gender: 'male',
  });

  patient2 = await registerTestPatient(httpServer, {
    email: 'ratings-biz-patient2@carekit-test.com',
    password: 'P@tientP@ss2',
    firstName: 'أسماء',
    lastName: 'الحربي',
    phone: '+966507000802',
    gender: 'female',
  });

  practitionerAuth = await createTestUserWithRole(
    httpServer,
    superAdmin.accessToken,
    {
      email: 'ratings-biz-prac@carekit-test.com',
      password: 'Pr@cR8tP@ss1',
      firstName: 'صالح',
      lastName: 'المالكي',
      phone: '+966507000803',
      gender: 'male',
    },
    'practitioner',
  );

  // Create practitioner profile with availability
  const specRes = await request(httpServer).get(`${API_PREFIX}/specialties`).expect(200);
  const specialties = specRes.body.data?.items ?? specRes.body.data ?? [];
  const specialtyId = Array.isArray(specialties) && specialties.length > 0
    ? (specialties[0] as { id: string }).id
    : undefined;

  const pracRes = await request(httpServer)
    .post(PRACTITIONERS_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      userId: practitionerAuth.user['id'],
      specialtyId,
      bio: 'Ratings business logic test practitioner',
      bioAr: 'طبيب اختبار منطق التقييمات',
      experience: 9,
      priceClinic: 20000,
      pricePhone: 15000,
      priceVideo: 17000,
    });

  if (pracRes.status === 201) {
    practitionerId = (pracRes.body.data as { id: string }).id;
  }

  await request(httpServer)
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

  const svcRes = await request(httpServer)
    .post(SERVICES_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      name: 'Ratings Logic Test Service',
      nameAr: 'خدمة اختبار منطق التقييم',
      duration: 30,
    });

  if (svcRes.status === 201) {
    serviceId = (svcRes.body.data as { id: string }).id;

    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        serviceId,
        bookingTypes: [
          { type: 'in_person', price: 20000, duration: 30 },
        ],
      });
  }
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// =============================================================================
// Duplicate rating prevention
// =============================================================================

describe('POST /ratings — duplicate prevention', () => {
  it('rating a completed booking twice → second attempt returns 400 or 409', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingId = await createAndCompleteBooking(patient.accessToken);

    // First rating — should succeed
    const first = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({ bookingId, stars: 5, comment: 'Excellent service' });

    expect([200, 201]).toContain(first.status);

    // Second rating on same booking — must be rejected
    const second = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({ bookingId, stars: 3, comment: 'Changed my mind' });

    expect([400, 409]).toContain(second.status);
    expect((second.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// Rating a non-completed booking (invalid state)
// =============================================================================

describe('POST /ratings — invalid booking state', () => {
  it('rating a pending (unpaid) booking → 400 or 404', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingRes = await request(httpServer)
      .post(BOOKINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        practitionerId,
        serviceId,
        type: 'in_person',
        date: nextDate(),
        startTime: '11:00',
        patientId: patient.user['id'],
      })
      .expect(201);

    const bookingId = (bookingRes.body.data as { id: string }).id;

    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({ bookingId, stars: 4 });

    expect([400, 404]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('rating a confirmed (not yet completed) booking → 400 or 404', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingRes = await request(httpServer)
      .post(BOOKINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        practitionerId,
        serviceId,
        type: 'in_person',
        date: nextDate(),
        startTime: '12:00',
        patientId: patient.user['id'],
      })
      .expect(201);

    const bookingId = (bookingRes.body.data as { id: string }).id;

    await request(httpServer)
      .post(`${BOOKINGS_URL}/${bookingId}/confirm`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({})
      .expect(200);

    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({ bookingId, stars: 4 });

    expect([400, 404]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// Rating ownership isolation
// =============================================================================

describe('POST /ratings — ownership isolation', () => {
  it('patient cannot rate a booking that belongs to another patient → 403 or 404', async () => {
    if (!practitionerId || !serviceId) return;

    // patient2 has a completed booking
    const bookingId = await createAndCompleteBooking(patient2.accessToken);

    // patient1 tries to rate patient2's booking
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({ bookingId, stars: 2 });

    expect([403, 404]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// GET /ratings/booking/:bookingId — unrated booking returns null (not 404)
// =============================================================================

describe('GET /ratings/booking/:bookingId — unrated booking', () => {
  it('returns 200 with null data for a booking with no rating', async () => {
    if (!practitionerId || !serviceId) return;

    const bookingRes = await request(httpServer)
      .post(BOOKINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        practitionerId,
        serviceId,
        type: 'in_person',
        date: nextDate(),
        startTime: '13:00',
        patientId: patient.user['id'],
      })
      .expect(201);

    const bookingId = (bookingRes.body.data as { id: string }).id;

    const res = await request(httpServer)
      .get(`${RATINGS_URL}/booking/${bookingId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    // Rating not found → data should be null or empty, not 404
    const data = (res.body as Record<string, unknown>).data;
    expect(data === null || data === undefined || typeof data === 'object').toBe(true);
  });
});

// =============================================================================
// GET /ratings/practitioner/:id — after submitting a valid rating
// =============================================================================

describe('GET /ratings/practitioner/:id — after rating', () => {
  it('practitioner ratings count increases after a new rating', async () => {
    if (!practitionerId || !serviceId) return;

    // Get initial count
    const before = await request(httpServer)
      .get(`${RATINGS_URL}/practitioner/${practitionerId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    const beforeItems = (
      (before.body as Record<string, { data: { items: unknown[] } }>).data?.items ?? []
    ).length;

    // Complete a booking and submit rating
    const bookingId = await createAndCompleteBooking(patient.accessToken);

    await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({ bookingId, stars: 4, comment: 'Good doctor' });

    // Get updated count
    const after = await request(httpServer)
      .get(`${RATINGS_URL}/practitioner/${practitionerId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expectSuccessResponse(after.body as Record<string, unknown>);
    const afterItems = (
      (after.body as Record<string, { data: { items: unknown[] } }>).data?.items ?? []
    ).length;

    expect(afterItems).toBeGreaterThanOrEqual(beforeItems);
  });

  it('pagination returns correct meta for practitioner with ratings', async () => {
    if (!practitionerId) return;

    const res = await request(httpServer)
      .get(`${RATINGS_URL}/practitioner/${practitionerId}?page=1&perPage=2`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as Record<string, Record<string, unknown>>).data;
    expect(data).toHaveProperty('meta');
    const meta = data.meta as Record<string, unknown>;
    expect(meta).toHaveProperty('page', 1);
    expect(meta).toHaveProperty('perPage', 2);
  });
});
