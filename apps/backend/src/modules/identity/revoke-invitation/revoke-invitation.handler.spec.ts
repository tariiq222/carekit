import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RevokeInvitationHandler } from './revoke-invitation.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

describe('RevokeInvitationHandler', () => {
  let handler: RevokeInvitationHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevokeInvitationHandler,
        {
          provide: PrismaService,
          useValue: {
            invitation: {
              findFirst: jest.fn(),
              update: jest.fn(),
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

    handler = module.get<RevokeInvitationHandler>(RevokeInvitationHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should revoke pending invitation', async () => {
    prisma.invitation.findFirst = jest.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      organizationId: 'org-123',
    });
    prisma.invitation.update = jest.fn().mockResolvedValue({});

    await handler.execute({ invitationId: 'inv-1' });

    expect(prisma.invitation.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'REVOKED', revokedAt: expect.any(Date) },
    });
  });

  it('should throw when invitation not found', async () => {
    prisma.invitation.findFirst = jest.fn().mockResolvedValue(null);

    await expect(handler.execute({ invitationId: 'inv-1' })).rejects.toThrow(BadRequestException);
  });

  it('should throw when invitation already accepted', async () => {
    prisma.invitation.findFirst = jest.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'ACCEPTED',
    });

    await expect(handler.execute({ invitationId: 'inv-1' })).rejects.toThrow(BadRequestException);
  });

  it('should be no-op when invitation already revoked', async () => {
    prisma.invitation.findFirst = jest.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'REVOKED',
    });

    await handler.execute({ invitationId: 'inv-1' });

    expect(prisma.invitation.update).not.toHaveBeenCalled();
  });
});