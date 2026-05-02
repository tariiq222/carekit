import { DashboardFinanceController } from './finance.controller';
import { REQUIRE_FEATURE_KEY } from '../../modules/platform/billing/feature.decorator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

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
  const getPaymentStats = fn({ total: 0 });
  const refundPayment = fn({ id: 'pay-1' });
  const verifyPayment = fn({ id: 'pay-1' });
  const bankTransferUpload = fn({ id: 'pay-1' });
  const getMoyasarConfig = fn({ publishableKey: 'pk_test_x' });
  const upsertMoyasarConfig = fn({ organizationId: 'org-1' });
  const testMoyasarConfig = fn({ ok: true, status: 'OK' });
  const controller = new DashboardFinanceController(
    createInvoice as never, getInvoice as never, processPayment as never,
    listPayments as never, applyCoupon as never, zatcaSubmit as never,
    listCoupons as never, getCoupon as never, createCoupon as never,
    updateCoupon as never, deleteCoupon as never, getZatcaConfig as never,
    upsertZatcaConfig as never, onboardZatca as never, getPaymentStats as never,
    refundPayment as never, verifyPayment as never, bankTransferUpload as never,
    getMoyasarConfig as never, upsertMoyasarConfig as never, testMoyasarConfig as never,
  );
  return {
    controller, createInvoice, getInvoice, processPayment, listPayments,
    applyCoupon, zatcaSubmit, listCoupons, getCoupon, createCoupon,
    updateCoupon, deleteCoupon, getZatcaConfig, upsertZatcaConfig,
    onboardZatca, getPaymentStats, refundPayment, verifyPayment, bankTransferUpload,
    getMoyasarConfig, upsertMoyasarConfig, testMoyasarConfig,
  };
}

describe('DashboardFinanceController', () => {
  it('createInv — converts dueAt to Date', async () => {
    const { controller, createInvoice } = buildController();
    await controller.createInv({ dueAt: '2026-07-01', bookingId: 'b-1' } as never);
    expect(createInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: expect.any(Date) }),
    );
  });

  it('createInv — handles missing dueAt', async () => {
    const { controller, createInvoice } = buildController();
    await controller.createInv({ bookingId: 'b-1' } as never);
    expect(createInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: undefined }),
    );
  });

  it('getInv — passes invoiceId', async () => {
    const { controller, getInvoice } = buildController();
    await controller.getInv('inv-1');
    expect(getInvoice.execute).toHaveBeenCalledWith({ invoiceId: 'inv-1' });
  });

  it('processPaymentEndpoint — delegates to handler', async () => {
    const { controller, processPayment } = buildController();
    await controller.processPaymentEndpoint({ invoiceId: 'inv-1', method: 'CARD' } as never);
    expect(processPayment.execute).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: 'inv-1' }));
  });

  it('listPaymentsEndpoint — converts fromDate and toDate when provided', async () => {
    const { controller, listPayments } = buildController();
    await controller.listPaymentsEndpoint({ fromDate: '2026-01-01', toDate: '2026-01-31' } as never);
    expect(listPayments.execute).toHaveBeenCalledWith(
      expect.objectContaining({ fromDate: expect.any(Date), toDate: expect.any(Date) }),
    );
  });

  it('applyCouponEndpoint — delegates to handler', async () => {
    const { controller, applyCoupon } = buildController();
    await controller.applyCouponEndpoint({ code: 'SAVE10', invoiceId: 'inv-1' } as never);
    expect(applyCoupon.execute).toHaveBeenCalledWith(expect.objectContaining({ code: 'SAVE10' }));
  });

  it('zatca — passes invoiceId', async () => {
    const { controller, zatcaSubmit } = buildController();
    await controller.zatca({ invoiceId: 'inv-1' } as never);
    expect(zatcaSubmit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'inv-1' }),
    );
  });
});

describe('@RequireFeature metadata — COUPONS', () => {
  it.each([
    'applyCouponEndpoint',
    'listCouponsEndpoint',
    'getCouponEndpoint',
    'createCouponEndpoint',
    'updateCouponEndpoint',
    'deleteCouponEndpoint',
  ])('annotates %s with FeatureKey.COUPONS', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardFinanceController.prototype as unknown as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.COUPONS);
  });
});

describe('@RequireFeature metadata — ZATCA', () => {
  it.each([
    'zatca',
    'getZatcaConfigEndpoint',
    'upsertZatcaConfigEndpoint',
    'onboardZatcaEndpoint',
  ])('annotates %s with FeatureKey.ZATCA', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardFinanceController.prototype as unknown as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.ZATCA);
  });
});

describe('@RequireFeature metadata — BANK_TRANSFER_PAYMENTS', () => {
  it.each([
    'bankTransferEndpoint',
  ])('annotates %s with FeatureKey.BANK_TRANSFER_PAYMENTS', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardFinanceController.prototype as unknown as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.BANK_TRANSFER_PAYMENTS);
  });
});
