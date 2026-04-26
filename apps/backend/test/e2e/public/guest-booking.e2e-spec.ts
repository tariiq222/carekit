import SuperTest from 'supertest';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import {
  seedEmployee,
  seedService,
  seedBranch,
  seedEmployeeService,
} from '../../setup/seed.helper';
import { createPublicTestApp, closePublicTestApp, capturedOtpCodes } from './public-test-app';

// Each describe block that needs OTP flow uses its own unique identifier
// to avoid per-identifier rate-limit interference between tests.
const ts = Date.now();
const EMAIL_OTP_REQUEST = `otp-req-${ts}@example.com`;
const EMAIL_OTP_VERIFY = `otp-verify-${ts}@example.com`;
const EMAIL_BOOKINGS = `bookings-${ts}@example.com`;
const EMAIL_PAYMENTS = `payments-${ts}@example.com`;

async function requestOtp(req: SuperTest.Agent, identifier: string): Promise<number> {
  const res = await req
    .post('/public/otp/request')
    .send({ identifier, channel: 'EMAIL', purpose: 'GUEST_BOOKING', hCaptchaToken: 'test-valid' });
  return res.status;
}

async function verifyOtp(req: SuperTest.Agent, identifier: string): Promise<string> {
  const code = capturedOtpCodes.get(identifier);
  if (!code) throw new Error(`No OTP captured for ${identifier}`);
  const res = await req
    .post('/public/otp/verify')
    .send({ identifier, channel: 'EMAIL', purpose: 'GUEST_BOOKING', code });
  if (res.status !== 201) throw new Error(`OTP verify failed: ${JSON.stringify(res.body)}`);
  return res.body.sessionToken as string;
}

describe('Public — Guest Booking Happy Path (e2e)', () => {
  let req: SuperTest.Agent;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;

  beforeAll(async () => {
    ({ request: req } = await createPublicTestApp());
    await cleanTables([
      'UsedOtpSession', 'Booking', 'Invoice', 'Payment', 'OtpCode',
      'Client', 'EmployeeService', 'EmployeeBranch', 'Employee', 'Service', 'Branch',
    ]);

    const [employee, service, branch] = await Promise.all([
      seedEmployee(testPrisma as never),
      seedService(testPrisma as never, { durationMins: 60, price: 200 }),
      seedBranch(testPrisma as never),
    ]);
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;

    await seedEmployeeService(testPrisma as never, employeeId, serviceId);
    await testPrisma.employeeBranch.create({ data: { organizationId: '00000000-0000-0000-0000-000000000001', employeeId, branchId } });
  });

  afterAll(async () => {
    await cleanTables([
      'UsedOtpSession', 'Booking', 'Invoice', 'Payment', 'OtpCode',
      'Client', 'EmployeeService', 'EmployeeBranch', 'Employee', 'Service', 'Branch',
    ]);
    await closePublicTestApp();
  });

  const futureSlot = () => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  };

  // ── OTP Request ────────────────────────────────────────────────────────────

  describe('POST /public/otp/request', () => {
    it('returns 201 for a valid email OTP request with valid captcha', async () => {
      const res = await req
        .post('/public/otp/request')
        .send({ identifier: EMAIL_OTP_REQUEST, channel: 'EMAIL', purpose: 'GUEST_BOOKING', hCaptchaToken: 'test-valid' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true });
    });

    it('inserts an OtpCode row into the database', async () => {
      const row = await testPrisma.otpCode.findFirst({
        where: { identifier: EMAIL_OTP_REQUEST },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).not.toBeNull();
      expect(row!.consumedAt).toBeNull();
    });

    it('returns 400 for an invalid email', async () => {
      const res = await req
        .post('/public/otp/request')
        .send({ identifier: 'not-valid', channel: 'EMAIL', purpose: 'GUEST_BOOKING', hCaptchaToken: 'test-valid' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when captcha token is missing', async () => {
      const res = await req
        .post('/public/otp/request')
        .send({ identifier: `missing-cap-${ts}@example.com`, channel: 'EMAIL', purpose: 'GUEST_BOOKING' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when captcha token is invalid and does not insert an OtpCode row', async () => {
      const badCaptchaEmail = `bad-cap-${ts}@example.com`;
      const res = await req
        .post('/public/otp/request')
        .send({ identifier: badCaptchaEmail, channel: 'EMAIL', purpose: 'GUEST_BOOKING', hCaptchaToken: 'invalid-token' });

      expect(res.status).toBe(400);

      const row = await testPrisma.otpCode.findFirst({ where: { identifier: badCaptchaEmail } });
      expect(row).toBeNull();
    });
  });

  // ── OTP Verify ─────────────────────────────────────────────────────────────

  describe('POST /public/otp/verify', () => {
    beforeAll(async () => {
      await requestOtp(req, EMAIL_OTP_VERIFY);
    });

    it('returns a session token for the correct OTP code', async () => {
      const code = capturedOtpCodes.get(EMAIL_OTP_VERIFY);
      expect(code).toBeDefined();

      const res = await req
        .post('/public/otp/verify')
        .send({ identifier: EMAIL_OTP_VERIFY, channel: 'EMAIL', purpose: 'GUEST_BOOKING', code: code! });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('sessionToken');
    });

    it('returns 401 for wrong OTP code', async () => {
      // Fresh identifier to avoid consumed-OTP edge case.
      const id = `wrong-code-${ts}@example.com`;
      await requestOtp(req, id);

      const res = await req
        .post('/public/otp/verify')
        .send({ identifier: id, channel: 'EMAIL', purpose: 'GUEST_BOOKING', code: '0000' });

      expect(res.status).toBe(401);
    });
  });

  // ── Guest Booking ──────────────────────────────────────────────────────────

  describe('POST /public/bookings', () => {
    let sessionToken: string;

    beforeAll(async () => {
      await requestOtp(req, EMAIL_BOOKINGS);
      sessionToken = await verifyOtp(req, EMAIL_BOOKINGS);
    });

    it('creates a booking in AWAITING_PAYMENT status', async () => {
      const res = await req
        .post('/public/bookings')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          serviceId,
          employeeId,
          branchId,
          startsAt: futureSlot(),
          client: {
            name: 'Ahmed Mohammed',
            phone: '+966501234567',
            email: EMAIL_BOOKINGS,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('bookingId');
      expect(res.body).toHaveProperty('invoiceId');

      const booking = await testPrisma.booking.findUnique({ where: { id: res.body.bookingId as string } });
      expect(booking!.status).toBe('AWAITING_PAYMENT');
    });

    it('records the jti as used so the session cannot be replayed', async () => {
      // sessionToken was consumed above — replay must fail.
      const res = await req
        .post('/public/bookings')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          serviceId,
          employeeId,
          branchId,
          startsAt: futureSlot(),
          client: { name: 'Ahmed Mohammed', phone: '+966501234568', email: EMAIL_BOOKINGS },
        });

      expect(res.status).toBe(401);
    });

    it('returns 401 without OTP session', async () => {
      const res = await req
        .post('/public/bookings')
        .send({
          serviceId,
          employeeId,
          branchId,
          startsAt: futureSlot(),
          client: { name: 'Test', phone: '+966500000001', email: 'no-session@example.com' },
        });

      expect(res.status).toBe(401);
    });
  });

  // ── Payment Init ───────────────────────────────────────────────────────────

  describe('POST /public/payments/init', () => {
    let sessionToken: string;

    beforeAll(async () => {
      await requestOtp(req, EMAIL_PAYMENTS);
      sessionToken = await verifyOtp(req, EMAIL_PAYMENTS);
    });

    it('returns a moyasar redirect URL and creates a PENDING Payment row', async () => {
      const booking = await testPrisma.booking.findFirst({
        where: { status: 'AWAITING_PAYMENT' },
        orderBy: { createdAt: 'desc' },
      });
      expect(booking).not.toBeNull();

      const res = await req
        .post('/public/payments/init')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ bookingId: booking!.id });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('paymentId');
      expect(res.body).toHaveProperty('redirectUrl');
      expect(res.body.redirectUrl as string).toContain('moyasar');

      const payment = await testPrisma.payment.findFirst({
        where: { idempotencyKey: `guest:${booking!.id}` },
      });
      expect(payment).not.toBeNull();
      expect(payment!.status).toBe('PENDING');
      expect(payment!.invoiceId).not.toBeNull();
    });

    it('returns 404 for unknown booking', async () => {
      const res = await req
        .post('/public/payments/init')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ bookingId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
    });
  });
});
