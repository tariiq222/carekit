/**
 * CareKit — Reports CSV Export E2E Tests
 *
 * Verifies that the three CSV export endpoints return correct content-type,
 * content-disposition, and well-formed CSV text. Also confirms that missing
 * required date params return 400 and unauthenticated/unpermissioned requests
 * are rejected.
 *
 * Endpoints:
 *   GET /reports/revenue/export?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 *   GET /reports/bookings/export?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 *   GET /reports/patients/export
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  getAuthHeaders,
  TEST_USERS,
  type TestApp,
  type AuthResult,
  type TestUserData,
} from '../setup/setup';

const REPORTS_URL = `${API_PREFIX}/reports`;
const REVENUE_EXPORT = `${REPORTS_URL}/revenue/export`;
const BOOKINGS_EXPORT = `${REPORTS_URL}/bookings/export`;
const PATIENTS_EXPORT = `${REPORTS_URL}/patients/export`;

/** Fixed date range covering the current test day. */
const DATE_FROM = '2026-01-01';
const DATE_TO = '2026-12-31';

const CSV_PATIENT: TestUserData = {
  email: 'csv-export-patient1@carekit-test.com',
  password: 'Csv!Exp0rt1',
  firstName: 'مريم',
  lastName: 'الحمدان',
  phone: '+966507005001',
  gender: 'female',
};

describe('Reports CSV Export (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let superAdmin: AuthResult;
  let patient: AuthResult;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    patient = await registerTestPatient(httpServer, CSV_PATIENT);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ---------------------------------------------------------------------------
  // Revenue export
  // ---------------------------------------------------------------------------

  it('GET /reports/revenue/export — returns 200 with CSV content-type', async () => {
    const res = await request(httpServer)
      .get(REVENUE_EXPORT)
      .query({ dateFrom: DATE_FROM, dateTo: DATE_TO })
      .set(getAuthHeaders(superAdmin.accessToken))
      .buffer(true)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/i);
    expect(res.headers['content-disposition']).toMatch(/attachment/i);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(0);
  });

  it('GET /reports/revenue/export — CSV has header row (not JSON)', async () => {
    const res = await request(httpServer)
      .get(REVENUE_EXPORT)
      .query({ dateFrom: DATE_FROM, dateTo: DATE_TO })
      .set(getAuthHeaders(superAdmin.accessToken))
      .buffer(true)
      .expect(200);

    const firstLine = res.text.split('\n')[0] ?? '';

    // Must be non-empty
    expect(firstLine.trim().length).toBeGreaterThan(0);

    // Must not be JSON
    expect(() => JSON.parse(firstLine)).toThrow();
  });

  it('GET /reports/revenue/export — missing dateFrom returns 400', async () => {
    const res = await request(httpServer)
      .get(REVENUE_EXPORT)
      .query({ dateTo: DATE_TO })
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('GET /reports/revenue/export — missing dateTo returns 400', async () => {
    const res = await request(httpServer)
      .get(REVENUE_EXPORT)
      .query({ dateFrom: DATE_FROM })
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('GET /reports/revenue/export — patient lacks reports:view — 403', async () => {
    const res = await request(httpServer)
      .get(REVENUE_EXPORT)
      .query({ dateFrom: DATE_FROM, dateTo: DATE_TO })
      .set(getAuthHeaders(patient.accessToken))
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  it('GET /reports/revenue/export — unauthenticated returns 401', async () => {
    await request(httpServer)
      .get(REVENUE_EXPORT)
      .query({ dateFrom: DATE_FROM, dateTo: DATE_TO })
      .expect(401);
  });

  // ---------------------------------------------------------------------------
  // Bookings export
  // ---------------------------------------------------------------------------

  it('GET /reports/bookings/export — returns 200 with CSV content-type', async () => {
    const res = await request(httpServer)
      .get(BOOKINGS_EXPORT)
      .query({ dateFrom: DATE_FROM, dateTo: DATE_TO })
      .set(getAuthHeaders(superAdmin.accessToken))
      .buffer(true)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/i);
    expect(res.headers['content-disposition']).toMatch(/attachment/i);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(0);
  });

  it('GET /reports/bookings/export — CSV has header row (not JSON)', async () => {
    const res = await request(httpServer)
      .get(BOOKINGS_EXPORT)
      .query({ dateFrom: DATE_FROM, dateTo: DATE_TO })
      .set(getAuthHeaders(superAdmin.accessToken))
      .buffer(true)
      .expect(200);

    const firstLine = res.text.split('\n')[0] ?? '';
    expect(firstLine.trim().length).toBeGreaterThan(0);
    expect(() => JSON.parse(firstLine)).toThrow();
  });

  it('GET /reports/bookings/export — missing dateFrom returns 400', async () => {
    const res = await request(httpServer)
      .get(BOOKINGS_EXPORT)
      .query({ dateTo: DATE_TO })
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Patients export
  // ---------------------------------------------------------------------------

  it('GET /reports/patients/export — returns 200 with CSV content-type (no date params)', async () => {
    const res = await request(httpServer)
      .get(PATIENTS_EXPORT)
      .set(getAuthHeaders(superAdmin.accessToken))
      .buffer(true)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/i);
    expect(res.headers['content-disposition']).toMatch(/attachment/i);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(0);
  });

  it('GET /reports/patients/export — CSV has header row', async () => {
    const res = await request(httpServer)
      .get(PATIENTS_EXPORT)
      .set(getAuthHeaders(superAdmin.accessToken))
      .buffer(true)
      .expect(200);

    const firstLine = res.text.split('\n')[0] ?? '';
    expect(firstLine.trim().length).toBeGreaterThan(0);
    expect(() => JSON.parse(firstLine)).toThrow();
  });

  it('GET /reports/patients/export — patient lacks reports:view — 403', async () => {
    const res = await request(httpServer)
      .get(PATIENTS_EXPORT)
      .set(getAuthHeaders(patient.accessToken))
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  it('GET /reports/patients/export — unauthenticated returns 401', async () => {
    await request(httpServer).get(PATIENTS_EXPORT).expect(401);
  });
});
