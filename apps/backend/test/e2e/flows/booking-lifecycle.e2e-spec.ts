import { testPrisma } from '../../setup/db.setup';
import { seedBooking } from '../../setup/seed.helper';
import {
  setupFlowFixtures,
  teardownFlowFixtures,
  authHeaders,
  FLOW_TENANT,
  type FlowFixtures,
} from './_helpers/flow-fixtures';

type BookingRow = {
  id: string;
  status: string;
  checkedInAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
};

const bookingModel = () =>
  (testPrisma as never as {
    booking: { findUnique(args: unknown): Promise<BookingRow | null> };
  }).booking;

describe('Flows — Booking Full Lifecycle (e2e)', () => {
  let fx: FlowFixtures;
  let bookingId: string;

  beforeAll(async () => {
    fx = await setupFlowFixtures();
  });

  afterAll(async () => {
    await teardownFlowFixtures();
  });

  it('[FLOW-BLC-01][Flows/booking-lifecycle][P1-High] إنشاء حجز → PENDING', async () => {
    const res = await fx.req
      .post('/dashboard/bookings')
      .set(authHeaders(fx.token))
      .send({
        branchId: fx.branchId,
        clientId: fx.clientId,
        employeeId: fx.employeeId,
        serviceId: fx.serviceId,
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('PENDING');
    bookingId = res.body.id;
  });

  it('[FLOW-BLC-02][Flows/booking-lifecycle][P1-High] PENDING → CONFIRMED', async () => {
    const res = await fx.req
      .patch(`/dashboard/bookings/${bookingId}/confirm`)
      .set(authHeaders(fx.token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('[FLOW-BLC-03][Flows/booking-lifecycle][P1-High] CONFIRMED → check-in يختم checkedInAt', async () => {
    // Design note: BookingStatus enum has no CHECKED_IN. The receptionist's
    // "mark as arrived" action keeps status=CONFIRMED and stamps checkedInAt.
    // See apps/backend/src/modules/bookings/check-in-booking/check-in-booking.handler.ts.
    const res = await fx.req
      .patch(`/dashboard/bookings/${bookingId}/check-in`)
      .set(authHeaders(fx.token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');

    const inDb = await bookingModel().findUnique({ where: { id: bookingId } });
    expect(inDb!.checkedInAt).not.toBeNull();
  });

  it('[FLOW-BLC-04][Flows/booking-lifecycle][P1-High] CONFIRMED (checked in) → COMPLETED', async () => {
    const res = await fx.req
      .patch(`/dashboard/bookings/${bookingId}/complete`)
      .set(authHeaders(fx.token))
      .send({ completionNotes: 'جلسة مكتملة' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');

    const inDb = await bookingModel().findUnique({ where: { id: bookingId } });
    expect(inDb!.completedAt).not.toBeNull();
  });

  it('[FLOW-BLC-05][Flows/booking-lifecycle][P1-High] invoice تُنشأ تلقائياً بعد CONFIRMED', async () => {
    // BookingConfirmedHandler (finance) subscribes to 'bookings.booking.confirmed'
    // and creates an invoice automatically. See
    // apps/backend/src/modules/finance/create-invoice/booking-confirmed.handler.ts.
    // Confirmation happened in FLOW-BLC-02; the event fires on the same process
    // so by now the invoice row must already exist for this booking.
    const invoice = await (
      testPrisma as never as {
        invoice: {
          findUnique(args: unknown): Promise<{
            id: string;
            bookingId: string | null;
            tenantId: string;
            status: string;
            total: unknown;
          } | null>;
        };
      }
    ).invoice.findUnique({ where: { bookingId } });

    expect(invoice).not.toBeNull();
    expect(invoice!.bookingId).toBe(bookingId);
    expect(invoice!.tenantId).toBe(FLOW_TENANT);
    expect(invoice!.status).toBe('ISSUED');
    expect(Number(invoice!.total)).toBeGreaterThan(0);

    // Double-create attempt must be idempotent at the API layer: returns 409.
    const dup = await fx.req
      .post('/dashboard/finance/invoices')
      .set(authHeaders(fx.token))
      .send({
        bookingId,
        branchId: fx.branchId,
        clientId: fx.clientId,
        employeeId: fx.employeeId,
        subtotal: 200,
      });
    expect(dup.status).toBe(409);
  });

  it('[FLOW-BLC-06][Flows/booking-lifecycle][P1-High] cancel من حالة PENDING', async () => {
    const seeded = await seedBooking(testPrisma as never, FLOW_TENANT, {
      clientId: fx.clientId,
      employeeId: fx.employeeId,
      serviceId: fx.serviceId,
      branchId: fx.branchId,
      status: 'PENDING',
    });

    const res = await fx.req
      .patch(`/dashboard/bookings/${seeded.id}/cancel`)
      .set(authHeaders(fx.token))
      .send({ reason: 'CLIENT_REQUESTED', source: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');

    const inDb = await bookingModel().findUnique({ where: { id: seeded.id } });
    expect(inDb!.cancelledAt).not.toBeNull();
  });

  it('[FLOW-BLC-07][Flows/booking-lifecycle][P1-High] no-show على حجز CONFIRMED', async () => {
    const seeded = await seedBooking(testPrisma as never, FLOW_TENANT, {
      clientId: fx.clientId,
      employeeId: fx.employeeId,
      serviceId: fx.serviceId,
      branchId: fx.branchId,
      status: 'CONFIRMED',
      scheduledAt: new Date(Date.now() - 3_600_000),
    });

    const res = await fx.req
      .patch(`/dashboard/bookings/${seeded.id}/no-show`)
      .set(authHeaders(fx.token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('NO_SHOW');
  });
});
