import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TenantContextService } from '../tenant';
import { ClientSessionGuard } from './client-session.guard';

describe('ClientSessionGuard', () => {
  let tenant: { set: jest.Mock };
  let guard: ClientSessionGuard;

  beforeEach(() => {
    tenant = { set: jest.fn() };
    guard = new ClientSessionGuard(tenant as unknown as TenantContextService);
  });

  it('stamps tenant context for authenticated client sessions', () => {
    const client = {
      id: 'client-1',
      email: 'client@example.com',
      phone: '+966500000000',
      organizationId: 'org-1',
    };

    const result = guard.handleRequest(null, client, undefined, {} as ExecutionContext);

    expect(result).toBe(client);
    expect(tenant.set).toHaveBeenCalledWith({
      organizationId: 'org-1',
      membershipId: '',
      id: 'client-1',
      role: 'CLIENT',
      isSuperAdmin: false,
    });
  });

  it('rejects missing client sessions', () => {
    expect(() =>
      guard.handleRequest(null, null as never, undefined, {} as ExecutionContext),
    ).toThrow(UnauthorizedException);
    expect(tenant.set).not.toHaveBeenCalled();
  });

  it('rejects client sessions without tenant claim', () => {
    expect(() =>
      guard.handleRequest(
        null,
        { id: 'client-1', organizationId: null },
        undefined,
        {} as ExecutionContext,
      ),
    ).toThrow(UnauthorizedException);
    expect(tenant.set).not.toHaveBeenCalled();
  });
});
