import SuperTest from 'supertest';
import * as bcrypt from 'bcryptjs';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables, flushTestRedis } from '../../setup/db.setup';

describe('Mobile auth E2E', () => {
  let req: SuperTest.Agent;
  const phone = '+966599998888';
  const email = `mobile-e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    await flushTestRedis();
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

    const knownCode = '123456';
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
  // Regression: prior to fix/route-double-prefix, the mobile auth controller
  // declared @Controller('api/v1/mobile/auth') on top of the global 'api/v1'
  // prefix, exposing routes only at /api/v1/api/v1/mobile/auth/*. The mobile
  // client also double-prefixed its baseURL — two wrongs cancelling. Lock the
  // canonical path in and fail loudly if the doubled path ever resurfaces.
  it('serves mobile auth at /api/v1/mobile/auth (not /api/v1/api/v1/...)', async () => {
    await req
      .post('/api/v1/mobile/auth/request-login-otp')
      .send({ identifier: '+966500000001' })
      .expect(200);

    await req
      .post('/api/v1/api/v1/mobile/auth/request-login-otp')
      .send({ identifier: '+966500000001' })
      .expect(404);
  });

  it('serves /api/v1/public/verify-email (not /api/v1/api/v1/public/verify-email)', async () => {
    // Token is invalid — we only care that the route is reachable (not 404).
    const ok = await req.get('/api/v1/public/verify-email?token=does-not-exist');
    expect(ok.status).not.toBe(404);

    await req
      .get('/api/v1/api/v1/public/verify-email?token=does-not-exist')
      .expect(404);
  });
});
