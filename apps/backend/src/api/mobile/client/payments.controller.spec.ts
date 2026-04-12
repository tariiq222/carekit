import { MobileClientPaymentsController, MobileListPaymentsQuery } from './payments.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', email: 'client@test.com', role: 'client' as const };

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const listPayments = fn({ data: [], meta: {} });
  const getInvoice = fn({ id: 'inv-1', total: 100 });
  const controller = new MobileClientPaymentsController(listPayments as never, getInvoice as never);
  return { controller, listPayments, getInvoice };
}

describe('MobileClientPaymentsController', () => {
  describe('listMyPayments', () => {
    it('passes tenantId, clientId, and pagination defaults', async () => {
      const { controller, listPayments } = buildController();
      await controller.listMyPayments(TENANT, USER, {});
      expect(listPayments.execute).toHaveBeenCalledWith({
        tenantId: TENANT, clientId: USER.sub, page: 1, limit: 20,
      });
    });

    it('uses query params for page and limit', async () => {
      const { controller, listPayments } = buildController();
      const q: MobileListPaymentsQuery = { page: 3, limit: 50 };
      await controller.listMyPayments(TENANT, USER, q);
      expect(listPayments.execute).toHaveBeenCalledWith({
        tenantId: TENANT, clientId: USER.sub, page: 3, limit: 50,
      });
    });

    it('returns handler result', async () => {
      const { controller } = buildController();
      const result = await controller.listMyPayments(TENANT, USER, {});
      expect(result).toEqual({ data: [], meta: {} });
    });
  });

  describe('getInvoiceEndpoint', () => {
    it('passes tenantId and invoiceId to handler', async () => {
      const { controller, getInvoice } = buildController();
      await controller.getInvoiceEndpoint(TENANT, 'inv-123');
      expect(getInvoice.execute).toHaveBeenCalledWith({ tenantId: TENANT, invoiceId: 'inv-123' });
    });

    it('returns handler result', async () => {
      const { controller } = buildController();
      const result = await controller.getInvoiceEndpoint(TENANT, 'inv-123');
      expect(result).toEqual({ id: 'inv-1', total: 100 });
    });
  });
});
