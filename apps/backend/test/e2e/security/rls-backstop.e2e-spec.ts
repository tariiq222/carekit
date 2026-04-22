/**
 * SaaS-02h — RLS backstop.
 *
 * The Prisma Proxy is the primary defense; Postgres RLS is the backstop.
 * Because the app connects as the DB owner (superuser in dev), RLS policies
 * don't bite the app — tests must connect as the non-superuser probe role
 * created in migration 20260422180000.
 *
 * This suite proves:
 *   1. With `app.current_organization_id` set to Org A, the probe role sees
 *      only Org A rows from tenant-scoped tables.
 *   2. With the GUC unset, the probe role sees ZERO rows (fail-closed).
 *   3. Same rules apply to tables whose policy was added in 02h (bookings
 *      cluster — 02d gap closed in this plan).
 */
import { Client } from 'pg';
import { bootSecurityHarness, SecurityHarness } from './harness';

describe('SaaS-02h — Postgres RLS backstop under carekit_rls_probe role', () => {
  let h: SecurityHarness;

  beforeAll(async () => {
    h = await bootSecurityHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  const probe = async (): Promise<Client> => {
    const client = new Client({ connectionString: h.rlsProbeUrl() });
    await client.connect();
    return client;
  };

  it('probe role sees only Org A bookings when GUC is set to Org A', async () => {
    const { orgA, orgB } = await h.seedTwoOrgs('rls-bookings');

    await h.withCls(orgA.id, () =>
      h.prisma.booking.create({
        data: {
          organizationId: orgA.id,
          branchId: 'branch-a',
          clientId: 'client-a',
          employeeId: 'emp-a',
          serviceId: 'svc-a',
          scheduledAt: new Date('2030-07-01T10:00:00Z'),
          endsAt: new Date('2030-07-01T11:00:00Z'),
          durationMins: 60,
          price: 100,
          currency: 'SAR',
        },
      }),
    );
    await h.withCls(orgB.id, () =>
      h.prisma.booking.create({
        data: {
          organizationId: orgB.id,
          branchId: 'branch-b',
          clientId: 'client-b',
          employeeId: 'emp-b',
          serviceId: 'svc-b',
          scheduledAt: new Date('2030-07-01T10:00:00Z'),
          endsAt: new Date('2030-07-01T11:00:00Z'),
          durationMins: 60,
          price: 100,
          currency: 'SAR',
        },
      }),
    );

    const client = await probe();
    try {
      await client.query(`SET app.current_organization_id = '${orgA.id}'`);
      const { rows } = await client.query<{ organizationId: string }>(
        `SELECT "organizationId" FROM "Booking" WHERE "organizationId" IN ($1, $2)`,
        [orgA.id, orgB.id],
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.organizationId === orgA.id)).toBe(true);
    } finally {
      await client.end();
    }
  });

  it('probe role sees only Org A invoices under GUC', async () => {
    const { orgA, orgB } = await h.seedTwoOrgs('rls-invoice');

    const bkA = await h.withCls(orgA.id, () =>
      h.prisma.booking.create({
        data: {
          organizationId: orgA.id,
          branchId: 'branch-a',
          clientId: 'client-a',
          employeeId: 'emp-a',
          serviceId: 'svc-a',
          scheduledAt: new Date('2030-07-02T10:00:00Z'),
          endsAt: new Date('2030-07-02T11:00:00Z'),
          durationMins: 60,
          price: 100,
          currency: 'SAR',
        },
        select: { id: true },
      }),
    );
    const bkB = await h.withCls(orgB.id, () =>
      h.prisma.booking.create({
        data: {
          organizationId: orgB.id,
          branchId: 'branch-b',
          clientId: 'client-b',
          employeeId: 'emp-b',
          serviceId: 'svc-b',
          scheduledAt: new Date('2030-07-02T10:00:00Z'),
          endsAt: new Date('2030-07-02T11:00:00Z'),
          durationMins: 60,
          price: 100,
          currency: 'SAR',
        },
        select: { id: true },
      }),
    );

    await h.withCls(orgA.id, () =>
      h.prisma.invoice.create({
        data: {
          organizationId: orgA.id,
          branchId: 'branch-a',
          clientId: 'client-a',
          employeeId: 'emp-a',
          bookingId: bkA.id,
          subtotal: 500,
          vatAmt: 75,
          total: 575,
        },
      }),
    );
    await h.withCls(orgB.id, () =>
      h.prisma.invoice.create({
        data: {
          organizationId: orgB.id,
          branchId: 'branch-b',
          clientId: 'client-b',
          employeeId: 'emp-b',
          bookingId: bkB.id,
          subtotal: 500,
          vatAmt: 75,
          total: 575,
        },
      }),
    );

    const client = await probe();
    try {
      await client.query(`SET app.current_organization_id = '${orgA.id}'`);
      const { rows } = await client.query<{ organizationId: string }>(
        `SELECT "organizationId" FROM "Invoice" WHERE "organizationId" IN ($1, $2)`,
        [orgA.id, orgB.id],
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.organizationId === orgA.id)).toBe(true);
    } finally {
      await client.end();
    }
  });

  it('probe role sees ZERO rows when GUC is unset (fail-closed)', async () => {
    const { orgA } = await h.seedTwoOrgs('rls-fail-closed');
    await h.withCls(orgA.id, () =>
      h.prisma.notification.create({
        data: {
          organizationId: orgA.id,
          recipientId: 'recipient',
          recipientType: 'EMPLOYEE',
          type: 'GENERAL',
          title: 'hello',
          body: 'world',
        },
      }),
    );

    const client = await probe();
    try {
      // GUC not set — policy predicate `organizationId = NULL` matches nothing.
      const { rows } = await client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM "Notification"`,
      );
      expect(rows[0].c).toBe('0');
    } finally {
      await client.end();
    }
  });
});
