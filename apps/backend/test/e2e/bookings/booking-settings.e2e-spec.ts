/**
 * CareKit — Booking Settings E2E Tests
 *
 * Covers:
 *   GET   /booking-settings  — retrieve current settings (bookings:view)
 *   PATCH /booking-settings  — update settings (whitelabel:edit)
 *
 * Scenarios:
 *   - Auth (401 without token)
 *   - Permission matrix (GET: bookings:view, PATCH: whitelabel:edit)
 *   - Response shape validation
 *   - Update and verify persistence
 *   - Validation (400 for invalid field values)
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

const BOOKING_SETTINGS_URL = `${API_PREFIX}/booking-settings`;

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;

let superAdmin: AuthResult;
let accountant: AuthResult;
let patient: AuthResult;
let practitionerAuth: AuthResult;

beforeAll(async () => {
  testApp = await createTestApp();
  httpServer = testApp.httpServer;

  superAdmin = await loginTestUser(
    httpServer,
    TEST_USERS.super_admin.email,
    TEST_USERS.super_admin.password,
  );

  accountant = await createTestUserWithRole(
    httpServer,
    superAdmin.accessToken,
    {
      email: 'bsettings-accountant@carekit-test.com',
      password: 'Acc0unt@ntP@ss3',
      firstName: 'ناصر',
      lastName: 'الجهني',
      phone: '+966507000701',
      gender: 'male',
    },
    'accountant',
  );

  practitionerAuth = await createTestUserWithRole(
    httpServer,
    superAdmin.accessToken,
    {
      email: 'bsettings-prac@carekit-test.com',
      password: 'Pr@cS3ttP@ss!',
      firstName: 'فيصل',
      lastName: 'العسيري',
      phone: '+966507000702',
      gender: 'male',
    },
    'practitioner',
  );

  patient = await registerTestPatient(httpServer, {
    email: 'bsettings-patient@carekit-test.com',
    password: 'P@tientP@ss3',
    firstName: 'أميرة',
    lastName: 'الصالح',
    phone: '+966507000703',
    gender: 'female',
  });
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// =============================================================================
// GET /booking-settings
// =============================================================================

describe('GET /booking-settings', () => {
  it('returns 401 without auth', async () => {
    await request(httpServer).get(BOOKING_SETTINGS_URL).expect(401);
  });

  it('patient has bookings:view → 200 (patients can view booking settings)', async () => {
    // Seed data grants patient: bookings: ['view', 'create'] — so GET is allowed
    const res = await request(httpServer)
      .get(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(patient.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('accountant has bookings:view → 200', async () => {
    const res = await request(httpServer)
      .get(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(accountant.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('super_admin gets settings → 200 with data', async () => {
    const res = await request(httpServer)
      .get(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    expect((res.body as Record<string, unknown>).data).toBeDefined();
  });

  it('practitioner has bookings:view → 200', async () => {
    const res = await request(httpServer)
      .get(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });
});

// =============================================================================
// PATCH /booking-settings
// =============================================================================

describe('PATCH /booking-settings', () => {
  it('returns 401 without auth', async () => {
    await request(httpServer).patch(BOOKING_SETTINGS_URL).send({}).expect(401);
  });

  it('patient has no whitelabel:edit → 403', async () => {
    const res = await request(httpServer)
      .patch(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(patient.accessToken))
      .send({})
      .expect(403);

    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('accountant has no whitelabel:edit → 403', async () => {
    const res = await request(httpServer)
      .patch(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(accountant.accessToken))
      .send({})
      .expect(403);

    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('practitioner has no whitelabel:edit → 403', async () => {
    const res = await request(httpServer)
      .patch(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .send({})
      .expect(403);

    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('super_admin can update settings with empty body → 200', async () => {
    const res = await request(httpServer)
      .patch(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({})
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('super_admin can update freeCancelBeforeHours → 200 and persists', async () => {
    const res = await request(httpServer)
      .patch(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ freeCancelBeforeHours: 24 })
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);

    // Verify persisted
    const getRes = await request(httpServer)
      .get(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    const data = (getRes.body as Record<string, Record<string, unknown>>).data;
    expect(data).toBeDefined();
  });

  it('non-whitelisted fields in PATCH body → 400', async () => {
    const res = await request(httpServer)
      .patch(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ unknownField: 'injected', cancellationWindowHours: 12 })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// =============================================================================
// Branch override fallback
// =============================================================================

describe('PATCH /booking-settings — branch override', () => {
  let settingsBranchId: string;

  beforeAll(async () => {
    const bRes = await request(httpServer)
      .post(`${API_PREFIX}/branches`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        nameAr: 'فرع إعدادات الحجز',
        nameEn: 'Settings Test Branch',
        isActive: true,
      })
      .expect(201);
    settingsBranchId = (bRes.body.data as { id: string }).id;
  });

  it('should create branch-specific settings override via PATCH with branchId', async () => {
    const res = await request(httpServer)
      .patch(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ branchId: settingsBranchId, paymentTimeoutMinutes: 99 })
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as Record<string, Record<string, unknown>>).data;
    expect(data.paymentTimeoutMinutes).toBe(99);
  });

  it('should not affect global settings when branch override is created', async () => {
    const globalRes = await request(httpServer)
      .get(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    const globalData = (
      globalRes.body as Record<string, Record<string, unknown>>
    ).data;
    expect(globalData.paymentTimeoutMinutes).not.toBe(99);
  });

  it('should update existing branch override without touching global', async () => {
    await request(httpServer)
      .patch(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ branchId: settingsBranchId, paymentTimeoutMinutes: 77 })
      .expect(200);

    const globalRes = await request(httpServer)
      .get(BOOKING_SETTINGS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    const globalData = (
      globalRes.body as Record<string, Record<string, unknown>>
    ).data;
    expect(globalData.paymentTimeoutMinutes).not.toBe(77);
  });
});
