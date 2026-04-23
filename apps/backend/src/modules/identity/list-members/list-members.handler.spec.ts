import { Test, TestingModule } from '@nestjs/testing';
import { ListMembersHandler } from './list-members.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

describe('ListMembersHandler', () => {
  let handler: ListMembersHandler;
  let prisma: PrismaService;
  let tenant: TenantContextService;

  const mockMembers = [
    {
      id: 'm1',
      userId: 'u1',
      role: 'OWNER',
      isActive: true,
      acceptedAt: new Date(),
      createdAt: new Date(),
    },
    {
      id: 'm2',
      userId: 'u2',
      role: 'ADMIN',
      isActive: true,
      acceptedAt: new Date(),
      createdAt: new Date(),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListMembersHandler,
        {
          provide: PrismaService,
          useValue: {
            membership: {
              findMany: jest.fn().mockResolvedValue(mockMembers),
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

    handler = module.get<ListMembersHandler>(ListMembersHandler);
    prisma = module.get<PrismaService>(PrismaService);
    tenant = module.get<TenantContextService>(TenantContextService);
  });

  it('should return paginated members for current org', async () => {
    const result = await handler.execute({ page: 1, limit: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(tenant.requireOrganizationId).toHaveBeenCalled();
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-123' }),
      }),
    );
  });

  it('should filter by role when provided', async () => {
    await handler.execute({ page: 1, limit: 20, role: 'ADMIN' });

    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'ADMIN' }),
      }),
    );
  });

  it('should filter by isActive when provided', async () => {
    await handler.execute({ page: 1, limit: 20, isActive: true });

    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });
});