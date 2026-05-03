import SuperTest from 'supertest';
import * as bcrypt from 'bcryptjs';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';

describe('OTP expiry race conditions and replay protection', () => {
  let req: SuperTest.Agent;

  beforeAll(async () => {
    ({ request: req } = await createTestApp({ globalPrefix: true }));
    await cleanTables(['OtpCode', 'User']);
  });

  afterAll(async () => {
    await cleanTables(['OtpCode', 'User']);
    await closeTestApp();
  });

  async function seedUser(phone: string, ts: number): Promise<void> {
    await (testPrisma as any).user.create({
      data: {
        id: `otp-race-user-${ts}`,
        email: `otp-race-${ts}@test.com`,
        name: 'OTP Race User',
        passwordHash: await bcrypt.hash('Pass@1234', 10),
        role: 'CLIENT',
        isActive: true,
        phone,
        phoneVerifiedAt: new Date(),
      },
    });
  }

  async function seedOtp(phone: string, expiresAt: Date, code = '1234'): Promise<void> {
    const codeHash = await bcrypt.hash(code, 10);
    await (testPrisma as any).otpCode.create({
      data: {
        identifier: phone,
        channel: OtpChannel.SMS,
        purpose: OtpPurpose.MOBILE_LOGIN,
        codeHash,
        expiresAt,
        organizationId: '00000000-0000-0000-0000-000000000001',
      },
    });
  }

  it('expired OTP returns 400', async () => {
    const ts = Date.now();
    const phone = `+96650${ts.toString().slice(-7)}`;
    await seedUser(phone, ts);
    await seedOtp(phone, new Date(Date.now() - 1));

    await req
      .post('/api/v1/mobile/auth/verify-otp')
      .send({ identifier: phone, code: '1234', purpose: 'login' })
      .expect(400);
  });

  it('valid OTP returns 200 with tokens', async () => {
    const ts = Date.now() + 1;
    const phone = `+96650${(ts + 1).toString().slice(-7)}`;
    await seedUser(phone, ts);
    await seedOtp(phone, new Date(Date.now() + 60_000));

    const res = await req
      .post('/api/v1/mobile/auth/verify-otp')
      .send({ identifier: phone, code: '1234', purpose: 'login' })
      .expect(200);

    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();
  });

  it('consumed OTP replay returns 400', async () => {
    const ts = Date.now() + 2;
    const phone = `+96650${(ts + 2).toString().slice(-7)}`;
    await seedUser(phone, ts);
    await seedOtp(phone, new Date(Date.now() + 60_000));

    await req
      .post('/api/v1/mobile/auth/verify-otp')
      .send({ identifier: phone, code: '1234', purpose: 'login' })
      .expect(200);

    await req
      .post('/api/v1/mobile/auth/verify-otp')
      .send({ identifier: phone, code: '1234', purpose: 'login' })
      .expect(400);
  });

  it('wrong code returns 400 or 401', async () => {
    const ts = Date.now() + 3;
    const phone = `+96650${(ts + 3).toString().slice(-7)}`;
    await seedUser(phone, ts);
    await seedOtp(phone, new Date(Date.now() + 60_000));

    const res = await req
      .post('/api/v1/mobile/auth/verify-otp')
      .send({ identifier: phone, code: '9999', purpose: 'login' });

    expect([400, 401]).toContain(res.status);
  });
});
