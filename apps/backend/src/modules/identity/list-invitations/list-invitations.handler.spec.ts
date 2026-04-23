import { Test, TestingModule } from '@nestjs/testing';
import { ListInvitationsHandler } from './list-invitations.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

describe('ListInvitationsHandler', () => {
  let handler: ListInvitationsHandler;
  let prisma: PrismaService;

  const mockInvitations = [
    {
      id: 'inv-1',
      email: 'user1@example.com',
      role: 'ADMIN',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      acceptedAt: null,
      revokedAt: null,
    },
    {
      id: 'inv-2',
      email: 'user2@example.com',
      role: 'RECEPTIONIST',
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() - 86400000),
      createdAt: new Date(),
      acceptedAt: null,
      revokedAt: null,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListInvitationsHandler,
        {
          provide: PrismaService,
          useValue: {
            invitation: {
              findMany: jest.fn().mockResolvedValue(mockInvitations),
              count: jest.fn().mockResolvedValue(2),
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

    handler = module.get<ListInvitationsHandler>(ListInvitationsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should return pending and expired invitations', async () => {
    const result = await handler.execute({ page: 1, limit: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(prisma.invitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-123' }),
      }),
    );
  });
});