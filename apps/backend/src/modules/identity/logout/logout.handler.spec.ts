import { Test } from '@nestjs/testing';
import { LogoutHandler } from './logout.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

describe('LogoutHandler', () => {
  let handler: LogoutHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenant: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LogoutHandler,
        { provide: PrismaService, useValue: { refreshToken: { updateMany: jest.fn() } } },
        {
          provide: TenantContextService,
          useValue: {
            requireOrganizationIdOrDefault: jest.fn().mockReturnValue('org-A'),
          },
        },
      ],
    }).compile();
    handler = module.get(LogoutHandler);
    prisma = module.get(PrismaService);
    tenant = module.get(TenantContextService);
  });

  it('scopes token revocation to the current org', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    await handler.execute({ userId: 'user-1' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-A',
          revokedAt: null,
        }),
      }),
    );
  });

  it('does not revoke tokens outside the current org', async () => {
    tenant.requireOrganizationIdOrDefault.mockReturnValue('org-B');
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await handler.execute({ userId: 'user-1' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-B' }),
      }),
    );
    // Verify the where clause never mentions the other org.
    const call = prisma.refreshToken.updateMany.mock.calls[0][0];
    expect(call.where.organizationId).toBe('org-B');
    expect(call.where.organizationId).not.toBe('org-A');
  });
});
