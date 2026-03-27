/**
 * CareKit — Practitioner Soft-Delete Booking Cascade E2E Tests
 *
 * Validates that soft-deleting a practitioner does NOT cascade to bookings.
 * Existing bookings survive; new bookings for the deleted practitioner fail.
 *
 * Key facts verified:
 *   - Soft-delete sets deletedAt + isActive=false — bookings untouched
 *   - GET /bookings/:id still returns 200 after practitioner delete
 *   - GET /practitioners/:id returns 404 after delete
 *   - POST /bookings for deleted practitioner → 400 or 404
 *   - GET /practitioners?isActive=true excludes deleted practitioner
 *   - Booking count in DB unchanged after practitioner delete
 *
 * dateOffset: 5–7 (must stay ≤59 — booking advance limit)
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
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;
const BOOKINGS_URL = `${API_PREFIX}/bookings`;
const SERVICES_URL = `${API_PREFIX}/services`;
const SPECIALTIES_URL = `${API_PREFIX}/specialties`;

const PRAC_EMAIL = 'prac-cascade-booking-doc@carekit-test.com';
const PRAC_PASS = 'P@racCasc0de!';

function getDateOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]!;
}

// ---------------------------------------------------------------------------
// State & helpers
// ---------------------------------------------------------------------------

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;
let superAdmin: AuthResult;
let patient: AuthResult;
let deletedPractitionerId: string;
let serviceId: string;
let specialtyId: string;
let pracUserId: string;

async function deletePractitioner(): Promise<void> {
  await request(httpServer)
    .delete(`${PRACTITIONERS_URL}/${deletedPractitionerId}`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .expect(200);
}

async function restorePractitioner(): Promise<void> {
  const res = await request(httpServer)
    .post(PRACTITIONERS_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      userId: pracUserId,
      specialtyId,
      bio: 'Restored cascade test practitioner',
      bioAr: 'طبيب مستعاد',
      experience: 5,
      priceClinic: 10000,
      pricePhone: 10000,
      priceVideo: 10000,
    });
  if (res.status !== 201) return;
  deletedPractitionerId = res.body.data.id as string;

  await request(httpServer)
    .post(`${PRACTITIONERS_URL}/${deletedPractitionerId}/services`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({ serviceId, availableTypes: ['clinic_visit'], isActive: true });

  const schedule = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    startTime: '08:00',
    endTime: '20:00',
  }));
  await request(httpServer)
    .put(`${PRACTITIONERS_URL}/${deletedPractitionerId}/availability`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({ schedule });
}

async function createBooking(date: string, startTime: string): Promise<string> {
  const res = await request(httpServer)
    .post(BOOKINGS_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      practitionerId: deletedPractitionerId,
      serviceId,
      type: 'clinic_visit',
      date,
      startTime,
      patientId: patient.user['id'],
    });
  if (res.status !== 201) {
    throw new Error(`createBooking failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.id as string;
}

// ---------------------------------------------------------------------------

beforeAll(async () => {
  testApp = await createTestApp();
  httpServer = testApp.httpServer;

  superAdmin = await loginTestUser(
    httpServer,
    TEST_USERS.super_admin.email,
    TEST_USERS.super_admin.password,
  );

  patient = await registerTestPatient(httpServer, {
    email: 'prac-cascade-booking-p@carekit-test.com',
    password: 'P@tientCasc1!',
    firstName: 'مريض',
    lastName: 'الحذف',
    phone: '+966507002001',
    gender: 'male',
  });

  // Specialty
  const specRes = await request(httpServer)
    .post(SPECIALTIES_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({ nameEn: 'Cascade Booking Specialty', nameAr: 'تخصص حذف' });
  specialtyId = (specRes.body.data?.id ?? '') as string;

  // Category + service
  const catRes = await request(httpServer)
    .post(`${SERVICES_URL}/categories`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({ nameEn: 'Cascade Category', nameAr: 'فئة الحذف' });
  const categoryId = (catRes.body.data?.id ?? '') as string;

  const svcRes = await request(httpServer)
    .post(SERVICES_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      nameEn: 'Cascade Booking Service',
      nameAr: 'خدمة اختبار الحذف',
      categoryId,
      price: 10000,
      duration: 30,
    });
  serviceId = (svcRes.body.data?.id ?? '') as string;
  if (!serviceId) throw new Error(`Service creation failed: ${JSON.stringify(svcRes.body)}`);

  await request(httpServer)
    .put(`${SERVICES_URL}/${serviceId}/booking-types`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({ types: [{ bookingType: 'clinic_visit', price: 10000, duration: 30 }] });

  // Practitioner user
  const userRes = await request(httpServer)
    .post(`${API_PREFIX}/users`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      email: PRAC_EMAIL,
      password: PRAC_PASS,
      firstName: 'طبيب',
      lastName: 'محذوف',
      phone: '+966507002002',
      gender: 'male',
      roleSlug: 'practitioner',
    });

  if (userRes.status === 201) {
    pracUserId = userRes.body.data.id as string;
  } else {
    const login = await request(httpServer)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: PRAC_EMAIL, password: PRAC_PASS })
      .expect(200);
    pracUserId = login.body.data.user.id as string;
  }

  // Practitioner profile
  const pracRes = await request(httpServer)
    .post(PRACTITIONERS_URL)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({
      userId: pracUserId,
      specialtyId,
      bio: 'Cascade delete test practitioner',
      bioAr: 'طبيب اختبار الحذف',
      experience: 5,
      priceClinic: 10000,
      pricePhone: 10000,
      priceVideo: 10000,
    });

  if (pracRes.status === 201) {
    deletedPractitionerId = pracRes.body.data.id as string;
  } else {
    const listRes = await request(httpServer).get(PRACTITIONERS_URL).query({ perPage: '100' });
    const items = (listRes.body.data?.items ?? []) as Array<{ id: string; user?: { id: string } }>;
    deletedPractitionerId = items.find((p) => p.user?.id === pracUserId)?.id ?? '';
  }
  if (!deletedPractitionerId) throw new Error('deletedPractitionerId setup failed');

  // Assign service + availability
  await request(httpServer)
    .post(`${PRACTITIONERS_URL}/${deletedPractitionerId}/services`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({ serviceId, availableTypes: ['clinic_visit'], isActive: true });
  const schedule = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day, startTime: '08:00', endTime: '20:00',
  }));
  await request(httpServer)
    .put(`${PRACTITIONERS_URL}/${deletedPractitionerId}/availability`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({ schedule });
  await request(httpServer)
    .patch(`${API_PREFIX}/booking-settings`)
    .set(getAuthHeaders(superAdmin.accessToken))
    .send({ adminCanBookOutsideHours: true });
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// ---------------------------------------------------------------------------

describe('Practitioner Soft-Delete — Booking Cascade Behaviour', () => {
  it('pending booking still accessible after practitioner soft-delete', async () => {
    const bookingId = await createBooking(getDateOffset(5), '09:00');
    await deletePractitioner();

    const res = await request(httpServer)
      .get(`${BOOKINGS_URL}/${bookingId}`)
      .set(getAuthHeaders(superAdmin.accessToken));

    expect(res.status).toBe(200);
    expectSuccessResponse(res.body as Record<string, unknown>);

    await restorePractitioner();
  });

  it('confirmed booking still accessible after practitioner soft-delete', async () => {
    const bookingId = await createBooking(getDateOffset(6), '09:00');

    const pmtRes = await request(httpServer)
      .get(`${API_PREFIX}/payments/booking/${bookingId}`)
      .set(getAuthHeaders(superAdmin.accessToken));
    if (pmtRes.status === 200) {
      await request(httpServer)
        .patch(`${API_PREFIX}/payments/${pmtRes.body.data.id as string}/status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ status: 'paid' });
    }

    await deletePractitioner();

    const res = await request(httpServer)
      .get(`${BOOKINGS_URL}/${bookingId}`)
      .set(getAuthHeaders(superAdmin.accessToken));

    expect(res.status).toBe(200);
    expectSuccessResponse(res.body as Record<string, unknown>);

    await restorePractitioner();
  });

  it('new booking creation fails after practitioner soft-delete', async () => {
    await deletePractitioner();

    const res = await request(httpServer)
      .post(BOOKINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        practitionerId: deletedPractitionerId,
        serviceId,
        type: 'clinic_visit',
        date: getDateOffset(7),
        startTime: '09:00',
        patientId: patient.user['id'],
      });

    expect([400, 404]).toContain(res.status);

    await restorePractitioner();
  });

  it('deleted practitioner no longer appears in GET /practitioners?isActive=true', async () => {
    await deletePractitioner();

    const res = await request(httpServer)
      .get(PRACTITIONERS_URL)
      .query({ isActive: 'true', perPage: '100' })
      .set(getAuthHeaders(superAdmin.accessToken));

    expect(res.status).toBe(200);
    const items = (res.body.data?.items ?? []) as Array<{ id: string }>;
    expect(items.find((p) => p.id === deletedPractitionerId)).toBeUndefined();

    await restorePractitioner();
  });

  it('GET /practitioners/:id returns 404 after soft-delete', async () => {
    await deletePractitioner();

    const res = await request(httpServer)
      .get(`${PRACTITIONERS_URL}/${deletedPractitionerId}`)
      .set(getAuthHeaders(superAdmin.accessToken));

    expect(res.status).toBe(404);

    await restorePractitioner();
  });

  it('existing bookings count does not change after practitioner delete', async () => {
    const before = await request(httpServer)
      .get(BOOKINGS_URL)
      .query({ practitionerId: deletedPractitionerId, perPage: '100' })
      .set(getAuthHeaders(superAdmin.accessToken));
    const countBefore = ((before.body.data?.items ?? []) as unknown[]).length;

    await deletePractitioner();

    const after = await request(httpServer)
      .get(BOOKINGS_URL)
      .query({ practitionerId: deletedPractitionerId, perPage: '100' })
      .set(getAuthHeaders(superAdmin.accessToken));
    const countAfter = ((after.body.data?.items ?? []) as unknown[]).length;

    expect(countAfter).toBe(countBefore);
  });
});
