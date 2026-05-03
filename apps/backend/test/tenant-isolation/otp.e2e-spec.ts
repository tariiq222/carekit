import request from 'supertest';
import { bootHarness, IsolationHarness } from './isolation-harness';
import { flushTestRedis } from '../setup/db.setup';
import { OtpChannel, OtpPurpose } from '@prisma/client';

describe('OTP cross-org scoping isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    await flushTestRedis();
    h = await bootHarness();
  });

  beforeEach(async () => {
    await flushTestRedis();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('OTP issued under orgA is invisible and unusable from orgB', async () => {
    const orgA = await h.createOrg('otp-iso-a', 'Organization A');
    const orgB = await h.createOrg('otp-iso-b', 'Organization B');
    const identifier = `user-${Date.now()}@example.com`;

    // 1. Issue OTP for orgA
    await request(h.app.getHttpServer())
      .post('/public/otp/request')
      .send({
        channel: OtpChannel.EMAIL,
        identifier,
        purpose: OtpPurpose.GUEST_BOOKING,
        hCaptchaToken: '10000000-aaaa-bbbb-cccc-000000000001',
        organizationId: orgA.id,
      });

    // 2. Try to verify it for orgB -> should fail
    const verifyResp = await request(h.app.getHttpServer())
      .post('/public/otp/verify')
      .send({
        channel: OtpChannel.EMAIL,
        identifier,
        code: '1234', // We don't know the real code, but it should fail with "Invalid or expired" not "Invalid code" if not found
        purpose: OtpPurpose.GUEST_BOOKING,
        organizationId: orgB.id,
      });

    expect(verifyResp.status).toBe(400);
    expect(verifyResp.body.message).toBe('Invalid or expired OTP code');

    // 3. Ensure orgB cannot see orgA's OtpCode rows
    await h.runAs({ organizationId: orgB.id }, async () => {
      const codes = await h.prisma.otpCode.findMany({
        where: { identifier },
      });
      expect(codes).toHaveLength(0);
    });

    // 4. Ensure orgA CAN see its own OtpCode row
    await h.runAs({ organizationId: orgA.id }, async () => {
      const codes = await h.prisma.otpCode.findMany({
        where: { identifier },
      });
      expect(codes).toHaveLength(1);
      expect(codes[0].organizationId).toBe(orgA.id);
    });
  });

  it('NULL-org OTP is visible to system-context probe but not to scoped orgs', async () => {
    const orgA = await h.createOrg('otp-iso-null-a', 'Organization A');
    const identifier = `null-user-${Date.now()}@example.com`;

    // 1. Issue platform-wide OTP (null org)
    await request(h.app.getHttpServer())
      .post('/public/otp/request')
      .send({
        channel: OtpChannel.EMAIL,
        identifier,
        purpose: OtpPurpose.GUEST_BOOKING,
        hCaptchaToken: '10000000-aaaa-bbbb-cccc-000000000001',
        // organizationId omitted -> null
      });

    // 2. Org A cannot see it
    await h.runAs({ organizationId: orgA.id }, async () => {
      const codes = await h.prisma.otpCode.findMany({
        where: { identifier },
      });
      expect(codes).toHaveLength(0);
    });

    // 3. System context can see it
    await h.runAs({ isSuperAdmin: true }, async () => {
      const codes = await h.prisma.otpCode.findMany({
        where: { identifier },
      });
      expect(codes.length).toBeGreaterThanOrEqual(1);
      const myCode = codes.find(c => c.identifier === identifier);
      expect(myCode).toBeDefined();
      expect(myCode!.organizationId).toBeNull();
    });
  });
});
