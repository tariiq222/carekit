import { AdminAuditLogController } from './audit-log.controller';
import { SuperAdminActionType } from '@prisma/client';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const handler = fn();
  const controller = new AdminAuditLogController(handler as never);
  return { controller, handler };
}

describe('AdminAuditLogController', () => {
  it('list — handles defaults and paging', async () => {
    const { controller, handler } = buildController();
    await controller.list();
    expect(handler.execute).toHaveBeenCalledWith({
      page: 1,
      perPage: 50,
      actionType: undefined,
      superAdminUserId: undefined,
      organizationId: undefined,
      from: undefined,
      to: undefined,
    });
  });

  it('list — validates actionType enum', async () => {
    const { controller, handler } = buildController();
    const valid = Object.values(SuperAdminActionType)[0];
    await controller.list(undefined, undefined, valid);
    expect(handler.execute).toHaveBeenCalledWith(expect.objectContaining({
      actionType: valid,
    }));

    await controller.list(undefined, undefined, 'INVALID_TYPE');
    expect(handler.execute).toHaveBeenCalledWith(expect.objectContaining({
      actionType: undefined,
    }));
  });

  it('list — handles string trimming and whitespace', async () => {
    const { controller, handler } = buildController();
    await controller.list(undefined, undefined, undefined, ' admin-1 ', ' ');
    expect(handler.execute).toHaveBeenCalledWith(expect.objectContaining({
      superAdminUserId: 'admin-1',
      organizationId: undefined,
    }));
  });

  it('list — parses valid dates and ignores invalid ones', async () => {
    const { controller, handler } = buildController();
    const fromStr = '2026-01-01T00:00:00.000Z';
    const toStr = '2026-12-31T23:59:59.999Z';
    
    await controller.list(undefined, undefined, undefined, undefined, undefined, fromStr, toStr);
    expect(handler.execute).toHaveBeenCalledWith(expect.objectContaining({
      from: new Date(fromStr),
      to: new Date(toStr),
    }));

    await controller.list(undefined, undefined, undefined, undefined, undefined, 'not-a-date', 'invalid');
    expect(handler.execute).toHaveBeenCalledWith(expect.objectContaining({
      from: undefined,
      to: undefined,
    }));
  });

  it('list — clamps perPage', async () => {
    const { controller, handler } = buildController();
    await controller.list('1', '1000');
    expect(handler.execute).toHaveBeenCalledWith(expect.objectContaining({
      perPage: 200,
    }));
  });
});
