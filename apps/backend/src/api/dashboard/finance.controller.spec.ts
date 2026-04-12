import { DashboardFinanceController } from './finance.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createInvoice = fn({ id: 'inv-1' });
  const getInvoice = fn({ id: 'inv-1' });
  const processPayment = fn({ id: 'pay-1' });
  const listPayments = fn({ data: [], meta: {} });
  const applyCoupon = fn({ discount: 10 });
  const zatcaSubmit = fn({ status: 'ok' });
  const listCoupons = fn({ data: [], total: 0 });
  const getCoupon = fn({ id: 'c-1' });
  const createCoupon = fn({ id: 'c-1' });
  const updateCoupon = fn({ id: 'c-1' });
  const deleteCoupon = fn(undefined);
  const getZatcaConfig = fn({ id: 'z-1' });
  const upsertZatcaConfig = fn({ id: 'z-1' });
  const onboardZatca = fn({ id: 'z-1' });
  const controller = new DashboardFinanceController(
    createInvoice as never, getInvoice as never, processPayment as never,
    listPayments as never, applyCoupon as never, zatcaSubmit as never,
    listCoupons as never, getCoupon as never, createCoupon as never,
    updateCoupon as never, deleteCoupon as never, getZatcaConfig as never,
    upsertZatcaConfig as never, onboardZatca as never,
  );
  return { controller, createInvoice, getInvoice, processPayment, listPayments, applyCoupon, zatcaSubmit, listCoupons, getCoupon, createCoupon, updateCoupon, deleteCoupon, getZatcaConfig, upsertZatcaConfig, onboardZatca };
}

describe('DashboardFinanceController', () => {
  it('createInv — passes tenantId and converts dueAt to Date', async () => {
    const { controller, createInvoice } = buildController();
    await controller.createInv(TENANT, { dueAt: '2026-07-01', bookingId: 'b-1' } as never);
    expect(createInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, dueAt: expect.any(Date) }),
    );
  });

  it('createInv — handles missing dueAt', async () => {
    const { controller, createInvoice } = buildController();
    await controller.createInv(TENANT, { bookingId: 'b-1' } as never);
    expect(createInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, dueAt: undefined }),
    );
  });

  it('getInv — passes tenantId and invoiceId', async () => {
    const { controller, getInvoice } = buildController();
    await controller.getInv(TENANT, 'inv-1');
    expect(getInvoice.execute).toHaveBeenCalledWith({ tenantId: TENANT, invoiceId: 'inv-1' });
  });

  it('processPaymentEndpoint — passes tenantId', async () => {
    const { controller, processPayment } = buildController();
    await controller.processPaymentEndpoint(TENANT, { invoiceId: 'inv-1', method: 'CARD' } as never);
    expect(processPayment.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listPaymentsEndpoint — passes tenantId', async () => {
    const { controller, listPayments } = buildController();
    await controller.listPaymentsEndpoint(TENANT, {} as never);
    expect(listPayments.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listPaymentsEndpoint — converts fromDate and toDate when provided', async () => {
    const { controller, listPayments } = buildController();
    await controller.listPaymentsEndpoint(TENANT, { fromDate: '2026-01-01', toDate: '2026-01-31' } as never);
    expect(listPayments.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, fromDate: expect.any(Date), toDate: expect.any(Date) }),
    );
  });

  it('applyCouponEndpoint — passes tenantId', async () => {
    const { controller, applyCoupon } = buildController();
    await controller.applyCouponEndpoint(TENANT, { code: 'SAVE10', invoiceId: 'inv-1' } as never);
    expect(applyCoupon.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('zatca — passes tenantId and invoiceId', async () => {
    const { controller, zatcaSubmit } = buildController();
    await controller.zatca(TENANT, { invoiceId: 'inv-1' } as never);
    expect(zatcaSubmit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, invoiceId: 'inv-1' }),
    );
  });
});