/**
 * E2E (Bug B5 / 2026-05-03): the three tenant models that were previously
 * missing from `SCOPED_MODELS` must now be auto-scoped by the Prisma
 * extension. A `findFirst()` / `findMany()` issued from inside Org B's CLS
 * context must NEVER return Org A's rows.
 *
 * Models covered:
 *   1. OrganizationEmailConfig — singleton per-org SMTP credentials. The
 *      most critical — leaking these would expose another tenant's email
 *      provider keys.
 *   2. NotificationDeliveryLog — per-tenant delivery audit data.
 *   3. OrganizationInvoiceCounter — per-tenant invoice number sequence;
 *      cross-tenant reads risk colliding invoice numbers.
 */
import { bootSecurityHarness, SecurityHarness } from './harness';
import { ClsService } from 'nestjs-cls';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('Bug B5 — scoped-models leak (3 newly added models)', () => {
  let h: SecurityHarness;
  let cls: ClsService;

  beforeAll(async () => {
    h = await bootSecurityHarness();
    cls = h.app.get(ClsService);
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  const withSuperAdmin = <T>(fn: () => Promise<T>): Promise<T> =>
    cls.run(async () => {
      cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      return fn();
    });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. OrganizationEmailConfig
  // ─────────────────────────────────────────────────────────────────────────

  it('OrganizationEmailConfig: findFirst from Org B never returns Org A row', async () => {
    const { orgA, orgB } = await h.seedTwoOrgs('email-config');

    await withSuperAdmin(async () => {
      await h.prisma.$allTenants.organizationEmailConfig.create({
        data: {
          organizationId: orgA.id,
          provider: 'SMTP',
          senderName: 'Org A',
          senderEmail: 'noreply@orga.test',
          credentialsCiphertext: 'A-secret-ciphertext',
        },
      });
      await h.prisma.$allTenants.organizationEmailConfig.create({
        data: {
          organizationId: orgB.id,
          provider: 'SMTP',
          senderName: 'Org B',
          senderEmail: 'noreply@orgb.test',
          credentialsCiphertext: 'B-secret-ciphertext',
        },
      });
    });

    // From Org B's CLS, an UNQUALIFIED findFirst on the singleton model must
    // resolve to Org B's row, not Org A's. Pre-fix the extension would have
    // skipped this model and returned the first row in the table (which the
    // `senderName: 'Org A'` filter below pins to Org A).
    const leak = await h.withCls(orgB.id, () =>
      h.prisma.organizationEmailConfig.findFirst({
        where: { senderName: 'Org A' },
      }),
    );
    expect(leak).toBeNull();

    // Sanity check: from Org B, the qualified-by-senderName lookup for Org B
    // still works.
    const ownRow = await h.withCls(orgB.id, () =>
      h.prisma.organizationEmailConfig.findFirst({
        where: { senderName: 'Org B' },
      }),
    );
    expect(ownRow?.organizationId).toBe(orgB.id);
    expect(ownRow?.credentialsCiphertext).toBe('B-secret-ciphertext');
  });

  it('OrganizationEmailConfig: findMany from Org B returns only Org B rows', async () => {
    const { orgA, orgB } = await h.seedTwoOrgs('email-config-findmany');

    await withSuperAdmin(async () => {
      await h.prisma.$allTenants.organizationEmailConfig.create({
        data: {
          organizationId: orgA.id,
          provider: 'RESEND',
          credentialsCiphertext: 'A',
        },
      });
      await h.prisma.$allTenants.organizationEmailConfig.create({
        data: {
          organizationId: orgB.id,
          provider: 'RESEND',
          credentialsCiphertext: 'B',
        },
      });
    });

    const rows = await h.withCls(orgB.id, () =>
      h.prisma.organizationEmailConfig.findMany({
        select: { organizationId: true, credentialsCiphertext: true },
      }),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.organizationId === orgB.id)).toBe(true);
    expect(rows.some((r) => r.credentialsCiphertext === 'A')).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. NotificationDeliveryLog
  // ─────────────────────────────────────────────────────────────────────────

  it('NotificationDeliveryLog: findMany from Org B never returns Org A rows', async () => {
    const { orgA, orgB } = await h.seedTwoOrgs('notif-log');

    await withSuperAdmin(async () => {
      await h.prisma.$allTenants.notificationDeliveryLog.create({
        data: {
          organizationId: orgA.id,
          recipientId: 'recipient-a',
          type: 'BOOKING_CONFIRMED',
          channel: 'EMAIL',
          status: 'SENT',
          attempts: 1,
        },
      });
      await h.prisma.$allTenants.notificationDeliveryLog.create({
        data: {
          organizationId: orgB.id,
          recipientId: 'recipient-b',
          type: 'BOOKING_CONFIRMED',
          channel: 'EMAIL',
          status: 'SENT',
          attempts: 1,
        },
      });
    });

    const rows = await h.withCls(orgB.id, () =>
      h.prisma.notificationDeliveryLog.findMany({
        select: { organizationId: true, recipientId: true },
      }),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.organizationId === orgB.id)).toBe(true);
    expect(rows.some((r) => r.recipientId === 'recipient-a')).toBe(false);
  });

  it('NotificationDeliveryLog: direct-id probe from Org B → null for Org A row', async () => {
    const { orgA, orgB } = await h.seedTwoOrgs('notif-log-direct');

    const aId = await withSuperAdmin(async () => {
      const row = await h.prisma.$allTenants.notificationDeliveryLog.create({
        data: {
          organizationId: orgA.id,
          recipientId: 'r-a-direct',
          type: 'BOOKING_CONFIRMED',
          channel: 'SMS',
          status: 'PENDING',
          attempts: 0,
        },
        select: { id: true },
      });
      return row.id;
    });

    const leak = await h.withCls(orgB.id, () =>
      h.prisma.notificationDeliveryLog.findFirst({ where: { id: aId } }),
    );
    expect(leak).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. OrganizationInvoiceCounter
  // ─────────────────────────────────────────────────────────────────────────

  it('OrganizationInvoiceCounter: findFirst from Org B never returns Org A counter', async () => {
    const { orgA, orgB } = await h.seedTwoOrgs('inv-counter');
    const year = 2099; // far-future to avoid colliding with any seed data

    await withSuperAdmin(async () => {
      await h.prisma.$allTenants.organizationInvoiceCounter.create({
        data: { organizationId: orgA.id, year, lastSequence: 42 },
      });
      await h.prisma.$allTenants.organizationInvoiceCounter.create({
        data: { organizationId: orgB.id, year, lastSequence: 7 },
      });
    });

    // From Org B, a `findFirst({ where: { year } })` (no orgId predicate)
    // must NOT bleed Org A's counter. Post-fix the extension injects
    // `organizationId = orgB.id`.
    const row = await h.withCls(orgB.id, () =>
      h.prisma.organizationInvoiceCounter.findFirst({ where: { year } }),
    );
    expect(row?.organizationId).toBe(orgB.id);
    expect(row?.lastSequence).toBe(7);
  });

  it('OrganizationInvoiceCounter: findMany from Org B returns only Org B rows', async () => {
    const { orgA, orgB } = await h.seedTwoOrgs('inv-counter-findmany');
    const year = 2098;

    await withSuperAdmin(async () => {
      await h.prisma.$allTenants.organizationInvoiceCounter.create({
        data: { organizationId: orgA.id, year, lastSequence: 100 },
      });
      await h.prisma.$allTenants.organizationInvoiceCounter.create({
        data: { organizationId: orgB.id, year, lastSequence: 1 },
      });
    });

    const rows = await h.withCls(orgB.id, () =>
      h.prisma.organizationInvoiceCounter.findMany({
        where: { year },
        select: { organizationId: true, lastSequence: true },
      }),
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.organizationId === orgB.id)).toBe(true);
    expect(rows.some((r) => r.lastSequence === 100)).toBe(false);
  });
});
