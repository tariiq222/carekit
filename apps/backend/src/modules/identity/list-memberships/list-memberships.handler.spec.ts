import { Test } from '@nestjs/testing';
import { ListMembershipsHandler } from './list-memberships.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListMembershipsHandler', () => {
  let handler: ListMembershipsHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListMembershipsHandler,
        {
          provide: PrismaService,
          useValue: { membership: { findMany: jest.fn() } } as unknown as PrismaService,
        },
      ],
    }).compile();

    handler = module.get(ListMembershipsHandler);
    prisma = module.get(PrismaService);
  });

  it('returns only active memberships for the given user', async () => {
    prisma.membership.findMany.mockResolvedValue([
      {
        id: 'm1',
        organizationId: 'org-a',
        role: 'OWNER',
        isActive: true,
        organization: {
          id: 'org-a',
          slug: 'clinic-a',
          nameAr: 'العيادة أ',
          nameEn: 'Clinic A',
          status: 'ACTIVE',
        },
      },
    ]);

    const result = await handler.execute({ userId: 'u1' });
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', isActive: true },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.organization.nameAr).toBe('العيادة أ');
  });

  it('returns [] when the user has no memberships', async () => {
    prisma.membership.findMany.mockResolvedValue([]);
    const result = await handler.execute({ userId: 'u-missing' });
    expect(result).toEqual([]);
  });
});
