import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

import { MoyasarCredentialsService } from '../../src/infrastructure/payments/moyasar-credentials.service';
import { bootHarness, IsolationHarness } from './isolation-harness';

describe('Phase A — OrganizationPaymentConfig isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  // Verifies basic create-and-store isolation. Because organizationId is the
  // singleton uniqueness key (one row per org) and is used directly as the
  // PK lookup column by the production handlers, the extension-layer scoping
  // does not bite on findUnique({ where: { organizationId } }) — the RLS
  // backstop in test 3 is what actually enforces cross-tenant invisibility
  // for this model.
  it('two orgs each get their own row', async () => {
    const a = await h.createOrg(`pc-create-a-${Date.now()}`, 'منظمة دفع إنشاء أ');
    const b = await h.createOrg(`pc-create-b-${Date.now()}`, 'منظمة دفع إنشاء ب');

    const enc = h.app.get(MoyasarCredentialsService);

    const rowA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.organizationPaymentConfig.create({
        data: {
          organizationId: a.id,
          publishableKey: 'pk_test_aaaa',
          secretKeyEnc: enc.encrypt({ secretKey: 'sk_test_aaaa' }, a.id),
          isLive: false,
        },
        select: { id: true, organizationId: true },
      }),
    );

    const rowB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.organizationPaymentConfig.create({
        data: {
          organizationId: b.id,
          publishableKey: 'pk_test_bbbb',
          secretKeyEnc: enc.encrypt({ secretKey: 'sk_test_bbbb' }, b.id),
          isLive: false,
        },
        select: { id: true, organizationId: true },
      }),
    );

    expect(rowA.id).not.toBe(rowB.id);
    expect(rowA.organizationId).toBe(a.id);
    expect(rowB.organizationId).toBe(b.id);
  });

  it('AES-GCM AAD mismatch raises on cross-tenant decrypt', () => {
    const key = randomBytes(32).toString('base64');
    const cfg = {
      get: (name: string) => (name === 'MOYASAR_TENANT_ENCRYPTION_KEY' ? key : undefined),
    } as ConfigService;
    const svc = new MoyasarCredentialsService(cfg);

    const ciphertext = svc.encrypt({ secretKey: 'sk_test_secret' }, 'org-a');

    expect(() => svc.decrypt(ciphertext, 'org-b')).toThrow();
  });

  it('RLS hides OrganizationPaymentConfig at SQL level when GUC differs', async () => {
    const a = await h.createOrg(`pc-rls-a-${Date.now()}`, 'منظمة RLS دفع أ');
    const b = await h.createOrg(`pc-rls-b-${Date.now()}`, 'منظمة RLS دفع ب');

    const enc = h.app.get(MoyasarCredentialsService);
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.organizationPaymentConfig.create({
        data: {
          organizationId: a.id,
          publishableKey: 'pk_test_rls',
          secretKeyEnc: enc.encrypt({ secretKey: 'sk_test_rls' }, a.id),
          isLive: false,
        },
      }),
    );

    const tmpRole = `rls_probe_pc_${Date.now()}`;
    try {
      await h.prisma.$executeRawUnsafe(`CREATE ROLE ${tmpRole}`);
      await h.prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${tmpRole}`);
      await h.prisma.$executeRawUnsafe(
        `GRANT SELECT ON public."OrganizationPaymentConfig" TO ${tmpRole}`,
      );

      const rows = await h.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${b.id}'`);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${tmpRole}`);
        return tx.$queryRaw<Array<{ cnt: bigint }>>`
          SELECT COUNT(*)::bigint AS cnt
          FROM public."OrganizationPaymentConfig"
          WHERE "organizationId" = ${a.id}
        `;
      });

      expect(Number(rows[0].cnt)).toBe(0);
    } finally {
      await h.prisma
        .$executeRawUnsafe(`REVOKE ALL ON public."OrganizationPaymentConfig" FROM ${tmpRole}`)
        .catch(() => {});
      await h.prisma
        .$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM ${tmpRole}`)
        .catch(() => {});
      await h.prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${tmpRole}`).catch(() => {});
    }
  });
});
