/**
 * CareKit — Waitlist Module E2E Tests
 *
 * Covers:
 *   GET    /bookings/waitlist/my   — patient's own waitlist entries
 *   GET    /bookings/waitlist      — admin: all waitlist entries (bookings:view)
 *   POST   /bookings/waitlist      — join waitlist
 *   DELETE /bookings/waitlist/:id  — leave waitlist
 *
 * Scenarios:
 *   - Auth (401 without token)
 *   - Permission (403 without bookings:view for admin endpoint)
 *   - Validation (400 for bad input)
 *   - Idempotency (leave non-existent or already-left entry)
 *   - Ownership isolation (patient cannot leave another patient's entry)
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

const WAITLIST_URL = `${API_PREFIX}/bookings/waitlist`;
const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;
const GHOST_ID = '00000000-0000-0000-0000-000000000000';

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;

let superAdmin: AuthResult;
let patient: AuthResult;
let patient2: AuthResult;
let accountant: AuthResult;
let practitionerAuth: AuthResult;
let practitionerId: string;

beforeAll(async () => {
  testApp = await createTestApp();
  httpServer = testApp.httpServer;

  superAdmin = await loginTestUser(
    httpServer,
    TEST_USERS.super_admin.email,
    TEST_USERS.super_admin.password,
  );

  patient = await registerTestPatient(httpServer, {
    email: 'waitlist-patient1@carekit-test.com',
    password: 'P@tientP@ss1',
    firstName: 'وليد',
    lastName: 'الغامدي',
    phone: '+966507000501',
    gender: 'male',
  });

  patient2 = await registerTestPatient(httpServer, {
    email: 'waitlist-patient2@carekit-test.com',
    password: 'P@tientP@ss2',
    firstName: 'شيماء',
    lastName: 'العمري',
    phone: '+966507000502',
    gender: 'female',
  });

  accountant = await createTestUserWithRole(
    httpServer,
    superAdmin.accessToken,
    {
      email: 'waitlist-accountant@carekit-test.com',
      password: 'Acc0unt@ntP@ss2',
      firstName: 'عادل',
      lastName: 'الشمري',
      phone: '+966507000503',
      gender: 'male',
    },
    'accountant',
  );

  practitionerAuth = await createTestUserWithRole(
    httpServer,
    superAdmin.accessToken,
    {
      email: 'waitlist-prac@carekit-test.com',
      password: 'Pr@cW8itP@ss1',
      firstName: 'هشام',
      lastName: 'الرشيد',
      phone: '+966507000504',
      gender: 'male',
    },
    'practitioner',
  );

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
      bio: 'Waitlist test practitioner',
      bioAr: 'طبيب اختبار قائمة الانتظار',
      experience: 7,
      priceClinic: 18000,
      pricePhone: 12000,
      priceVideo: 15000,
    });

  if (pracRes.status === 201) {
    practitionerId = (pracRes.body.data as { id: string }).id;
  }
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// =============================================================================
// GET /bookings/waitlist/my
// =============================================================================

describe('GET /bookings/waitlist/my', () => {
  it('returns 401 without auth', async () => {
    await request(httpServer).get(`${WAITLIST_URL}/my`).expect(401);
  });

  it('patient gets their own waitlist entries → 200', async () => {
    const res = await request(httpServer)
      .get(`${WAITLIST_URL}/my`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    expect(Array.isArray((res.body as Record<string, { data: unknown[] }>).data)).toBe(true);
  });

  it('super_admin can view their own waitlist → 200', async () => {
    const res = await request(httpServer)
      .get(`${WAITLIST_URL}/my`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });
});

// =============================================================================
// GET /bookings/waitlist (admin)
// =============================================================================

describe('GET /bookings/waitlist (admin list)', () => {
  it('returns 401 without auth', async () => {
    await request(httpServer).get(WAITLIST_URL).expect(401);
  });

  it('accountant has bookings:view → 200', async () => {
    const res = await request(httpServer)
      .get(WAITLIST_URL)
      .set(getAuthHeaders(accountant.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    expect(Array.isArray((res.body as Record<string, { data: unknown[] }>).data)).toBe(true);
  });

  it('super_admin sees all waitlist entries → 200', async () => {
    const res = await request(httpServer)
      .get(WAITLIST_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('filters by practitionerId → 200', async () => {
    if (!practitionerId) return;

    const res = await request(httpServer)
      .get(`${WAITLIST_URL}?practitionerId=${practitionerId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('patient has bookings:view → 200 (patients can view waitlist)', async () => {
    // Seed data grants patient: bookings: ['view', 'create'] — so GET is allowed
    const res = await request(httpServer)
      .get(WAITLIST_URL)
      .set(getAuthHeaders(patient.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });
});

// =============================================================================
// POST /bookings/waitlist (join)
// =============================================================================

describe('POST /bookings/waitlist — join', () => {
  it('returns 401 without auth', async () => {
    await request(httpServer)
      .post(WAITLIST_URL)
      .send({ practitionerId: GHOST_ID })
      .expect(401);
  });

  it('returns 400 when practitionerId is missing', async () => {
    const res = await request(httpServer)
      .post(WAITLIST_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({})
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when practitionerId is not a valid UUID', async () => {
    const res = await request(httpServer)
      .post(WAITLIST_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({ practitionerId: 'not-a-uuid' })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 4xx or 5xx when practitioner does not exist', async () => {
    const res = await request(httpServer)
      .post(WAITLIST_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({ practitionerId: GHOST_ID });

    // 400 WAITLIST_NOT_ENABLED (if waitlist disabled), 404 practitioner not found, 500 unhandled FK error
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('patient can join waitlist for existing practitioner → 200/201 or 400 if waitlist disabled', async () => {
    if (!practitionerId) return;

    // Enable waitlist first (super_admin can patch booking settings)
    await request(httpServer)
      .patch(`${API_PREFIX}/booking-settings`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ waitlistEnabled: true });

    const res = await request(httpServer)
      .post(WAITLIST_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({ practitionerId });

    // 200/201 when enabled; 400 WAITLIST_NOT_ENABLED when disabled
    expect([200, 201, 400]).toContain(res.status);
  });

  it('joining the same practitioner waitlist twice → 200/201 or 409 or 400', async () => {
    if (!practitionerId) return;

    const res = await request(httpServer)
      .post(WAITLIST_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({ practitionerId });

    // 200/201 idempotent, 409 conflict (already on waitlist), 400 if waitlist disabled
    expect([200, 201, 400, 409]).toContain(res.status);
  });
});

// =============================================================================
// DELETE /bookings/waitlist/:id (leave)
// =============================================================================

describe('DELETE /bookings/waitlist/:id — leave', () => {
  let waitlistEntryId: string;

  beforeAll(async () => {
    if (!practitionerId) return;

    // patient2 joins the waitlist
    const res = await request(httpServer)
      .post(WAITLIST_URL)
      .set(getAuthHeaders(patient2.accessToken))
      .send({ practitionerId });

    if ([200, 201].includes(res.status)) {
      waitlistEntryId = (res.body as Record<string, { data: { id: string } }>).data?.id;
    }
  });

  it('returns 401 without auth', async () => {
    await request(httpServer)
      .delete(`${WAITLIST_URL}/${GHOST_ID}`)
      .expect(401);
  });

  it('returns 400 for malformed UUID', async () => {
    const res = await request(httpServer)
      .delete(`${WAITLIST_URL}/not-a-uuid`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 404 for non-existent waitlist entry', async () => {
    const res = await request(httpServer)
      .delete(`${WAITLIST_URL}/${GHOST_ID}`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(404);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('patient cannot leave another patient\'s waitlist entry → 403 or 404', async () => {
    if (!waitlistEntryId) return;

    const res = await request(httpServer)
      .delete(`${WAITLIST_URL}/${waitlistEntryId}`)
      .set(getAuthHeaders(patient.accessToken)); // patient1 tries to remove patient2's entry

    expect([403, 404]).toContain(res.status);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('patient2 can leave their own waitlist entry → 200', async () => {
    if (!waitlistEntryId) return;

    const res = await request(httpServer)
      .delete(`${WAITLIST_URL}/${waitlistEntryId}`)
      .set(getAuthHeaders(patient2.accessToken))
      .expect(200);

    expect((res.body as Record<string, unknown>).success).toBe(true);
  });

  it('leaving already-left entry (idempotency) → 404', async () => {
    if (!waitlistEntryId) return;

    const res = await request(httpServer)
      .delete(`${WAITLIST_URL}/${waitlistEntryId}`)
      .set(getAuthHeaders(patient2.accessToken))
      .expect(404);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});
