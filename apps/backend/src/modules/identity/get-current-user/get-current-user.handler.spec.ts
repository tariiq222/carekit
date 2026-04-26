import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetCurrentUserHandler } from './get-current-user.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetCurrentUserHandler', () => {
  let handler: GetCurrentUserHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetCurrentUserHandler,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            membership: { findFirst: jest.fn().mockResolvedValue(null) },
          },
        },
      ],
    }).compile();
    handler = module.get(GetCurrentUserHandler);
    prisma = module.get(PrismaService);
  });

  it('returns user when found', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A B' });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.id).toBe('u1');
  });

  it('throws NotFoundException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'u1' })).rejects.toThrow(NotFoundException);
  });

  it('returns firstName/lastName split from name', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Tariq Al Walidi' });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.firstName).toBe('Tariq');
    expect(result.lastName).toBe('Al Walidi');
  });

  it('returns organizationId from the active membership', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Solo' });
    prisma.membership.findFirst.mockResolvedValue({
      organizationId: 'org_42',
      organization: { vertical: { slug: 'clinic' } },
    });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.organizationId).toBe('org_42');
  });

  it('returns verticalSlug from the active membership organization', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Solo' });
    prisma.membership.findFirst.mockResolvedValue({
      organizationId: 'org_42',
      organization: { vertical: { slug: 'salon' } },
    });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.verticalSlug).toBe('salon');
  });

  it('returns verticalSlug=null when org has no vertical assigned', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Solo' });
    prisma.membership.findFirst.mockResolvedValue({
      organizationId: 'org_42',
      organization: { vertical: null },
    });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.verticalSlug).toBeNull();
  });

  it('returns organizationId=null when user has no active membership', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Solo' });
    prisma.membership.findFirst.mockResolvedValue(null);
    const result = await handler.execute({ userId: 'u1' });
    expect(result.organizationId).toBeNull();
    expect(result.verticalSlug).toBeNull();
  });
});
