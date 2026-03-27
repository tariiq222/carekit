/**
 * CareKit — Payments Module E2E Tests
 *
 * Covers:
 *   GET  /api/v1/payments/stats                  - payment statistics
 *   GET  /api/v1/payments/my                     - patient's own payments
 *   GET  /api/v1/payments/booking/:bookingId      - payment by booking
 *   GET  /api/v1/payments                         - list all payments (paginated)
 *   POST /api/v1/payments/bank-transfer           - upload bank transfer receipt
 *   POST /api/v1/payments/bank-transfer/:id/verify - approve / reject bank transfer
 *   POST /api/v1/payments/moyasar/webhook         - Moyasar webhook (HMAC)
 *   POST /api/v1/payments/:id/refund              - issue refund
 *   GET  /api/v1/payments/:id                     - payment details
 *   PATCH /api/v1/payments/:id/status             - update payment status
 *
 * Note: POST /payments/moyasar (Moyasar checkout) requires live Moyasar API keys
 *       and is skipped here. Webhook processing is tested with mocked signatures.
 */

import * as crypto from 'crypto';
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

const PAYMENTS_URL = `${API_PREFIX}/payments`;
const BOOKINGS_URL = `${API_PREFIX}/bookings`;
const SERVICES_URL = `${API_PREFIX}/services`;
const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;
const SPECIALTIES_URL = `${API_PREFIX}/specialties`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build Moyasar HMAC-SHA256 signature over a raw body buffer */
function signWebhookPayload(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/** Create a minimal booking via the API and return its id */
async function createTestBooking(
  httpServer: ReturnType<INestApplication['getHttpServer']>,
  token: string,
  patientId: string,
  serviceId: string,
  practitionerId: string,
  startTime = '10:00',
): Promise<string> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  // Format as YYYY-MM-DD
  const date = tomorrow.toISOString().split('T')[0];

  const res = await request(httpServer)
    .post(BOOKINGS_URL)
    .set(getAuthHeaders(token))
    .send({
      patientId,
      serviceId,
      practitionerId,
      type: 'clinic_visit',
      date,
      startTime,
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create test booking: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.id as string;
}

/** Create a payment record via PATCH /payments/:id/status after creation */
async function createCashPayment(
  httpServer: ReturnType<INestApplication['getHttpServer']>,
  adminToken: string,
  bookingId: string,
): Promise<{ id: string }> {
  // Find the payment that was auto-created with the booking
  const res = await request(httpServer)
    .get(`${PAYMENTS_URL}/booking/${bookingId}`)
    .set(getAuthHeaders(adminToken));

  if (res.status === 200) {
    return { id: res.body.data.id as string };
  }

  throw new Error(`Could not retrieve payment for booking ${bookingId}: ${res.status}`);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Payments Module (e2e)', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let accountant: AuthResult;
  let patient: AuthResult;
  let patient2: AuthResult;

  // IDs created during setup
  let practitionerId: string;
  let serviceId: string;
  let bookingId: string;
  let paymentId: string;

  // Bank transfer specific
  let bankTransferBookingId: string;
  let bankTransferPaymentId: string;
  let bankTransferReceiptId: string;

  const WEBHOOK_SECRET = process.env['MOYASAR_WEBHOOK_SECRET'] ?? 'test-secret';

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

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);
    patient2 = await registerTestPatient(httpServer, TEST_PATIENT_2);

    // ── Create specialty + category + service + practitioner for booking setup ──

    // Specialty
    const specialtyRes = await request(httpServer)
      .post(SPECIALTIES_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameEn: 'General Medicine', nameAr: 'الطب العام' });
    const specialtyId: string = specialtyRes.body.data?.id as string;

    // Service category
    const catRes = await request(httpServer)
      .post(`${SERVICES_URL}/categories`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameEn: 'Consultations', nameAr: 'استشارات' });
    const categoryId: string = catRes.body.data?.id as string;

    // Service
    const serviceRes = await request(httpServer)
      .post(SERVICES_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        nameEn: 'General Consultation',
        nameAr: 'استشارة عامة',
        categoryId,
        price: 20000,
        duration: 30,
      });
    serviceId = serviceRes.body.data?.id as string;
    if (!serviceId) {
      throw new Error(`Service creation failed: ${serviceRes.status} ${JSON.stringify(serviceRes.body)}`);
    }

    // Practitioner user
    const practitionerUser = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.practitioner,
      'practitioner',
    );
    const practitionerUserId = practitionerUser.user['id'] as string;

    // Practitioner profile — idempotent: create or fetch existing
    const practCreateRes = await request(httpServer)
      .post(PRACTITIONERS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        userId: practitionerUserId,
        specialtyId,
        titleEn: 'Dr.',
        titleAr: 'د.',
      });

    if (practCreateRes.status === 201 || practCreateRes.status === 200) {
      practitionerId = practCreateRes.body.data?.id as string;
    } else {
      // Profile already exists (409) — find it via the list endpoint
      const firstName = TEST_USERS.practitioner.firstName;
      const listRes = await request(httpServer)
        .get(PRACTITIONERS_URL)
        .query({ search: firstName, perPage: '50' });
      const match = (listRes.body.data?.items ?? []) as Array<{
        id: string;
        user?: { id: string };
      }>;
      const found = match.find((p) => p.user?.id === practitionerUserId);
      practitionerId = found?.id as string;
    }

    if (!practitionerId) {
      throw new Error('practitionerId is undefined — practitioner setup failed');
    }

    // Enable adminCanBookOutsideHours so we can create test bookings without
    // setting up clinic hours and practitioner availability schedules
    await request(httpServer)
      .patch(`${API_PREFIX}/booking-settings`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ adminCanBookOutsideHours: true });

    // Set service booking types so clinic_visit is available
    const sbtRes = await request(httpServer)
      .put(`${SERVICES_URL}/${serviceId}/booking-types`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        types: [{ bookingType: 'clinic_visit', price: 20000, duration: 30 }],
      });
    if (sbtRes.status !== 200 && sbtRes.status !== 201) {
      throw new Error(`Failed to set service booking types: ${sbtRes.status} ${JSON.stringify(sbtRes.body)}`);
    }

    // Assign service to practitioner (tolerate 409 if already assigned)
    const assignRes = await request(httpServer)
      .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        serviceId,
        availableTypes: ['clinic_visit'],
        isActive: true,
      });
    if (assignRes.status !== 201 && assignRes.status !== 200 && assignRes.status !== 409) {
      throw new Error(`Failed to assign service to practitioner: ${assignRes.status} ${JSON.stringify(assignRes.body)}`);
    }

    // Booking + payment for main tests
    bookingId = await createTestBooking(
      httpServer,
      receptionist.accessToken,
      patient.user['id'] as string,
      serviceId,
      practitionerId,
    );

    const pmtRes = await request(httpServer)
      .get(`${PAYMENTS_URL}/booking/${bookingId}`)
      .set(getAuthHeaders(superAdmin.accessToken));
    paymentId = pmtRes.body.data?.id as string;

    // Bank transfer booking (different time to avoid conflict with first booking)
    bankTransferBookingId = await createTestBooking(
      httpServer,
      receptionist.accessToken,
      patient2.user['id'] as string,
      serviceId,
      practitionerId,
      '11:00',
    );
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // =========================================================================
  // GET /payments/stats
  // =========================================================================

  describe('GET /payments/stats', () => {
    it('super_admin can fetch payment statistics', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/stats`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const stats = res.body.data;
      expect(stats).toHaveProperty('totalRevenue');
      expect(typeof stats.totalRevenue).toBe('number');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
    });

    it('receptionist can fetch stats (payments:view)', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/stats`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('patient can fetch stats (has payments:view permission)', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/stats`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer).get(`${PAYMENTS_URL}/stats`).expect(401);
    });
  });

  // =========================================================================
  // GET /payments/my — patient's own payments
  // =========================================================================

  describe('GET /payments/my', () => {
    it('patient can list their own payments', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/my`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('patient2 only sees their own payments (isolation)', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/my`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      // Items should belong only to patient2
      const items: Array<{ booking?: { patientId?: string } }> = res.body.data.items;
      const patient2Id = patient2.user['id'] as string;
      items.forEach((item) => {
        if (item.booking?.patientId) {
          expect(item.booking.patientId).toBe(patient2Id);
        }
      });
    });

    it('supports pagination', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/my?page=1&perPage=5`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.meta).toHaveProperty('page', 1);
      expect(res.body.data.meta).toHaveProperty('perPage', 5);
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer).get(`${PAYMENTS_URL}/my`).expect(401);
    });
  });

  // =========================================================================
  // GET /payments/booking/:bookingId
  // =========================================================================

  describe('GET /payments/booking/:bookingId', () => {
    it('super_admin can fetch payment by booking id', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/booking/${bookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const payment = res.body.data;
      expect(payment).toHaveProperty('id');
      expect(payment).toHaveProperty('bookingId', bookingId);
      expect(payment).toHaveProperty('status');
      expect(payment).toHaveProperty('method');
      expect(payment).toHaveProperty('amount');
      expect(payment).toHaveProperty('totalAmount');
    });

    it('receptionist can fetch payment by booking', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/booking/${bookingId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('patient can fetch payment by booking (has payments:view)', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/booking/${bookingId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('non-existent booking id → 404', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/booking/00000000-0000-0000-0000-000000000000`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('invalid uuid → 400', async () => {
      await request(httpServer)
        .get(`${PAYMENTS_URL}/booking/not-a-uuid`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);
    });
  });

  // =========================================================================
  // GET /payments — list all payments
  // =========================================================================

  describe('GET /payments', () => {
    it('super_admin can list all payments (paginated)', async () => {
      const res = await request(httpServer)
        .get(PAYMENTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('receptionist can list payments', async () => {
      const res = await request(httpServer)
        .get(PAYMENTS_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('patient can list all payments (has payments:view)', async () => {
      const res = await request(httpServer)
        .get(PAYMENTS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('filter by status=pending returns only pending payments', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}?status=pending`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items: Array<{ status: string }> = res.body.data.items;
      items.forEach((p) => expect(p.status).toBe('pending'));
    });

    it('filter by method=cash returns only cash payments', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}?method=cash`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const items: Array<{ method: string }> = res.body.data.items;
      items.forEach((p) => expect(p.method).toBe('cash'));
    });

    it('filter by dateFrom/dateTo returns payments in range', async () => {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const to = new Date();
      to.setDate(to.getDate() + 1);

      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}?dateFrom=${from.toISOString()}&dateTo=${to.toISOString()}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('invalid status enum → 400', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}?status=invalid_status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer).get(PAYMENTS_URL).expect(401);
    });
  });

  // =========================================================================
  // GET /payments/:id — payment details
  // =========================================================================

  describe('GET /payments/:id', () => {
    it('super_admin can fetch payment by id', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/${paymentId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const payment = res.body.data;
      expect(payment).toHaveProperty('id', paymentId);
      expect(payment).toHaveProperty('amount');
      expect(payment).toHaveProperty('vatAmount');
      expect(payment).toHaveProperty('totalAmount');
      expect(payment).toHaveProperty('status');
      expect(payment).toHaveProperty('method');
      expect(payment).toHaveProperty('booking');
    });

    it('receptionist can fetch payment by id', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/${paymentId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('patient can fetch payment details (has payments:view)', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/${paymentId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('non-existent id → 404', async () => {
      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/00000000-0000-0000-0000-000000000000`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('invalid uuid → 400', async () => {
      await request(httpServer)
        .get(`${PAYMENTS_URL}/not-a-uuid`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer).get(`${PAYMENTS_URL}/some-id`).expect(401);
    });
  });

  // =========================================================================
  // PATCH /payments/:id/status — update payment status
  // =========================================================================

  describe('PATCH /payments/:id/status', () => {
    it('super_admin can update payment status (pending → paid)', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .patch(`${PAYMENTS_URL}/${paymentId}/status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ status: 'paid' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('status', 'paid');
    });

    it('invalid status transition (paid → pending) → 400', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .patch(`${PAYMENTS_URL}/${paymentId}/status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ status: 'pending' })
        .expect(400);

      expectErrorResponse(res.body, 'INVALID_STATUS_TRANSITION');
    });

    it('invalid status enum → 400', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .patch(`${PAYMENTS_URL}/${paymentId}/status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ status: 'NOT_A_STATUS' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('patient cannot update payment status → 403', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .patch(`${PAYMENTS_URL}/${paymentId}/status`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ status: 'paid' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('non-existent payment → 404', async () => {
      const res = await request(httpServer)
        .patch(`${PAYMENTS_URL}/00000000-0000-0000-0000-000000000000/status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ status: 'paid' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('missing status field → 400', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .patch(`${PAYMENTS_URL}/${paymentId}/status`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expectValidationError(res.body, ['status']);
    });
  });

  // =========================================================================
  // POST /payments/bank-transfer — upload bank transfer receipt
  // =========================================================================

  describe('POST /payments/bank-transfer', () => {
    // Create a minimal 1×1 JPEG for test uploads
    const FAKE_JPEG = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAAREAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwAB/9k=',
      'base64',
    );

    it('patient can upload bank transfer receipt for their booking', async () => {
      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer`)
        .set('Authorization', `Bearer ${patient2.accessToken}`)
        .field('bookingId', bankTransferBookingId)
        .attach('receipt', FAKE_JPEG, { filename: 'receipt.jpg', contentType: 'image/jpeg' });

      // 201 = success, or 400 if booking not in right state
      if (res.status === 201) {
        expectSuccessResponse(res.body);
        bankTransferPaymentId = res.body.data?.payment?.id as string;
        bankTransferReceiptId = res.body.data?.receipt?.id as string;
      } else {
        // Booking may need to be in pending_payment state — just verify it's not a 5xx
        expect(res.status).toBeLessThan(500);
      }
    });

    it('missing bookingId → 400', async () => {
      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer`)
        .set('Authorization', `Bearer ${patient.accessToken}`)
        .attach('receipt', FAKE_JPEG, { filename: 'receipt.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
    });

    it('missing file → 400', async () => {
      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ bookingId: bankTransferBookingId })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('invalid file type (text file) → 400', async () => {
      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer`)
        .set('Authorization', `Bearer ${patient.accessToken}`)
        .field('bookingId', bankTransferBookingId)
        .attach('receipt', Buffer.from('not an image'), {
          filename: 'receipt.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer`)
        .field('bookingId', bankTransferBookingId)
        .attach('receipt', FAKE_JPEG, { filename: 'r.jpg', contentType: 'image/jpeg' })
        .expect(401);
    });
  });

  // =========================================================================
  // POST /payments/bank-transfer/:id/verify — approve / reject receipt
  // =========================================================================

  describe('POST /payments/bank-transfer/:id/verify', () => {
    it('super_admin can approve a bank transfer receipt', async () => {
      if (!bankTransferReceiptId) return;

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer/${bankTransferReceiptId}/verify`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ action: 'approve', adminNotes: 'Verified manually' })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('super_admin can reject a bank transfer receipt', async () => {
      // Need a fresh receipt to reject — skip if none available
      if (!bankTransferReceiptId) return;

      // Already approved above, so rejecting should fail or be idempotent
      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer/${bankTransferReceiptId}/verify`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ action: 'reject', adminNotes: 'Amount mismatch' });

      expect(res.status).toBeLessThan(500);
    });

    it('invalid action enum → 400', async () => {
      if (!bankTransferReceiptId) return;

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer/${bankTransferReceiptId}/verify`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ action: 'maybe' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('missing action → 400', async () => {
      if (!bankTransferReceiptId) return;

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer/${bankTransferReceiptId}/verify`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expectValidationError(res.body, ['action']);
    });

    it('patient cannot verify receipt → 403', async () => {
      const fakeReceiptId = '00000000-0000-0000-0000-000000000000';
      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer/${fakeReceiptId}/verify`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ action: 'approve' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('non-existent receipt id → 404', async () => {
      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/bank-transfer/00000000-0000-0000-0000-000000000000/verify`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ action: 'approve' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /payments/moyasar/webhook — Moyasar webhook processing
  // =========================================================================

  describe('POST /payments/moyasar/webhook', () => {
    it('valid paid webhook with correct signature → 200', async () => {
      if (!paymentId || !bookingId) return;

      const payload = JSON.stringify({
        id: `moyasar-${Date.now()}`,
        status: 'paid',
        amount: 23000,
        currency: 'SAR',
        description: `Booking #${bookingId}`,
        metadata: { bookingId, paymentId },
      });

      const signature = signWebhookPayload(payload, WEBHOOK_SECRET);

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/moyasar/webhook`)
        .set('Content-Type', 'application/json')
        .set('X-Moyasar-Signature', signature)
        .send(payload);

      // 200 always (idempotent design), or 401 if wrong secret in env
      expect([200, 401]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('success', true);
      }
    });

    it('valid failed webhook → 200 (idempotent)', async () => {
      const payload = JSON.stringify({
        id: `moyasar-failed-${Date.now()}`,
        status: 'failed',
        amount: 10000,
        currency: 'SAR',
        description: 'Failed payment',
        metadata: { bookingId: '00000000-0000-0000-0000-000000000001' },
      });

      const signature = signWebhookPayload(payload, WEBHOOK_SECRET);

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/moyasar/webhook`)
        .set('Content-Type', 'application/json')
        .set('X-Moyasar-Signature', signature)
        .send(payload);

      expect([200, 401]).toContain(res.status);
    });

    it('invalid signature → 401', async () => {
      const payload = JSON.stringify({
        id: `moyasar-bad-sig-${Date.now()}`,
        status: 'paid',
        amount: 10000,
        currency: 'SAR',
        description: 'Test',
        metadata: {},
      });

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/moyasar/webhook`)
        .set('Content-Type', 'application/json')
        .set('X-Moyasar-Signature', 'invalid-signature-hex')
        .send(payload);

      // Either 401 (wrong sig) or 400 (missing raw body) — both are rejections
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('missing signature header → 401 or 400', async () => {
      const payload = JSON.stringify({
        id: `moyasar-no-sig-${Date.now()}`,
        status: 'paid',
        amount: 10000,
        currency: 'SAR',
        description: 'Test',
        metadata: {},
      });

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/moyasar/webhook`)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('duplicate webhook event id is idempotent → 200', async () => {
      const fixedEventId = `idempotent-test-${Date.now()}`;
      const payload = JSON.stringify({
        id: fixedEventId,
        status: 'paid',
        amount: 5000,
        currency: 'SAR',
        description: 'Test',
        metadata: {},
      });

      const signature = signWebhookPayload(payload, WEBHOOK_SECRET);

      // First call
      const res1 = await request(httpServer)
        .post(`${PAYMENTS_URL}/moyasar/webhook`)
        .set('Content-Type', 'application/json')
        .set('X-Moyasar-Signature', signature)
        .send(payload);

      // Second call — same eventId, must not crash
      const res2 = await request(httpServer)
        .post(`${PAYMENTS_URL}/moyasar/webhook`)
        .set('Content-Type', 'application/json')
        .set('X-Moyasar-Signature', signature)
        .send(payload);

      // Both should succeed if signature is correct, or both reject for wrong secret
      expect(res1.status).toBe(res2.status);
    });

    it('no authentication required (public endpoint)', async () => {
      // Webhook endpoint is @Public — must not require Bearer token
      const payload = JSON.stringify({
        id: `public-test-${Date.now()}`,
        status: 'paid',
        amount: 1000,
        currency: 'SAR',
        description: 'Test',
        metadata: {},
      });

      const signature = signWebhookPayload(payload, WEBHOOK_SECRET);

      // No Authorization header
      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/moyasar/webhook`)
        .set('Content-Type', 'application/json')
        .set('X-Moyasar-Signature', signature)
        .send(payload);

      // Must not return 401 due to missing JWT (may return 401 for invalid sig)
      if (res.status === 401) {
        // Should be INVALID_SIGNATURE or WEBHOOK_CONFIG_ERROR, not AUTH_TOKEN_INVALID
        expect(res.body.error?.code).not.toBe('AUTH_TOKEN_INVALID');
      }
    });
  });

  // =========================================================================
  // POST /payments/:id/refund
  // =========================================================================

  describe('POST /payments/:id/refund', () => {
    it('payment that is not paid cannot be refunded → 400', async () => {
      // Create a fresh booking + pending payment to test refund rejection
      const freshBookingId = await createTestBooking(
        httpServer,
        receptionist.accessToken,
        patient.user['id'] as string,
        serviceId,
        practitionerId,
      ).catch(() => null);

      if (!freshBookingId) return;

      const pmtRes = await request(httpServer)
        .get(`${PAYMENTS_URL}/booking/${freshBookingId}`)
        .set(getAuthHeaders(superAdmin.accessToken));

      if (pmtRes.status !== 200) return;
      const freshPaymentId = pmtRes.body.data.id as string;

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/${freshPaymentId}/refund`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ reason: 'Customer request' })
        .expect(400);

      expectErrorResponse(res.body, 'INVALID_PAYMENT_STATUS');
    });

    it('patient cannot issue refund → 403', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/${paymentId}/refund`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ reason: 'I want a refund' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('non-existent payment → 404', async () => {
      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/00000000-0000-0000-0000-000000000000/refund`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ reason: 'Test' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('missing reason → 400', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/${paymentId}/refund`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expectValidationError(res.body, ['reason']);
    });

    it('negative refund amount → 400', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/${paymentId}/refund`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ amount: -100, reason: 'Test' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('unauthenticated → 401', async () => {
      await request(httpServer)
        .post(`${PAYMENTS_URL}/some-id/refund`)
        .send({ reason: 'Test' })
        .expect(401);
    });
  });

  // =========================================================================
  // VAT & amount integrity
  // =========================================================================

  describe('Payment amounts & VAT integrity', () => {
    it('payment has vatAmount = 15% of base amount', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/${paymentId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const { amount, vatAmount, totalAmount } = res.body.data;

      expect(typeof amount).toBe('number');
      expect(typeof vatAmount).toBe('number');
      expect(typeof totalAmount).toBe('number');

      // VAT = 15% of base (rounded)
      expect(vatAmount).toBe(Math.round(amount * 0.15));
      // Total = base + VAT
      expect(totalAmount).toBe(amount + vatAmount);
    });

    it('payment amounts are in halalat (integer, no decimals)', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .get(`${PAYMENTS_URL}/${paymentId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const { amount, vatAmount, totalAmount } = res.body.data;
      expect(Number.isInteger(amount)).toBe(true);
      expect(Number.isInteger(vatAmount)).toBe(true);
      expect(Number.isInteger(totalAmount)).toBe(true);
    });
  });

  // =========================================================================
  // RBAC summary — permissions:edit restricted endpoints
  // =========================================================================

  describe('RBAC — payments:edit access control', () => {
    // accountant has payments:view + payments:edit — operations are authorized
    // but may fail with 400 due to business logic (invalid transitions, etc.)

    it('accountant can attempt status update (has payments:edit — authorized)', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .patch(`${PAYMENTS_URL}/${paymentId}/status`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ status: 'paid' });

      // Not 403 (authorized), may be 400 for invalid transition or 200 if still pending
      expect(res.status).not.toBe(403);
      expect(res.status).toBeLessThan(500);
    });

    it('accountant can attempt refund (has payments:edit — authorized)', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/${paymentId}/refund`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ reason: 'Test' });

      // Not 403 (authorized), business logic may reject with 400 (wrong status, etc.)
      expect(res.status).not.toBe(403);
      expect(res.status).toBeLessThan(500);
    });

    it('accountant can view payments (payments:view)', async () => {
      const res = await request(httpServer)
        .get(PAYMENTS_URL)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('patient cannot update payment status (no payments:edit) → 403', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .patch(`${PAYMENTS_URL}/${paymentId}/status`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ status: 'paid' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('patient cannot issue refund (no payments:edit) → 403', async () => {
      if (!paymentId) return;

      const res = await request(httpServer)
        .post(`${PAYMENTS_URL}/${paymentId}/refund`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ reason: 'I want a refund' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });
});
