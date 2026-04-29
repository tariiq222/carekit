import SuperTest from 'supertest';
import * as bcrypt from 'bcryptjs';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';

describe('Mobile auth E2E', () => {
  let req: SuperTest.Agent;
  const phone = '+966599998888';
  const email = `mobile-e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    ({ request: req } = await createTestApp({ globalPrefix: true }));
    await cleanTables(['OtpCode', 'RefreshToken', 'EmailVerificationToken', 'User']);
  });

  afterAll(async () => {
    await cleanTables(['OtpCode', 'RefreshToken', 'EmailVerificationToken', 'User']);
    await closeTestApp();
  });

  it('register → SMS OTP → activate → login → tokens', async () => {
    const reg = await req
      .post('/api/v1/mobile/auth/register')
      .send({ firstName: 'E2E', lastName: 'User', phone, email })
      .expect(200);
    expect(reg.body.userId).toBeDefined();
    expect(reg.body.maskedPhone).toBeDefined();

    const knownCode = '1234';
    const codeHash = await bcrypt.hash(knownCode, 10);
    await (testPrisma as any).otpCode.create({
      data: {
        identifier: phone,
        channel: OtpChannel.SMS,
        purpose: OtpPurpose.MOBILE_REGISTER,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        organizationId: '00000000-0000-0000-0000-000000000001',
      },
    });

    const verify = await req
      .post('/api/v1/mobile/auth/verify-otp')
      .send({ identifier: phone, code: knownCode, purpose: 'register' })
      .expect(200);
    expect(verify.body.tokens.accessToken).toBeDefined();
    expect(verify.body.tokens.refreshToken).toBeDefined();
    expect(verify.body.activeMembership).toBeNull();

    const loginReq = await req
      .post('/api/v1/mobile/auth/request-login-otp')
      .send({ identifier: phone })
      .expect(200);
    expect(loginReq.body.maskedIdentifier).toBeDefined();

    const codeHashLogin = await bcrypt.hash(knownCode, 10);
    await (testPrisma as any).otpCode.create({
      data: {
        identifier: phone,
        channel: OtpChannel.SMS,
        purpose: OtpPurpose.MOBILE_LOGIN,
        codeHash: codeHashLogin,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        organizationId: '00000000-0000-0000-0000-000000000001',
      },
    });

    const verifyLogin = await req
      .post('/api/v1/mobile/auth/verify-otp')
      .send({ identifier: phone, code: knownCode, purpose: 'login' })
      .expect(200);
    expect(verifyLogin.body.tokens.accessToken).toBeDefined();
    expect(verifyLogin.body.tokens.refreshToken).toBeDefined();
  });

  it('login by unverified email is silent (no OTP issued)', async () => {
    const res = await req
      .post('/api/v1/mobile/auth/request-login-otp')
      .send({ identifier: email })
      .expect(200);
    expect(res.body.maskedIdentifier).toBeDefined();

    const count = await (testPrisma as any).otpCode.count({
      where: { identifier: email, purpose: OtpPurpose.MOBILE_LOGIN, consumedAt: null },
    });
    expect(count).toBe(0);
  });
});
