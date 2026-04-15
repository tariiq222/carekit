import { testPrisma } from '../../setup/db.setup';
import {
  setupFlowFixtures,
  teardownFlowFixtures,
  authHeaders,
  type FlowFixtures,
} from './_helpers/flow-fixtures';

describe('Flows — Recurring Bookings (e2e)', () => {
  let fx: FlowFixtures;

  beforeAll(async () => {
    fx = await setupFlowFixtures();
  });

  afterAll(async () => {
    await teardownFlowFixtures();
  });

  it('[FLOW-REC-01][Flows/recurring-bookings][P1-High] إنشاء سلسلة أسبوعية 4 حجوزات', async () => {
    const firstScheduledAt = new Date(Date.now() + 86_400_000).toISOString();

    const res = await fx.req
      .post('/dashboard/bookings/recurring')
      .set(authHeaders(fx.token))
      .send({
        branchId: fx.branchId,
        clientId: fx.clientId,
        employeeId: fx.employeeId,
        serviceId: fx.serviceId,
        scheduledAt: firstScheduledAt,
        durationMins: 60,
        price: 200,
        currency: 'SAR',
        frequency: 'WEEKLY',
        intervalDays: 7,
        occurrences: 4,
      });

    expect([200, 201]).toContain(res.status);

    // Expect either the handler response to contain bookings or recurringGroupId,
    // and at minimum the DB to hold 4 Bookings tied to the same recurringGroupId.
    const bookings = await (
      testPrisma as never as {
        booking: {
          findMany(args: unknown): Promise<Array<{ id: string; recurringGroupId: string | null }>>;
        };
      }
    ).booking.findMany({
      where: { clientId: fx.clientId, employeeId: fx.employeeId },
    });
    expect(bookings.length).toBe(4);

    const groupIds = new Set(bookings.map((b) => b.recurringGroupId));
    expect(groupIds.size).toBe(1);
    expect([...groupIds][0]).not.toBeNull();
  });

  // TODO(backend): cancel a single occurrence from a recurring series
  //   Needs: PATCH /dashboard/bookings/:id/cancel preserves the series; verify
  //   siblings remain untouched. Today's cancel handler works on one booking
  //   at a time and doesn't need recurring context — but this test needs a
  //   distinct assertion (siblings still ACTIVE). Skipped until product
  //   confirms the expected behavior for "cancel only this one" UX.
  it.skip('[FLOW-REC-02][Flows/recurring-bookings][P2-Medium] إلغاء حجز واحد من سلسلة (PENDING product spec)', () => {
    // implement once product confirms: cancel single vs entire series UX
  });

  // TODO(backend): bulk-update entire series
  //   Needs: PATCH /dashboard/bookings/recurring/:recurringGroupId handler
  //   that updates all non-completed occurrences (reschedule, notes, price).
  //   Handler does not exist.
  it.skip('[FLOW-REC-03][Flows/recurring-bookings][P2-Medium] تعديل كل السلسلة (PENDING backend)', () => {
    // implement once recurring-group bulk-update handler lands
  });
});
