import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  API_PREFIX,
  AuthResult,
  TEST_USERS,
  closeTestApp,
  createTestApp,
  createTestUserWithRole,
  expectErrorResponse,
  expectSuccessResponse,
  expectValidationError,
  getAuthHeaders,
  loginTestUser,
  registerTestPatient,
} from '../setup/setup';

const PATIENTS_URL = `${API_PREFIX}/patients`;

describe('Patients Scenario Audit (e2e)', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;
  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let patient: AuthResult;

  let auditedPatientId: string;
  let seededWalkInId: string;
  let seededWalkInPhone: string;
  let updatablePatientId: string;

  const runId = Date.now().toString().slice(-6);
  let phoneCounter = 0;

  const nextPhone = () =>
    `+9665${runId}${String(phoneCounter++).padStart(3, '0')}`;
  const overLimit = 'a'.repeat(1001);

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

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);

    for (let i = 0; i < 12; i += 1) {
      await request(httpServer)
        .post(`${PATIENTS_URL}/walk-in`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          firstName: `صفحة${i}`,
          lastName: 'مريض',
          phone: nextPhone(),
        });
    }

    seededWalkInPhone = nextPhone();
    const seededWalkIn = await request(httpServer)
      .post(`${PATIENTS_URL}/walk-in`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        firstName: 'سجل',
        lastName: 'موسع',
        phone: seededWalkInPhone,
        nationality: 'Saudi',
        nationalId: '1234567890',
        emergencyName: 'محمد السالم',
        emergencyPhone: '+966500000777',
        bloodType: 'O_NEG',
        allergies: 'Dust',
        chronicConditions: 'Asthma',
      })
      .expect(200); // walk-in returns 200 (HttpCode(200));

    seededWalkInId = seededWalkIn.body.data.id as string;

    const updatableWalkIn = await request(httpServer)
      .post(`${PATIENTS_URL}/walk-in`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        firstName: 'قابل',
        lastName: 'للتحديث',
        phone: nextPhone(),
        nationality: 'Saudi',
      })
      .expect(200); // walk-in returns 200 (HttpCode(200));

    updatablePatientId = updatableWalkIn.body.data.id as string;
    auditedPatientId = patient.user.id as string;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('searches patients by email', async () => {
    const res = await request(httpServer)
      .get(
        `${PATIENTS_URL}?search=${encodeURIComponent(TEST_USERS.patient.email)}`,
      )
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expectSuccessResponse(res.body);
    expect(
      res.body.data.items.some(
        (item: { email: string }) => item.email === TEST_USERS.patient.email,
      ),
    ).toBe(true);
  });

  it('returns a distinct second page for pagination', async () => {
    const [pageOne, pageTwo] = await Promise.all([
      request(httpServer)
        .get(`${PATIENTS_URL}?page=1&perPage=5`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200),
      request(httpServer)
        .get(`${PATIENTS_URL}?page=2&perPage=5`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200),
    ]);

    const pageOneIds = pageOne.body.data.items.map(
      (item: { id: string }) => item.id,
    );
    const pageTwoIds = pageTwo.body.data.items.map(
      (item: { id: string }) => item.id,
    );

    expect(pageTwo.body.data.meta.page).toBe(2);
    expect(pageOneIds).not.toEqual(pageTwoIds);
    expect(pageTwoIds.some((id: string) => pageOneIds.includes(id))).toBe(
      false,
    );
  });

  it('returns walk-in detail with identity, emergency, and medical fields', async () => {
    const res = await request(httpServer)
      .get(`${PATIENTS_URL}/${seededWalkInId}`)
      .set(getAuthHeaders(receptionist.accessToken))
      .expect(200);

    expectSuccessResponse(res.body);
    expect(res.body.data.patientProfile).toMatchObject({
      nationality: 'Saudi',
      nationalId: '1234567890',
      emergencyName: 'محمد السالم',
      emergencyPhone: '+966500000777',
      bloodType: 'O_NEG',
      allergies: 'Dust',
      chronicConditions: 'Asthma',
    });
    expect(res.body.data.bookingsAsPatient.length).toBeLessThanOrEqual(10);
  });

  it('updates phone and preserves untouched fields on partial update', async () => {
    const before = await request(httpServer)
      .get(`${PATIENTS_URL}/${updatablePatientId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    const newPhone = nextPhone();

    await request(httpServer)
      .patch(`${PATIENTS_URL}/${updatablePatientId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ firstName: 'تحديث', phone: newPhone })
      .expect(200);

    const after = await request(httpServer)
      .get(`${PATIENTS_URL}/${updatablePatientId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expect(after.body.data.firstName).toBe('تحديث');
    expect(after.body.data.phone).toBe(newPhone);
    expect(after.body.data.lastName).toBe(before.body.data.lastName);
    expect(after.body.data.patientProfile.nationality).toBe(
      before.body.data.patientProfile.nationality,
    );
  });

  it('rejects firstName longer than 255 chars on update', async () => {
    const res = await request(httpServer)
      .patch(`${PATIENTS_URL}/${auditedPatientId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ firstName: 'أ'.repeat(256) })
      .expect(400);

    expectValidationError(res.body, ['firstName']);
  });

  it('rejects nationalId longer than 20 chars on update', async () => {
    const res = await request(httpServer)
      .patch(`${PATIENTS_URL}/${auditedPatientId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nationalId: '123456789012345678901' })
      .expect(400);

    expectValidationError(res.body, ['nationalId']);
  });

  it('requires authentication to update a patient', async () => {
    const res = await request(httpServer)
      .patch(`${PATIENTS_URL}/${auditedPatientId}`)
      .send({ firstName: 'بدون توكن' })
      .expect(401);

    expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
  });

  it('rejects invalid emergency phone for walk-in creation', async () => {
    const res = await request(httpServer)
      .post(`${PATIENTS_URL}/walk-in`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        firstName: 'طوارئ',
        lastName: 'خاطئ',
        phone: nextPhone(),
        emergencyPhone: '0501234567',
      })
      .expect(400);

    expectValidationError(res.body, ['emergencyPhone']);
  });

  it('rejects allergies longer than 1000 chars for walk-in creation', async () => {
    const res = await request(httpServer)
      .post(`${PATIENTS_URL}/walk-in`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        firstName: 'حساسية',
        lastName: 'طويلة',
        phone: nextPhone(),
        allergies: overLimit,
      })
      .expect(400);

    expectValidationError(res.body, ['allergies']);
  });

  it('rejects chronicConditions longer than 1000 chars for walk-in creation', async () => {
    const res = await request(httpServer)
      .post(`${PATIENTS_URL}/walk-in`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        firstName: 'مرض',
        lastName: 'مزمن',
        phone: nextPhone(),
        chronicConditions: overLimit,
      })
      .expect(400);

    expectValidationError(res.body, ['chronicConditions']);
  });

  it('returns 200 for idempotent walk-in registration', async () => {
    const res = await request(httpServer)
      .post(`${PATIENTS_URL}/walk-in`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        firstName: 'مكرر',
        lastName: 'نفس السجل',
        phone: seededWalkInPhone,
      });

    expectSuccessResponse(res.body);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(seededWalkInId);
    expect(res.body.data.isExisting).toBe(true);
  });

  it('returns 200 for successful walk-in claim', async () => {
    const claimPhone = nextPhone();

    await request(httpServer)
      .post(`${PATIENTS_URL}/walk-in`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        firstName: 'مطالبة',
        lastName: 'ناجحة',
        phone: claimPhone,
      })
      .expect(200); // walk-in returns 200 (HttpCode(200));

    const res = await request(httpServer)
      .post(`${PATIENTS_URL}/claim`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        phone: claimPhone,
        email: `claim-${runId}@carekit-test.com`,
        password: 'ClaimPass1',
      })
      .expect(200);

    expectSuccessResponse(res.body);
    expect(res.body.data.accountType).toBe('full');
    expect(res.body.data.claimedAt).toBeTruthy();
  });

  it('rejects invalid phone format on claim', async () => {
    const res = await request(httpServer)
      .post(`${PATIENTS_URL}/claim`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        phone: '0501234567',
        email: `bad-phone-${runId}@carekit-test.com`,
        password: 'ClaimPass1',
      })
      .expect(400);

    expectValidationError(res.body, ['phone']);
  });

  it('rejects weak password without a digit on claim', async () => {
    const res = await request(httpServer)
      .post(`${PATIENTS_URL}/claim`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        phone: seededWalkInPhone,
        email: `no-digit-${runId}@carekit-test.com`,
        password: 'PasswordOnly',
      })
      .expect(400);

    expectValidationError(res.body, ['password']);
  });

  it('rejects passwords longer than 128 chars on claim', async () => {
    const res = await request(httpServer)
      .post(`${PATIENTS_URL}/claim`)
      .set(getAuthHeaders(receptionist.accessToken))
      .send({
        phone: seededWalkInPhone,
        email: `too-long-${runId}@carekit-test.com`,
        password: `Aa1${'x'.repeat(126)}`,
      })
      .expect(400);

    expectValidationError(res.body, ['password']);
  });
});
