import SuperTest from 'supertest';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import {
  seedEmployee,
  seedService,
  seedBranch,
  seedEmployeeService,
} from '../../setup/seed.helper';
import { createPublicTestApp, closePublicTestApp, DETERMINISTIC_OTP } from './public-test-app';

const TEST_EMAIL_SECURITY = `security-test-${Date.now()}@example.com`;

describe('Public — Security Tests (e2e)', () => {
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

  describe('OTP Rate Limiting', () => {
    it('allows up to 3 OTP requests per minute (throttle limit = 3)', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await req
          .post('/public/otp/request')
          .send({
            identifier: `ratelimit-test-${i}@example.com`,
            channel: 'EMAIL',
            purpose: 'GUEST_BOOKING',
          });
        expect(res.status).toBe(201);
      }
    });
  });

  describe('OTP Abuse Prevention', () => {
    it('returns 401 for wrong OTP code', async () => {
      const res = await req
        .post('/public/otp/verify')
        .send({ identifier: TEST_EMAIL_SECURITY, purpose: 'GUEST_BOOKING', code: '000000' });

      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid email format in request', async () => {
      const res = await req
        .post('/public/otp/request')
        .send({ identifier: 'not-an-email', channel: 'EMAIL', purpose: 'GUEST_BOOKING' });

      expect(res.status).toBe(400);
    });
  });

  describe('Guest Booking without OTP Session', () => {
    it('returns 401 when creating booking without Authorization header', async () => {
      const res = await req
        .post('/public/bookings')
        .send({
          serviceId,
          employeeId,
          branchId,
          startsAt: futureSlot(),
          client: {
            name: 'Test User',
            phone: '+966500000001',
            email: 'no-session@example.com',
          },
        });

      expect(res.status).toBe(401);
    });

    it('returns 401 when OTP session is invalid', async () => {
      const res = await req
        .post('/public/bookings')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          serviceId,
          employeeId,
          branchId,
          startsAt: futureSlot(),
          client: {
            name: 'Test User',
            phone: '+966500000002',
            email: 'invalid-session@example.com',
          },
        });

      expect(res.status).toBe(401);
    });
  });

  describe('Payment Init without OTP Session', () => {
    it('returns 401 when initializing payment without Authorization header', async () => {
      const res = await req
        .post('/public/payments/init')
        .send({ bookingId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(401);
    });

    it('returns 401 when OTP session is invalid for payment init', async () => {
      const res = await req
        .post('/public/payments/init')
        .set('Authorization', 'Bearer invalid-token')
        .send({ bookingId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(401);
    });
  });
});
