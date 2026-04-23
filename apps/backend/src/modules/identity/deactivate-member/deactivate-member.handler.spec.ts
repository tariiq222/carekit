import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DeactivateMemberHandler } from './deactivate-member.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

describe('DeactivateMemberHandler', () => {
  let handler: DeactivateMemberHandler;
  let prisma: PrismaService;
  let tenant: TenantContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeactivateMemberHandler,
        {
          provide: PrismaService,
          useValue: {
            membership: {
              findFirst: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            requireOrganizationId: jest.fn().mockReturnValue('org-123'),
            requireUserId: jest.fn().mockReturnValue('current-user-id'),
          },
        },
      ],
    }).compile();

    handler = module.get<DeactivateMemberHandler>(DeactivateMemberHandler);
    prisma = module.get<PrismaService>(PrismaService);
    tenant = module.get<TenantContextService>(TenantContextService);
  });

  it('should deactivate member', async () => {
    prisma.membership.findFirst = jest.fn().mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      role: 'ADMIN',
      organizationId: 'org-123',
      isActive: true,
    });
    prisma.membership.count = jest.fn().mockResolvedValue(2);
    prisma.membership.update = jest.fn().mockResolvedValue({});

    await handler.execute({ membershipId: 'm1' });

    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { isActive: false },
    });
  });

  it('should throw when membership not found', async () => {
    prisma.membership.findFirst = jest.fn().mockResolvedValue(null);

    await expect(handler.execute({ membershipId: 'm1' })).rejects.toThrow(BadRequestException);
  });

  it('should reject deactivating self', async () => {
    prisma.membership.findFirst = jest.fn().mockResolvedValue({
      id: 'm1',
      userId: 'current-user-id',
      role: 'ADMIN',
      organizationId: 'org-123',
    });

    await expect(handler.execute({ membershipId: 'm1' })).rejects.toThrow(BadRequestException);
  });

  it('should reject deactivating sole OWNER', async () => {
    prisma.membership.findFirst = jest.fn().mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      role: 'OWNER',
      organizationId: 'org-123',
      isActive: true,
    });
    prisma.membership.count = jest.fn().mockResolvedValue(1);

    await expect(handler.execute({ membershipId: 'm1' })).rejects.toThrow(BadRequestException);
  });
});