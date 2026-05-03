import SuperTest from 'supertest';
import * as bcrypt from 'bcryptjs';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables, flushTestRedis } from '../../setup/db.setup';

/**
 * Phase 2 / Bug B9 — Phone numbers must normalize to E.164 at DTO ingress.
 *
 * Before this fix, `+966...`, `00966...`, `966...`, and the local
 * `05...` form would each create a separate User row with the same physical
 * number stored under three distinct identities — collisions on lookup,
 * impossible to deduplicate. After the fix, every phone-bearing DTO runs
 * `normalizePhone()` via the `@NormalizePhone()` / `@NormalizePhoneOrEmail()`
 * class-transformer decorators and the handler always sees `+966XXXXXXXXX`.
 */
describe('Phone E.164 normalization E2E', () => {
  let req: SuperTest.Agent;
  const canonicalPhone = '+966512345678';
  const localFormat = '0512345678';
  const trunkFormat = '00966512345678';
  const bareFormat = '966512345678';
  const email = `phone-norm-e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    await flushTestRedis();
    ({ request: req } = await createTestApp({ globalPrefix: true }));
    await cleanTables(['OtpCode', 'RefreshToken', 'EmailVerificationToken', 'User']);
  });

  afterAll(async () => {
    await cleanTables(['OtpCode', 'RefreshToken', 'EmailVerificationToken', 'User']);
    await closeTestApp();
  });

  it('register with 00966 stores E.164 — lookup with +966 / 0XXX / 966XXX finds same user', async () => {
    // Step 1 — register using the trunk-prefix form (`00966...`).
    const reg = await req
      .post('/api/v1/mobile/auth/register')
      .send({ firstName: 'Phone', lastName: 'Test', phone: trunkFormat, email })
      .expect(200);
    expect(reg.body.userId).toBeDefined();

    // The User row must store the canonical E.164 form, not the raw input.
    const user = await (testPrisma as any).user.findFirst({
      where: { email },
      select: { id: true, phone: true },
    });
    expect(user).not.toBeNull();
    expect(user.phone).toBe(canonicalPhone);

    // Activate so login lookups succeed.
    await (testPrisma as any).user.update({
      where: { id: user.id },
      data: { phoneVerifiedAt: new Date(), isActive: true },
    });

    // Step 2 — request login OTP with the canonical `+966...` form.
    // It must locate the same user row that was registered with `00966...`.
    await req
      .post('/api/v1/mobile/auth/request-login-otp')
      .send({ identifier: canonicalPhone })
      .expect(200);

    const otpAfterPlus = await (testPrisma as any).otpCode.findFirst({
      where: { identifier: canonicalPhone, purpose: OtpPurpose.MOBILE_LOGIN, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(otpAfterPlus).not.toBeNull();

    // Step 3 — request again with the bare-`966...` form. Same identifier.
    await req
      .post('/api/v1/mobile/auth/request-login-otp')
      .send({ identifier: bareFormat })
      .expect(200);

    // Step 4 — request again with the local `0XXXXXXXXX` form. Same identifier.
    await req
      .post('/api/v1/mobile/auth/request-login-otp')
      .send({ identifier: localFormat })
      .expect(200);

    // All OTPs must be stored under the canonical `+966...` identifier.
    // (The request-otp handler supersedes prior unconsumed codes for the
    // same identifier, so we rely on the latest row pointing at +966...)
    const allRows = await (testPrisma as any).otpCode.findMany({
      where: { purpose: OtpPurpose.MOBILE_LOGIN },
      select: { identifier: true },
    });
    expect(allRows.length).toBeGreaterThan(0);
    for (const row of allRows) {
      expect(row.identifier).toBe(canonicalPhone);
    }

    // Step 5 — verify-otp with the local form must also find the active code.
    const knownCode = '432100';
    await (testPrisma as any).otpCode.updateMany({
      where: { identifier: canonicalPhone, purpose: OtpPurpose.MOBILE_LOGIN, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await (testPrisma as any).otpCode.create({
      data: {
        identifier: canonicalPhone,
        channel: OtpChannel.SMS,
        purpose: OtpPurpose.MOBILE_LOGIN,
        codeHash: await bcrypt.hash(knownCode, 10),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        organizationId: '00000000-0000-0000-0000-000000000001',
      },
    });

    const verifyLogin = await req
      .post('/api/v1/mobile/auth/verify-otp')
      .send({ identifier: localFormat, code: knownCode, purpose: 'login' })
      .expect(200);
    expect(verifyLogin.body.tokens.accessToken).toBeDefined();
  });

  it('rejects clearly invalid phone with 400 BadRequest', async () => {
    await req
      .post('/api/v1/mobile/auth/register')
      .send({
        firstName: 'Bad',
        lastName: 'Phone',
        phone: 'not-a-phone',
        email: `bad-${Date.now()}@example.com`,
      })
      .expect(400);
  });
});
