import SuperTest from 'supertest';
import * as bcrypt from 'bcryptjs';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables, flushTestRedis } from '../../setup/db.setup';

describe('Dashboard OTP login — request + verify endpoints', () => {
  let req: SuperTest.Agent;

  beforeAll(async () => {
    await flushTestRedis();
    ({ request: req } = await createTestApp({ globalPrefix: true }));
    await cleanTables(['OtpCode', 'RefreshToken', 'User']);
  });

  afterAll(async () => {
    await cleanTables(['OtpCode', 'RefreshToken', 'User']);
    await closeTestApp();
  });

  async function seedUser(email: string): Promise<string> {
    const user = await (testPrisma as any).user.create({
      data: {
        email,
        name: 'OTP Test User',
        passwordHash: await bcrypt.hash('Pass@1234', 10),
        role: 'ADMIN',
        isActive: true,
      },
    });
    return user.id;
  }

  async function seedOtp(
    identifier: string,
    code: string,
    opts: {
      expiresAt?: Date;
      consumed?: boolean;
      attempts?: number;
      lockedUntil?: Date;
    } = {},
  ): Promise<void> {
    const codeHash = await bcrypt.hash(code, 10);
    await (testPrisma as any).otpCode.create({
      data: {
        // Permissive-mode middleware resolves DEFAULT_ORGANIZATION_ID for
        // non-public non-JWT routes — the scoping extension injects this org id
        // into every findFirst query. Seed with the same value so the handler
        // can find the record.
        organizationId: '00000000-0000-0000-0000-000000000001',
        identifier,
        channel: OtpChannel.EMAIL,
        purpose: OtpPurpose.DASHBOARD_LOGIN,
        codeHash,
        expiresAt: opts.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000),
        consumedAt: opts.consumed ? new Date() : null,
        attempts: opts.attempts ?? 0,
        lockedUntil: opts.lockedUntil ?? null,
      },
    });
  }

  // ── request-dashboard ─────────────────────────────────────────────────────

  it('request-dashboard endpoint — unknown identifier returns {success:true} (enumeration safety)', async () => {
    const res = await req
      .post('/api/v1/auth/otp/request-dashboard')
      .send({ identifier: 'ghost@nowhere.com' })
      .expect(200);

    expect(res.body).toMatchObject({ success: true });
  });

  // ── verify-dashboard ──────────────────────────────────────────────────────

  it('verify-dashboard — happy path: valid OTP → 200 + tokens', async () => {
    const email = 'dashboard-otp-happy@test.com';
    await seedUser(email);
    await seedOtp(email, '654321');

    const res = await req
      .post('/api/v1/auth/otp/verify-dashboard')
      .send({ identifier: email, code: '654321' })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toEqual(email);
  });

  it('verify-dashboard — expired OTP → 400', async () => {
    const email = 'dashboard-otp-exp@test.com';
    await seedUser(email);
    await seedOtp(email, '654321', { expiresAt: new Date(Date.now() - 1) });

    await req
      .post('/api/v1/auth/otp/verify-dashboard')
      .send({ identifier: email, code: '654321' })
      .expect(400);
  });

  it('verify-dashboard — wrong code → 401', async () => {
    const email = 'dashboard-otp-wrong@test.com';
    await seedUser(email);
    await seedOtp(email, '111111');

    await req
      .post('/api/v1/auth/otp/verify-dashboard')
      .send({ identifier: email, code: '999999' })
      .expect(401);
  });

  it('verify-dashboard — consumed (replay) → 400', async () => {
    const email = 'dashboard-otp-replay@test.com';
    await seedUser(email);
    await seedOtp(email, '654321', { consumed: true });

    await req
      .post('/api/v1/auth/otp/verify-dashboard')
      .send({ identifier: email, code: '654321' })
      .expect(400);
  });

  it('verify-dashboard — locked OTP → 400 with OTP_LOCKED_OUT', async () => {
    const email = 'dashboard-otp-lock@test.com';
    await seedUser(email);
    await seedOtp(email, '654321', {
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
    });

    const res = await req
      .post('/api/v1/auth/otp/verify-dashboard')
      .send({ identifier: email, code: '654321' })
      .expect(400);

    expect(res.body.message).toEqual('OTP_LOCKED_OUT');
  });
});
