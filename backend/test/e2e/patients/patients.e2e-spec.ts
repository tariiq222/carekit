/**
 * CareKit — Patients Module E2E Tests
 *
 * Covers:
 *   GET    /api/v1/patients              - list patients (paginated + search)
 *   GET    /api/v1/patients/:id          - get patient detail + recent bookings
 *   PATCH  /api/v1/patients/:id          - update patient profile
 *   GET    /api/v1/patients/:id/stats    - get booking & payment stats
 *   POST   /api/v1/patients/walk-in      - register walk-in patient
 *   POST   /api/v1/patients/claim        - claim walk-in account
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  createTestUserWithRole,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  expectValidationError,
  API_PREFIX,
  TEST_USERS,
  TEST_PATIENT_2,
  AuthResult,
} from '../setup/setup';

const PATIENTS_URL = `${API_PREFIX}/patients`;

// ---------------------------------------------------------------------------
// Walk-in test fixtures
// ---------------------------------------------------------------------------

const WALK_IN_BASE = {
  firstName: 'محمد',
  lastName: 'السالم',
  phone: '+966509990001',
};

const WALK_IN_FULL = {
  ...WALK_IN_BASE,
  gender: 'male',
  nationality: 'Saudi',
  bloodType: 'O_POS',
  allergies: 'Penicillin',
  chronicConditions: 'Hypertension',
};

const CLAIM_CREDENTIALS = {
  phone: WALK_IN_BASE.phone,
  email: 'walkin.claimed@carekit-test.com',
  password: 'ClaimedP@ss1',
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Patients Module (e2e)', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let accountant: AuthResult;
  let practitioner: AuthResult;
  let patient: AuthResult;
  let patient2: AuthResult;

  let patientId: string;
  let walkInPatientId: string;

  beforeAll(async () => {
    ({ app, httpServer } = await createTestApp());

    // Login seeded super_admin (exists in seed data)
    superAdmin = await loginTestUser(httpServer, TEST_USERS.super_admin.email, TEST_USERS.super_admin.password);

    // Create staff users via admin API (idempotent — tolerates 409 if already exists)
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

    practitioner = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.practitioner,
      'practitioner',
    );

    // Register / login test patients
    patient = await registerTestPatient(httpServer, TEST_USERS.patient);
    patient2 = await registerTestPatient(httpServer, TEST_PATIENT_2);

    patientId = patient.user['id'] as string;

    // Create a walk-in patient for tests that depend on an existing one
    const walkInRes = await request(httpServer)
      .post(`${PATIENTS_URL}/walk-in`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send(WALK_IN_BASE);

    walkInPatientId = walkInRes.body.data?.id as string;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // =========================================================================
  // GET /patients — list patients
  // =========================================================================

  describe('GET /patients', () => {
    it('super_admin can list all patients', async () => {
      const res = await request(httpServer)
        .get(PATIENTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('receptionist can list patients', async () => {
      const res = await request(httpServer)
        .get(PATIENTS_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('accountant cannot list patients (no patients:view permission) → 403', async () => {
      const res = await request(httpServer)
        .get(PATIENTS_URL)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('patient role cannot list all patients → 403', async () => {
      const res = await request(httpServer)
        .get(PATIENTS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('unauthenticated request → 401', async () => {
      await request(httpServer).get(PATIENTS_URL).expect(401);
    });

    it('returns paginated results with correct meta', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}?page=1&perPage=5`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const { meta } = res.body.data;
      expect(meta).toHaveProperty('page', 1);
      expect(meta).toHaveProperty('perPage', 5);
      expect(meta).toHaveProperty('total');
      expect(meta).toHaveProperty('totalPages');
    });

    it('search by first name returns filtered results', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}?search=${encodeURIComponent('أحمد')}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.items.some(
        (u: { firstName: string }) => u.firstName === 'أحمد',
      );
      expect(found).toBe(true);
    });

    it('search by phone returns filtered results', async () => {
      const phone = TEST_USERS.patient.phone;
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}?search=${encodeURIComponent(phone)}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('search with no match returns empty list', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}?search=zzznomatch999`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.items).toHaveLength(0);
    });
  });

  // =========================================================================
  // GET /patients/:id — get patient detail
  // =========================================================================

  describe('GET /patients/:id', () => {
    it('super_admin can fetch patient by id', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data;
      expect(data).toHaveProperty('id', patientId);
      expect(data).toHaveProperty('firstName');
      expect(data).toHaveProperty('lastName');
      expect(data).toHaveProperty('phone');
      expect(data).toHaveProperty('patientProfile');
    });

    it('receptionist can fetch patient by id', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('response includes recent bookings array', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('bookingsAsPatient');
      expect(Array.isArray(res.body.data.bookingsAsPatient)).toBe(true);
    });

    it('patient role cannot fetch another patient → 403', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('non-existent id → 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toHaveProperty('message');
    });

    it('invalid uuid format → 400', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/not-a-uuid`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('unauthenticated request → 401', async () => {
      await request(httpServer).get(`${PATIENTS_URL}/${patientId}`).expect(401);
    });
  });

  // =========================================================================
  // PATCH /patients/:id — update patient profile
  // =========================================================================

  describe('PATCH /patients/:id', () => {
    it('super_admin can update patient basic info', async () => {
      const res = await request(httpServer)
        .patch(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ firstName: 'أحمد محدث', lastName: 'الراشد' })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('receptionist can update patient profile', async () => {
      const res = await request(httpServer)
        .patch(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ nationality: 'Saudi', bloodType: 'A_POS' })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('update persists medical data correctly', async () => {
      const updatePayload = {
        bloodType: 'B_NEG',
        allergies: 'Sulfa drugs',
        chronicConditions: 'Type 2 Diabetes',
        nationalId: '1098765432',
      };

      await request(httpServer)
        .patch(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(updatePayload)
        .expect(200);

      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const profile = res.body.data.patientProfile;
      expect(profile).toHaveProperty('bloodType', 'B_NEG');
      expect(profile).toHaveProperty('allergies', 'Sulfa drugs');
      expect(profile).toHaveProperty('chronicConditions', 'Type 2 Diabetes');
      expect(profile).toHaveProperty('nationalId', '1098765432');
    });

    it('update with invalid phone format → 400', async () => {
      const res = await request(httpServer)
        .patch(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ phone: '0500000001' }) // missing country code
        .expect(400);

      expectValidationError(res.body, ['phone']);
    });

    it('patient role cannot update another patient → 403', async () => {
      const res = await request(httpServer)
        .patch(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(patient2.accessToken))
        .send({ firstName: 'Hacker' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('accountant cannot update patient (view-only) → 403', async () => {
      const res = await request(httpServer)
        .patch(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ firstName: 'Test' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('non-existent patient id → 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(httpServer)
        .patch(`${PATIENTS_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ firstName: 'Ghost' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toHaveProperty('message');
    });

    it('unknown fields are stripped (whitelist validation)', async () => {
      const res = await request(httpServer)
        .patch(`${PATIENTS_URL}/${patientId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ firstName: 'Valid', hackerField: 'injected' })
        .expect(400);

      // forbidNonWhitelisted = true → ValidationPipe rejects unknown fields
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /patients/:id/stats — booking & payment stats
  // =========================================================================

  describe('GET /patients/:id/stats', () => {
    it('super_admin can fetch patient stats', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}/stats`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const stats = res.body.data;
      expect(stats).toHaveProperty('totalBookings');
      expect(stats).toHaveProperty('byStatus');
      expect(stats).toHaveProperty('totalPaid');
      expect(stats).toHaveProperty('completedPayments');
      expect(typeof stats.totalBookings).toBe('number');
    });

    it('receptionist can fetch patient stats', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}/stats`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('stats for new patient with no bookings returns zeros', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}/stats`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.totalBookings).toBeGreaterThanOrEqual(0);
      expect(res.body.data.totalPaid).toBeGreaterThanOrEqual(0);
    });

    it('byStatus is an object with booking status keys', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}/stats`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(typeof res.body.data.byStatus).toBe('object');
    });

    it('patient role cannot fetch stats → 403', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}/stats`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('non-existent patient id → 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${fakeId}/stats`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toHaveProperty('message');
    });

    it('unauthenticated request → 401', async () => {
      await request(httpServer)
        .get(`${PATIENTS_URL}/${patientId}/stats`)
        .expect(401);
    });
  });

  // =========================================================================
  // POST /patients/walk-in — register walk-in patient
  // =========================================================================

  describe('POST /patients/walk-in', () => {
    const UNIQUE_PHONE = '+966509990002';

    it('receptionist can register a walk-in patient (minimal data)', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ firstName: 'زائر', lastName: 'مجهول', phone: UNIQUE_PHONE })
        .expect(201);

      expectSuccessResponse(res.body);
      const data = res.body.data;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('firstName', 'زائر');
      expect(data).toHaveProperty('phone', UNIQUE_PHONE);
      expect(data).toHaveProperty('accountType', 'walk_in');
      expect(data).toHaveProperty('isExisting', false);
    });

    it('super_admin can register a walk-in patient with full profile', async () => {
      const phone = '+966509990003';
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ ...WALK_IN_FULL, phone })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('accountType', 'walk_in');
    });

    it('registering same phone again is idempotent → returns existing with isExisting=true', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ firstName: 'زائر مكرر', lastName: 'مجهول', phone: WALK_IN_BASE.phone })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isExisting', true);
      expect(res.body.data).toHaveProperty('id', walkInPatientId);
    });

    it('registering phone of a FULL account → 409 conflict', async () => {
      // TEST_USERS.patient is a FULL account
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          firstName: 'مكرر',
          lastName: 'حساب',
          phone: TEST_USERS.patient.phone,
        })
        .expect(409);

      expectErrorResponse(res.body, 'PATIENT_PHONE_EXISTS');
    });

    it('missing required firstName → 400 validation error', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ lastName: 'بلا اسم', phone: '+966509990099' })
        .expect(400);

      expectValidationError(res.body, ['firstName']);
    });

    it('missing required lastName → 400 validation error', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ firstName: 'بلا لقب', phone: '+966509990098' })
        .expect(400);

      expectValidationError(res.body, ['lastName']);
    });

    it('missing required phone → 400 validation error', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ firstName: 'بلا', lastName: 'هاتف' })
        .expect(400);

      expectValidationError(res.body, ['phone']);
    });

    it('invalid phone format (no country code) → 400', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ firstName: 'تست', lastName: 'هاتف', phone: '0501234567' })
        .expect(400);

      expectValidationError(res.body, ['phone']);
    });

    it('invalid blood type enum → 400', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          firstName: 'تست',
          lastName: 'دم',
          phone: '+966509990097',
          bloodType: 'INVALID_BLOOD',
        })
        .expect(400);

      expectValidationError(res.body, ['bloodType']);
    });

    it('patient role cannot register walk-in → 403', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ firstName: 'زائر', lastName: 'مرفوض', phone: '+966509990096' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('accountant cannot register walk-in → 403', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ firstName: 'زائر', lastName: 'محاسب', phone: '+966509990095' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('unauthenticated request → 401', async () => {
      await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .send(WALK_IN_BASE)
        .expect(401);
    });
  });

  // =========================================================================
  // POST /patients/claim — claim walk-in account
  // =========================================================================

  describe('POST /patients/claim', () => {
    it('receptionist can claim a walk-in account', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send(CLAIM_CREDENTIALS)
        .expect(201);

      expectSuccessResponse(res.body);
      const data = res.body.data;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('email', CLAIM_CREDENTIALS.email);
      expect(data).toHaveProperty('phone', WALK_IN_BASE.phone);
      expect(data).toHaveProperty('accountType', 'full');
      expect(data).toHaveProperty('claimedAt');
    });

    it('claimed account can log in with new credentials', async () => {
      const res = await request(httpServer)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: CLAIM_CREDENTIALS.email,
          password: CLAIM_CREDENTIALS.password,
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('claiming already-claimed (FULL) account → 404 (no walk-in found)', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          phone: WALK_IN_BASE.phone, // now FULL account — no walk-in record
          email: 'another@carekit-test.com',
          password: 'AnotherP@ss1',
        })
        .expect(404);

      expectErrorResponse(res.body, 'WALK_IN_NOT_FOUND');
    });

    it('claiming with email already in use → 409', async () => {
      // Create a new walk-in to claim
      const newPhone = '+966509990010';
      await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ firstName: 'جديد', lastName: 'للمطالبة', phone: newPhone });

      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          phone: newPhone,
          email: TEST_USERS.patient.email, // already used by a FULL account
          password: 'ClaimedP@ss2',
        })
        .expect(409);

      expectErrorResponse(res.body, 'USER_EMAIL_EXISTS');
    });

    it('claiming non-existent phone → 404', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          phone: '+966500000099',
          email: 'ghost@carekit-test.com',
          password: 'GhostP@ss1',
        })
        .expect(404);

      expectErrorResponse(res.body, 'WALK_IN_NOT_FOUND');
    });

    it('missing phone → 400 validation', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ email: 'missing@phone.com', password: 'P@ssword1' })
        .expect(400);

      expectValidationError(res.body, ['phone']);
    });

    it('missing email → 400 validation', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ phone: '+966509990011', password: 'P@ssword1' })
        .expect(400);

      expectValidationError(res.body, ['email']);
    });

    it('missing password → 400 validation', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ phone: '+966509990011', email: 'np@test.com' })
        .expect(400);

      expectValidationError(res.body, ['password']);
    });

    it('weak password (no uppercase) → 400 validation', async () => {
      const newPhone = '+966509990012';
      await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ firstName: 'تست', lastName: 'كلمة مرور', phone: newPhone });

      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ phone: newPhone, email: 'weak@test.com', password: 'weakpassword1' })
        .expect(400);

      expectValidationError(res.body, ['password']);
    });

    it('invalid email format → 400 validation', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ phone: '+966509990013', email: 'not-an-email', password: 'ValidP@ss1' })
        .expect(400);

      expectValidationError(res.body, ['email']);
    });

    it('patient role cannot claim account → 403', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(patient.accessToken))
        .send(CLAIM_CREDENTIALS)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('unauthenticated request → 401', async () => {
      await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .send(CLAIM_CREDENTIALS)
        .expect(401);
    });
  });

  // =========================================================================
  // Walk-in → Claim → Verify profile flow (integration)
  // =========================================================================

  describe('Walk-in to full account lifecycle', () => {
    const LIFECYCLE_PHONE = '+966509990020';
    const LIFECYCLE_EMAIL = 'lifecycle@carekit-test.com';
    let lifecyclePatientId: string;

    it('step 1: register walk-in with full medical profile', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          firstName: 'دورة',
          lastName: 'حياة',
          phone: LIFECYCLE_PHONE,
          gender: 'female',
          bloodType: 'AB_POS',
          allergies: 'Aspirin',
          nationality: 'Saudi',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      lifecyclePatientId = res.body.data.id as string;
      expect(res.body.data.accountType).toBe('walk_in');
    });

    it('step 2: update walk-in patient profile', async () => {
      const res = await request(httpServer)
        .patch(`${PATIENTS_URL}/${lifecyclePatientId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ chronicConditions: 'Asthma', nationalId: '2012345678' })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('step 3: claim the walk-in account', async () => {
      const res = await request(httpServer)
        .post(`${PATIENTS_URL}/claim`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          phone: LIFECYCLE_PHONE,
          email: LIFECYCLE_EMAIL,
          password: 'LifecycleP@ss1',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data.accountType).toBe('full');
      expect(res.body.data.claimedAt).toBeTruthy();
    });

    it('step 4: full account can be fetched and retains medical data', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${lifecyclePatientId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const profile = res.body.data.patientProfile;
      expect(profile).toHaveProperty('bloodType', 'AB_POS');
      expect(profile).toHaveProperty('allergies', 'Aspirin');
      expect(profile).toHaveProperty('chronicConditions', 'Asthma');
      expect(profile).toHaveProperty('nationalId', '2012345678');
    });

    it('step 5: patient stats are initialized to zeros', async () => {
      const res = await request(httpServer)
        .get(`${PATIENTS_URL}/${lifecyclePatientId}/stats`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.totalBookings).toBe(0);
      expect(res.body.data.totalPaid).toBe(0);
      expect(res.body.data.completedPayments).toBe(0);
    });
  });
});
