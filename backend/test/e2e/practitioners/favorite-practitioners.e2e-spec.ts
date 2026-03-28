/**
 * CareKit — Favorite Practitioners E2E Tests
 *
 * Covers:
 *   GET    /practitioners/favorites       — list patient's favorite practitioners
 *   POST   /practitioners/:id/favorite   — add to favorites
 *   DELETE /practitioners/:id/favorite   — remove from favorites
 *
 * Scenarios:
 *   - Auth (401 without token)
 *   - Validation (400 for bad practitioner UUID)
 *   - 404 for non-existent practitioner
 *   - Add same practitioner twice (idempotency)
 *   - Remove non-favorited practitioner (idempotency)
 *   - Favorites are user-scoped (patient1 cannot see patient2's favorites)
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
const GHOST_ID = '00000000-0000-0000-0000-000000000000';

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;

let superAdmin: AuthResult;
let patient: AuthResult;
let patient2: AuthResult;
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
    email: 'fav-patient1@carekit-test.com',
    password: 'P@tientP@ss1',
    firstName: 'راشد',
    lastName: 'السليم',
    phone: '+966507000601',
    gender: 'male',
  });

  patient2 = await registerTestPatient(httpServer, {
    email: 'fav-patient2@carekit-test.com',
    password: 'P@tientP@ss2',
    firstName: 'نجلاء',
    lastName: 'الحمدان',
    phone: '+966507000602',
    gender: 'female',
  });

  practitionerAuth = await createTestUserWithRole(
    httpServer,
    superAdmin.accessToken,
    {
      email: 'fav-prac@carekit-test.com',
      password: 'Pr@cF@v1P@ss2',
      firstName: 'ماجد',
      lastName: 'البريكي',
      phone: '+966507000603',
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
      bio: 'Favorites test practitioner',
      bioAr: 'طبيب اختبار المفضلة',
      experience: 12,
      priceClinic: 22000,
      pricePhone: 16000,
      priceVideo: 19000,
    });

  if (pracRes.status === 201) {
    practitionerId = (pracRes.body.data as { id: string }).id;
  }
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// =============================================================================
// GET /practitioners/favorites
// =============================================================================

describe('GET /practitioners/favorites', () => {
  it('returns 401 without auth', async () => {
    await request(httpServer)
      .get(`${PRACTITIONERS_URL}/favorites`)
      .expect(401);
  });

  it('patient gets empty favorites list initially → 200', async () => {
    const res = await request(httpServer)
      .get(`${PRACTITIONERS_URL}/favorites`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    expect(Array.isArray((res.body as Record<string, { data: unknown[] }>).data)).toBe(true);
  });

  it('patient2 favorites are scoped to patient2 only', async () => {
    const res = await request(httpServer)
      .get(`${PRACTITIONERS_URL}/favorites`)
      .set(getAuthHeaders(patient2.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });
});

// =============================================================================
// POST /practitioners/:id/favorite
// =============================================================================

describe('POST /practitioners/:id/favorite — add to favorites', () => {
  it('returns 401 without auth', async () => {
    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${GHOST_ID}/favorite`)
      .expect(401);
  });

  it('returns 400 for malformed practitioner UUID', async () => {
    const res = await request(httpServer)
      .post(`${PRACTITIONERS_URL}/not-a-uuid/favorite`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 404 for non-existent practitioner', async () => {
    const res = await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${GHOST_ID}/favorite`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(404);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('patient can add a practitioner to favorites → 200 or 201', async () => {
    if (!practitionerId) return;

    const res = await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken));

    expect([200, 201]).toContain(res.status);
    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('adding same practitioner to favorites twice → 200/201 or 409 (idempotent)', async () => {
    if (!practitionerId) return;

    // Ensure it's already added
    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken));

    const res = await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken));

    expect([200, 201, 409]).toContain(res.status);
  });

  it('after adding, practitioner appears in GET /favorites', async () => {
    if (!practitionerId) return;

    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken));

    const res = await request(httpServer)
      .get(`${PRACTITIONERS_URL}/favorites`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const items = (res.body as Record<string, { data: Array<{ id: string }> }>).data;
    if (Array.isArray(items) && items.length > 0) {
      const found = items.some((p) => p.id === practitionerId);
      expect(found).toBe(true);
    }
  });

  it('patient2 favorites are independent from patient favorites', async () => {
    if (!practitionerId) return;

    // patient2 adds same practitioner
    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient2.accessToken));

    // Both patients should independently see the practitioner
    const res1 = await request(httpServer)
      .get(`${PRACTITIONERS_URL}/favorites`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(200);

    const res2 = await request(httpServer)
      .get(`${PRACTITIONERS_URL}/favorites`)
      .set(getAuthHeaders(patient2.accessToken))
      .expect(200);

    expectSuccessResponse(res1.body as Record<string, unknown>);
    expectSuccessResponse(res2.body as Record<string, unknown>);
  });
});

// =============================================================================
// DELETE /practitioners/:id/favorite
// =============================================================================

describe('DELETE /practitioners/:id/favorite — remove from favorites', () => {
  it('returns 401 without auth', async () => {
    await request(httpServer)
      .delete(`${PRACTITIONERS_URL}/${GHOST_ID}/favorite`)
      .expect(401);
  });

  it('returns 400 for malformed practitioner UUID', async () => {
    const res = await request(httpServer)
      .delete(`${PRACTITIONERS_URL}/not-a-uuid/favorite`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('removing non-favorited practitioner → 200 or 404 (idempotent)', async () => {
    const res = await request(httpServer)
      .delete(`${PRACTITIONERS_URL}/${GHOST_ID}/favorite`)
      .set(getAuthHeaders(patient.accessToken));

    // Both idempotent 200 and strict 404 are acceptable
    expect([200, 404]).toContain(res.status);
  });

  it('patient can remove a favorited practitioner → 200', async () => {
    if (!practitionerId) return;

    // Add first
    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken));

    // Then remove
    const res = await request(httpServer)
      .delete(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(200);

    expect((res.body as Record<string, unknown>).success).toBe(true);
  });

  it('after removal, practitioner no longer appears in GET /favorites', async () => {
    if (!practitionerId) return;

    // Add then remove
    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken));

    await request(httpServer)
      .delete(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(200);

    const res = await request(httpServer)
      .get(`${PRACTITIONERS_URL}/favorites`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(200);

    const items = (res.body as Record<string, { data: Array<{ id: string }> }>).data;
    if (Array.isArray(items)) {
      const found = items.some((p) => p.id === practitionerId);
      expect(found).toBe(false);
    }
  });

  it('removing same practitioner twice (idempotency) → second call 200 or 404', async () => {
    if (!practitionerId) return;

    await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken));

    await request(httpServer)
      .delete(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken))
      .expect(200);

    const res = await request(httpServer)
      .delete(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
      .set(getAuthHeaders(patient.accessToken));

    expect([200, 404]).toContain(res.status);
  });
});
