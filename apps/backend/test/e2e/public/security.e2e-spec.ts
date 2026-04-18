import SuperTest from 'supertest';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import {
  seedEmployee,
  seedService,
  seedBranch,
  seedEmployeeService,
} from '../../setup/seed.helper';
import { createPublicTestApp, closePublicTestApp, capturedOtpCodes } from './public-test-app';

const BASE_EMAIL = `sec-test-${Date.now()}`;

function uniqueEmail(tag: string) {
  return `${BASE_EMAIL}-${tag}@example.com`;
}

async function requestOtp(req: SuperTest.Agent, identifier: string): Promise<number> {
  const res = await req.post('/public/otp/request').send({
    identifier,
    channel: 'EMAIL',
    purpose: 'GUEST_BOOKING',
    hCaptchaToken: 'test-valid',
  });
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

describe('Public — Security Tests (e2e)', () => {
  let req: SuperTest.Agent;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;
  let otherBranchId: string;

  beforeAll(async () => {
    ({ request: req } = await createPublicTestApp());
    await cleanTables([
      'UsedOtpSession', 'Booking', 'Invoice', 'Payment', 'OtpCode',
      'Client', 'EmployeeService', 'EmployeeBranch', 'Employee', 'Service', 'Branch',
    ]);

    const [employee, service, branch, otherBranch] = await Promise.all([
      seedEmployee(testPrisma as never),
      seedService(testPrisma as never, { durationMins: 60, price: 200 }),
      seedBranch(testPrisma as never),
      seedBranch(testPrisma as never, { nameAr: 'Other Branch' }),
    ]);
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;
    otherBranchId = otherBranch.id;

    await seedEmployeeService(testPrisma as never, employeeId, serviceId);
    // Employee is assigned to `branchId` only — not to `otherBranchId`.
    await testPrisma.employeeBranch.create({ data: { employeeId, branchId } });
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

  // ── 1. Empty captcha ──────────────────────────────────────────────────────
  describe('1. Empty captcha token → 400 and no OtpCode row inserted', () => {
    const identifier = uniqueEmail('no-captcha');

    it('rejects with 400', async () => {
      const res = await req.post('/public/otp/request').send({
        identifier,
        channel: 'EMAIL',
        purpose: 'GUEST_BOOKING',
        hCaptchaToken: '',
      });
      expect(res.status).toBe(400);
    });

    it('does not insert an OtpCode row', async () => {
      const row = await testPrisma.otpCode.findFirst({ where: { identifier } });
      expect(row).toBeNull();
    });
  });

  // ── 2. Invalid captcha token ──────────────────────────────────────────────
  describe('2. Invalid captcha token → 400 and no OtpCode row inserted', () => {
    const identifier = uniqueEmail('bad-captcha');

    it('rejects with 400', async () => {
      const res = await req.post('/public/otp/request').send({
        identifier,
        channel: 'EMAIL',
        purpose: 'GUEST_BOOKING',
        hCaptchaToken: 'invalid-token',
      });
      expect(res.status).toBe(400);
    });

    it('does not insert an OtpCode row', async () => {
      const row = await testPrisma.otpCode.findFirst({ where: { identifier } });
      expect(row).toBeNull();
    });
  });

  // ── 3. Per-identifier cap: 6th request for same identifier → 429 ─────────
  describe('3. Per-identifier OTP cap → 429 on 6th request regardless of IP', () => {
    const identifier = uniqueEmail('rate-limited');

    it('allows first 5 OTP requests', async () => {
      for (let i = 0; i < 5; i++) {
        // Rotate X-Forwarded-For to confirm the cap is per-identifier, not per-IP.
        const res = await req
          .post('/public/otp/request')
          .set('X-Forwarded-For', `10.0.0.${i + 1}`)
          .send({ identifier, channel: 'EMAIL', purpose: 'GUEST_BOOKING', hCaptchaToken: 'test-valid' });
        expect(res.status).toBe(201);
      }
    });

    it('rejects 6th request with 429', async () => {
      const res = await req
        .post('/public/otp/request')
        .set('X-Forwarded-For', '10.0.1.1')
        .send({ identifier, channel: 'EMAIL', purpose: 'GUEST_BOOKING', hCaptchaToken: 'test-valid' });
      expect(res.status).toBe(429);
    });

    it('has exactly 5 OtpCode rows for the identifier', async () => {
      const count = await testPrisma.otpCode.count({ where: { identifier } });
      expect(count).toBe(5);
    });
  });

  // ── 4. OTP brute-force lock: 6 wrong codes → locked out ──────────────────
  describe('4. OTP brute-force lock → correct code rejected after 5 wrong attempts', () => {
    const identifier = uniqueEmail('brute-force');

    beforeAll(async () => {
      await requestOtp(req, identifier);
    });

    it('rejects 5 wrong codes with 401', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await req
          .post('/public/otp/verify')
          .send({ identifier, channel: 'EMAIL', purpose: 'GUEST_BOOKING', code: `00000${i}` });
        expect(res.status).toBe(401);
      }
    });

    it('rejects the 6th attempt (correct code) because attempts exhausted', async () => {
      const code = capturedOtpCodes.get(identifier);
      expect(code).toBeDefined();
      const res = await req
        .post('/public/otp/verify')
        .send({ identifier, channel: 'EMAIL', purpose: 'GUEST_BOOKING', code: code! });
      expect(res.status).toBe(400);
    });
  });

  // ── 5. Missing OTP session → 401 ─────────────────────────────────────────
  describe('5. Missing OTP session → 401 on POST /public/bookings', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await req.post('/public/bookings').send({
        serviceId,
        employeeId,
        branchId,
        startsAt: futureSlot(),
        client: { name: 'Ghost', phone: '+966500000001', email: 'no-session@example.com' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 401 with a malformed token', async () => {
      const res = await req
        .post('/public/bookings')
        .set('Authorization', 'Bearer not-a-jwt')
        .send({
          serviceId,
          employeeId,
          branchId,
          startsAt: futureSlot(),
          client: { name: 'Ghost', phone: '+966500000002', email: 'bad-token@example.com' },
        });
      expect(res.status).toBe(401);
    });
  });

  // ── 6. Replayed OTP session (jti already used) → 401, no second booking ──
  describe('6. Replayed OTP session → 401 and no duplicate Booking row', () => {
    const identifier = uniqueEmail('replay');
    let sessionToken: string;
    let firstBookingId: string;

    beforeAll(async () => {
      await requestOtp(req, identifier);
      sessionToken = await verifyOtp(req, identifier);

      // First booking — should succeed.
      const res = await req
        .post('/public/bookings')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          serviceId,
          employeeId,
          branchId,
          startsAt: futureSlot(),
          client: { name: 'Replay User', phone: '+966501111001', email: identifier },
        });
      firstBookingId = res.body.bookingId as string;
    });

    it('replay with the same token returns 401', async () => {
      const res = await req
        .post('/public/bookings')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          serviceId,
          employeeId,
          branchId,
          startsAt: futureSlot(),
          client: { name: 'Replay User', phone: '+966501111001', email: identifier },
        });
      expect(res.status).toBe(401);
    });

    it('only one Booking row exists for this client after the replay attempt', async () => {
      const clientRow = await testPrisma.client.findFirst({ where: { email: identifier } });
      const count = clientRow
        ? await testPrisma.booking.count({ where: { clientId: clientRow.id } })
        : 0;
      expect(count).toBe(1);
      expect(firstBookingId).toBeDefined();
    });
  });

  // ── 7. Identifier mismatch → 401, no booking, no wrong-client upsert ─────
  describe('7. Identifier mismatch → 401 and no Booking or wrong Client created', () => {
    const aliceEmail = uniqueEmail('alice');
    const bobEmail = uniqueEmail('bob');
    let sessionToken: string;

    beforeAll(async () => {
      await requestOtp(req, aliceEmail);
      sessionToken = await verifyOtp(req, aliceEmail);
    });

    it('returns 401 when booking client.email does not match session identifier', async () => {
      const res = await req
        .post('/public/bookings')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          serviceId,
          employeeId,
          branchId,
          startsAt: futureSlot(),
          client: { name: 'Bob', phone: '+966502222001', email: bobEmail },
        });
      expect(res.status).toBe(401);
    });

    it('no Booking row created for the mismatched request', async () => {
      const clientRow = await testPrisma.client.findFirst({ where: { email: bobEmail } });
      const count = clientRow
        ? await testPrisma.booking.count({ where: { clientId: clientRow.id } })
        : 0;
      expect(count).toBe(0);
    });

    it('no Client row upserted for bob', async () => {
      const client = await testPrisma.client.findFirst({ where: { email: bobEmail } });
      expect(client).toBeNull();
    });
  });

  // ── 8. Wrong branch (employee not assigned) → 400, no booking ────────────
  describe('8. Employee not assigned to branch → 400 and no Booking row', () => {
    const identifier = uniqueEmail('wrong-branch');
    let sessionToken: string;

    beforeAll(async () => {
      await requestOtp(req, identifier);
      sessionToken = await verifyOtp(req, identifier);
    });

    it('returns 400 when employee is not assigned to the requested branch', async () => {
      const res = await req
        .post('/public/bookings')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          serviceId,
          employeeId,
          branchId: otherBranchId,
          startsAt: futureSlot(),
          client: { name: 'Test User', phone: '+966503333001', email: identifier },
        });
      expect(res.status).toBe(400);
    });

    it('no Booking row created for the wrong-branch request', async () => {
      const clientRow = await testPrisma.client.findFirst({ where: { email: identifier } });
      const count = clientRow
        ? await testPrisma.booking.count({ where: { clientId: clientRow.id } })
        : 0;
      expect(count).toBe(0);
    });
  });
});
