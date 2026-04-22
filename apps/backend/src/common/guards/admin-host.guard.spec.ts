import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminHostGuard } from './admin-host.guard';

const makeContext = (host?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: host === undefined ? {} : { host },
      }),
    }),
  }) as unknown as ExecutionContext;

describe('AdminHostGuard', () => {
  it('allows admin.localhost:5104', () => {
    const configService = {
      get: jest.fn().mockReturnValue('admin.localhost:5104'),
    };

    const guard = new AdminHostGuard(configService as never);

    expect(guard.canActivate(makeContext('admin.localhost:5104'))).toBe(true);
  });

  it('allows any host from a comma-separated allow-list', () => {
    const configService = {
      get: jest.fn().mockReturnValue('admin.carekit.app, admin.localhost:5104'),
    };

    const guard = new AdminHostGuard(configService as never);

    expect(guard.canActivate(makeContext('admin.carekit.app'))).toBe(true);
    expect(guard.canActivate(makeContext('admin.localhost:5104'))).toBe(true);
  });

  it('rejects clinic.carekit.app', () => {
    const configService = {
      get: jest.fn().mockReturnValue('admin.carekit.app'),
    };

    const guard = new AdminHostGuard(configService as never);

    expect(() => guard.canActivate(makeContext('clinic.carekit.app'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(makeContext('clinic.carekit.app'))).toThrow('admin_host_required');
  });

  it('rejects when the host header is missing', () => {
    const configService = {
      get: jest.fn().mockReturnValue('admin.carekit.app'),
    };

    const guard = new AdminHostGuard(configService as never);

    expect(() => guard.canActivate(makeContext())).toThrow(ForbiddenException);
  });

  it('matches hosts case-insensitively', () => {
    const configService = {
      get: jest.fn().mockReturnValue('ADMIN.CAREKIT.APP,ADMIN.LOCALHOST:5104'),
    };

    const guard = new AdminHostGuard(configService as never);

    expect(guard.canActivate(makeContext('ADMIN.LOCALHOST:5104'))).toBe(true);
    expect(guard.canActivate(makeContext('AdMiN.CaReKiT.ApP'))).toBe(true);
  });
});
