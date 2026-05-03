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

    // 1. Seed OTP for orgA directly via raw SQL — the email transport in the
    //    bootHarness integration test environment is not wired (no real SMTP),
    //    so going via HTTP would return 503. The tenant-isolation contract we're
    //    testing is DB-level RLS scoping, not the send path.
    await h.prisma.$executeRawUnsafe(
      `INSERT INTO "OtpCode" (id, identifier, channel, purpose, "codeHash", "expiresAt", "organizationId", attempts, "maxAttempts", "createdAt")
       VALUES (gen_random_uuid(), $1, 'EMAIL'::"OtpChannel", 'GUEST_BOOKING'::"OtpPurpose", '$2b$10$placeholder', NOW() + INTERVAL '10 minutes', $2, 0, 5, NOW())`,
      identifier,
      orgA.id,
    );

    // 2. Try to verify it for orgB -> should fail
    //    Code must be 6 digits (VerifyOtpDto @Length(6,6)); an unknown code still
    //    produces "Invalid or expired OTP code" when the OTP is NOT found for orgB.
    const verifyResp = await request(h.app.getHttpServer())
      .post('/public/otp/verify')
      .set('X-Org-Id', orgB.id)
      .send({
        channel: OtpChannel.EMAIL,
        identifier,
        code: '123456', // Unknown code, but must be 6 digits to pass DTO validation
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

    // 1. Seed platform-wide OTP (organizationId = null) directly via raw SQL.
    //    The strict-mode middleware cannot issue null-org OTPs via HTTP (requires
    //    an X-Org-Id header); we bypass the HTTP layer and write the row directly
    //    to prove that RLS scoping correctly hides it from scoped-org queries.
    await h.prisma.$executeRawUnsafe(
      `INSERT INTO "OtpCode" (id, identifier, channel, purpose, "codeHash", "expiresAt", "organizationId", attempts, "maxAttempts", "createdAt")
       VALUES (gen_random_uuid(), $1, 'EMAIL'::"OtpChannel", 'GUEST_BOOKING'::"OtpPurpose", '$2b$10$placeholder', NOW() + INTERVAL '10 minutes', NULL, 0, 5, NOW())`,
      identifier,
    );

    // 2. Org A cannot see it
    await h.runAs({ organizationId: orgA.id }, async () => {
      const codes = await h.prisma.otpCode.findMany({
        where: { identifier },
      });
      expect(codes).toHaveLength(0);
    });

    // 3. System context (raw SQL bypass) can see the null-org OTP.
    //    $allTenants requires SUPER_ADMIN_CONTEXT_CLS_KEY which runAs doesn't set;
    //    use $queryRaw to probe the unfiltered table directly.
    const rawRows = await h.prisma.$queryRaw<Array<{ identifier: string; organizationId: string | null }>>`
      SELECT identifier, "organizationId"
      FROM "OtpCode"
      WHERE identifier = ${identifier}
    `;
    expect(rawRows.length).toBeGreaterThanOrEqual(1);
    const myCode = rawRows.find(c => c.identifier === identifier);
    expect(myCode).toBeDefined();
    expect(myCode!.organizationId).toBeNull();
  });
});
