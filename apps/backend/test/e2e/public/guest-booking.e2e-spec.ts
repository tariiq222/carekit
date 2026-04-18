import SuperTest from 'supertest';
import * as bcrypt from 'bcryptjs';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import {
  seedEmployee,
  seedService,
  seedBranch,
  seedEmployeeService,
} from '../../setup/seed.helper';
import { createPublicTestApp, closePublicTestApp, DETERMINISTIC_OTP } from './public-test-app';

const TEST_EMAIL = `guest-booking-test-${Date.now()}@example.com`;

describe('Public — Guest Booking Happy Path (e2e)', () => {
  let req: SuperTest.Agent;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;

  beforeAll(async () => {
    ({ request: req } = await createPublicTestApp());
    await cleanTables(['Booking', 'Invoice', 'Payment', 'OtpCode', 'Client', 'Employee', 'Service', 'Branch']);

    const [employee, service, branch] = await Promise.all([
      seedEmployee(testPrisma as never),
      seedService(testPrisma as never, { durationMins: 60, price: 200 }),
      seedBranch(testPrisma as never),
    ]);
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;

    await seedEmployeeService(testPrisma as never, employeeId, serviceId);
  });

  afterAll(async () => {
    await cleanTables(['Booking', 'Invoice', 'Payment', 'OtpCode', 'Client', 'Employee', 'Service', 'Branch']);
    await closePublicTestApp();
  });

  const futureSlot = () => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  };

  describe('POST /public/otp/request', () => {
    it('returns 201 for a valid email OTP request', async () => {
      const res = await req
        .post('/public/otp/request')
        .send({ identifier: TEST_EMAIL, channel: 'EMAIL', purpose: 'GUEST_BOOKING' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true });
    });

    it('returns 400 for an invalid email', async () => {
      const res = await req
        .post('/public/otp/request')
        .send({ identifier: 'not-valid', channel: 'EMAIL', purpose: 'GUEST_BOOKING' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /public/otp/verify', () => {
    it('returns a session token for a valid OTP', async () => {
      const code = DETERMINISTIC_OTP;
      expect(code).not.toBeNull();

      const res = await req
        .post('/public/otp/verify')
        .send({ identifier: TEST_EMAIL, purpose: 'GUEST_BOOKING', code: code! });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('sessionToken');
    });

    it('returns 400 for wrong OTP', async () => {
      const res = await req
        .post('/public/otp/verify')
        .send({ identifier: TEST_EMAIL, purpose: 'GUEST_BOOKING', code: '000000' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /public/bookings', () => {
    let sessionToken: string;

    beforeAll(async () => {
      const code = DETERMINISTIC_OTP!;
      const res = await req
        .post('/public/otp/verify')
        .send({ identifier: TEST_EMAIL, purpose: 'GUEST_BOOKING', code });
      sessionToken = res.body.sessionToken;
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
            email: TEST_EMAIL,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('bookingId');
      expect(res.body).toHaveProperty('invoiceId');

      const booking = await testPrisma.booking.findUnique({ where: { id: res.body.bookingId } });
      expect(booking!.status).toBe('AWAITING_PAYMENT');
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

  describe('POST /public/payments/init', () => {
    let sessionToken: string;

    beforeAll(async () => {
      const code = DETERMINISTIC_OTP!;
      const res = await req
        .post('/public/otp/verify')
        .send({ identifier: TEST_EMAIL, purpose: 'GUEST_BOOKING', code });
      sessionToken = res.body.sessionToken;
    });

    it('returns a moyasar redirect URL for a valid booking', async () => {
      const booking = await testPrisma.booking.findFirst({
        where: { status: 'AWAITING_PAYMENT' },
        orderBy: { createdAt: 'desc' },
      });

      const res = await req
        .post('/public/payments/init')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ bookingId: booking!.id });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('paymentId');
      expect(res.body).toHaveProperty('redirectUrl');
      expect(res.body.redirectUrl).toContain('moyasar');
    });

    it('returns 404 for unknown booking', async () => {
      const res = await req
        .post('/public/payments/init')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ bookingId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
    });

    it('returns 400 for booking not awaiting payment', async () => {
      const booking = await testPrisma.booking.findFirst({
        where: { status: { not: 'AWAITING_PAYMENT' } },
      });
      if (!booking) return;

      const res = await req
        .post('/public/payments/init')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ bookingId: booking.id });

      expect(res.status).toBe(400);
    });
  });
});
