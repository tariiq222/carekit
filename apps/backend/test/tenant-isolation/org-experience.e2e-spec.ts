import { bootHarness, IsolationHarness } from './isolation-harness';

describe('SaaS-02c — org-experience cluster isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Service — scoped by org; invisible cross-org
  // ──────────────────────────────────────────────────────────────────────────

  it('service created in org A is invisible from org B', async () => {
    const a = await h.createOrg(`exp-svc-a-${Date.now()}`, 'منظمة خدمات أ');
    const b = await h.createOrg(`exp-svc-b-${Date.now()}`, 'منظمة خدمات ب');

    const svc = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.service.create({
        data: { organizationId: a.id, nameAr: 'خدمة تجريبية', durationMins: 30, price: 100 },
        select: { id: true },
      }),
    );

    let fromB: Awaited<ReturnType<typeof h.prisma.service.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.service.findFirst({ where: { id: svc.id } });
    });

    expect(fromB!).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. IntakeForm — scoped by org
  // ──────────────────────────────────────────────────────────────────────────

  it('intake form created in org A is invisible from org B', async () => {
    const a = await h.createOrg(`exp-form-a-${Date.now()}`, 'منظمة استمارات أ');
    const b = await h.createOrg(`exp-form-b-${Date.now()}`, 'منظمة استمارات ب');

    const form = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.intakeForm.create({
        data: { organizationId: a.id, nameAr: 'استمارة تجريبية' },
        select: { id: true },
      }),
    );

    let fromB: Awaited<ReturnType<typeof h.prisma.intakeForm.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.intakeForm.findFirst({ where: { id: form.id } });
    });

    expect(fromB!).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Rating — scoped by org
  // ──────────────────────────────────────────────────────────────────────────

  it('rating created in org A is invisible from org B', async () => {
    const a = await h.createOrg(`exp-rating-a-${Date.now()}`, 'منظمة تقييمات أ');
    const b = await h.createOrg(`exp-rating-b-${Date.now()}`, 'منظمة تقييمات ب');

    const rating = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.rating.create({
        data: {
          organizationId: a.id,
          bookingId: `bk-${Date.now()}`,
          clientId: `cl-${Date.now()}`,
          employeeId: `em-${Date.now()}`,
          score: 5,
        },
        select: { id: true },
      }),
    );

    let fromB: Awaited<ReturnType<typeof h.prisma.rating.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.rating.findFirst({ where: { id: rating.id } });
    });

    expect(fromB!).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. RLS hides Service rows at SQL level when GUC differs
  // ──────────────────────────────────────────────────────────────────────────

  it('RLS hides service rows at SQL level when GUC differs', async () => {
    const a = await h.createOrg(`exp-rls-a-${Date.now()}`, 'منظمة RLS خدمات أ');
    const b = await h.createOrg(`exp-rls-b-${Date.now()}`, 'منظمة RLS خدمات ب');

    const witnessName = `rls-svc-${Date.now()}`;
    await h.prisma.$executeRawUnsafe(
      `INSERT INTO "Service" (id, "organizationId", "nameAr", "durationMins", "price", "currency", "isActive", "isHidden", "hidePriceOnBooking", "hideDurationOnBooking", "bufferMinutes", "depositEnabled", "allowRecurring", "minParticipants", "maxParticipants", "reserveWithoutPayment", "allowedRecurringPatterns", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 30, 100, 'SAR', true, false, false, false, 0, false, false, 1, 1, false, '{}', now(), now())`,
      a.id,
      witnessName,
    );

    const tmpRole = `rls_probe_exp_${Date.now()}`;
    try {
      await h.prisma.$executeRawUnsafe(`CREATE ROLE ${tmpRole}`);
      await h.prisma.$executeRawUnsafe(`GRANT SELECT ON "Service" TO ${tmpRole}`);

      const rows = await h.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${b.id}'`);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${tmpRole}`);
        return tx.$queryRaw<Array<{ cnt: bigint }>>`
          SELECT COUNT(*)::bigint AS cnt FROM "Service" WHERE "nameAr" = ${witnessName}
        `;
      });

      expect(Number(rows[0].cnt)).toBe(0);
    } finally {
      await h.prisma.$executeRawUnsafe(`REVOKE ALL ON "Service" FROM ${tmpRole}`).catch(() => {});
      await h.prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${tmpRole}`).catch(() => {});
    }
  });
});
