import { AdminOrganizationsController } from './organizations.controller';
import { Request } from 'express';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const listHandler = fn();
  const getHandler = fn();
  const suspendHandler = fn();
  const reinstateHandler = fn();
  const controller = new AdminOrganizationsController(
    listHandler as never,
    getHandler as never,
    suspendHandler as never,
    reinstateHandler as never,
  );
  return { controller, listHandler, getHandler, suspendHandler, reinstateHandler };
}

describe('AdminOrganizationsController', () => {
  const user = { sub: 'admin-1' };
  const req = { ip: '1.1.1.1', headers: { 'user-agent': 'jest' } } as unknown as Request;

  it('list — handles defaults and parsing', async () => {
    const { controller, listHandler } = buildController();
    
    // Default case
    await controller.list();
    expect(listHandler.execute).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
      search: undefined,
      suspended: undefined,
    });

    // Custom values
    await controller.list('2', '50', ' ACME ', 'true');
    expect(listHandler.execute).toHaveBeenCalledWith({
      page: 2,
      perPage: 50,
      search: 'ACME',
      suspended: true,
    });

    // Clamping and false boolean
    await controller.list('0', '200', ' ', 'false');
    expect(listHandler.execute).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      perPage: 100,
      search: undefined,
      suspended: false,
    }));
  });

  it('show — passes id', async () => {
    const { controller, getHandler } = buildController();
    await controller.show('org-1');
    expect(getHandler.execute).toHaveBeenCalledWith({ id: 'org-1' });
  });

  it('suspend — passes context and reason', async () => {
    const { controller, suspendHandler } = buildController();
    await controller.suspend('org-1', { reason: 'violation' }, user, req);
    expect(suspendHandler.execute).toHaveBeenCalledWith({
      organizationId: 'org-1',
      superAdminUserId: user.sub,
      reason: 'violation',
      ipAddress: '1.1.1.1',
      userAgent: 'jest',
    });
  });

  it('reinstate — passes context and reason', async () => {
    const { controller, reinstateHandler } = buildController();
    await controller.reinstate('org-1', { reason: 'fixed' }, user, req);
    expect(reinstateHandler.execute).toHaveBeenCalledWith({
      organizationId: 'org-1',
      superAdminUserId: user.sub,
      reason: 'fixed',
      ipAddress: '1.1.1.1',
      userAgent: 'jest',
    });
  });
});
