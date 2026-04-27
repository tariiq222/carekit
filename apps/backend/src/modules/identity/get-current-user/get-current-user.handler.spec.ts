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
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', customRole: null });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.user.id).toBe('u1');
    expect(result.user.email).toBe('a@b.com');
  });

  it('throws NotFoundException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'u1' })).rejects.toThrow(NotFoundException);
  });

  it('returns firstName/lastName from user fields', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'Tariq', lastName: 'Al Walidi', customRole: null });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.user.firstName).toBe('Tariq');
    expect(result.user.lastName).toBe('Al Walidi');
  });

  it('returns phoneVerifiedAt and emailVerifiedAt in user payload', async () => {
    const now = new Date();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', phoneVerifiedAt: now, emailVerifiedAt: null, customRole: null });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.user.phoneVerifiedAt).toBe(now);
    expect(result.user.emailVerifiedAt).toBeNull();
  });

  it('returns activeMembership when user has one', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', customRole: null });
    prisma.membership.findFirst.mockResolvedValue({
      id: 'm1',
      organizationId: 'org_42',
      role: 'RECEPTIONIST',
      organization: { vertical: { slug: 'clinic' } },
    });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.activeMembership).toEqual({
      id: 'm1',
      organizationId: 'org_42',
      role: 'RECEPTIONIST',
      verticalSlug: 'clinic',
    });
  });

  it('returns null activeMembership when user has no membership', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', customRole: null });
    prisma.membership.findFirst.mockResolvedValue(null);
    const result = await handler.execute({ userId: 'u1' });
    expect(result.activeMembership).toBeNull();
  });

  it('returns verticalSlug from the active membership organization', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', customRole: null });
    prisma.membership.findFirst.mockResolvedValue({
      id: 'm1',
      organizationId: 'org_42',
      role: 'ADMIN',
      organization: { vertical: { slug: 'salon' } },
    });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.activeMembership?.verticalSlug).toBe('salon');
  });
});
