import { testPrisma } from '../../setup/db.setup';
import {
  setupFlowFixtures,
  teardownFlowFixtures,
  authHeaders,
  type FlowFixtures,
} from './_helpers/flow-fixtures';

describe('Flows — Waitlist (e2e)', () => {
  let fx: FlowFixtures;

  beforeAll(async () => {
    fx = await setupFlowFixtures();
  });

  afterAll(async () => {
    await teardownFlowFixtures();
  });

  it('[FLOW-WL-01][Flows/waitlist][P1-High] إضافة للـ waitlist → WAITING في DB', async () => {
    const res = await fx.req
      .post('/dashboard/bookings/waitlist')
      .set(authHeaders(fx.token))
      .send({
        clientId: fx.clientId,
        employeeId: fx.employeeId,
        serviceId: fx.serviceId,
        branchId: fx.branchId,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const entry = await (
      testPrisma as never as {
        waitlistEntry: {
          findUnique(args: unknown): Promise<{ status: string; clientId: string } | null>;
        };
      }
    ).waitlistEntry.findUnique({ where: { id: res.body.id } });
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('WAITING');
    expect(entry!.clientId).toBe(fx.clientId);
  });

  // TODO(backend): automatic slot-available notification
  //   Needs: BullMQ job that watches for cancelled/freed slots and emits
  //   NotificationChannel event. No job/listener exists. Waitlist promotion
  //   would also update WaitlistEntry.status → PROMOTED.
  it.skip('[FLOW-WL-02][Flows/waitlist][P2-Medium] إشعار عند توفر slot (PENDING backend)', () => {
    // implement once waitlist-promotion job + notification wiring lands
  });

  // TODO(backend): waitlist → booking conversion
  //   Needs: POST /dashboard/bookings/waitlist/:id/promote handler that
  //   creates a Booking from a promoted WaitlistEntry. Route not defined.
  it.skip('[FLOW-WL-03][Flows/waitlist][P2-Medium] تحويل waitlist → booking (PENDING backend)', () => {
    // implement once promote-waitlist-entry handler lands
  });
});
