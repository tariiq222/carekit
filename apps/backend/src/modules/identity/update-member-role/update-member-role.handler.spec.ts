import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UpdateMemberRoleHandler } from './update-member-role.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

describe('UpdateMemberRoleHandler', () => {
  let handler: UpdateMemberRoleHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateMemberRoleHandler,
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
          },
        },
      ],
    }).compile();

    handler = module.get<UpdateMemberRoleHandler>(UpdateMemberRoleHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should update member role', async () => {
    prisma.membership.findFirst = jest.fn().mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      role: 'ADMIN',
      organizationId: 'org-123',
    });
    prisma.membership.count = jest.fn().mockResolvedValue(2);
    prisma.membership.update = jest.fn().mockResolvedValue({});

    await handler.execute({ membershipId: 'm1', role: 'RECEPTIONIST' });

    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { role: 'RECEPTIONIST' },
    });
  });

  it('should throw when membership not found', async () => {
    prisma.membership.findFirst = jest.fn().mockResolvedValue(null);

    await expect(handler.execute({ membershipId: 'm1', role: 'ADMIN' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject change on sole OWNER', async () => {
    prisma.membership.findFirst = jest.fn().mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      role: 'OWNER',
      organizationId: 'org-123',
    });
    prisma.membership.count = jest.fn().mockResolvedValue(1);

    await expect(handler.execute({ membershipId: 'm1', role: 'ADMIN' })).rejects.toThrow(
      BadRequestException,
    );
  });
});