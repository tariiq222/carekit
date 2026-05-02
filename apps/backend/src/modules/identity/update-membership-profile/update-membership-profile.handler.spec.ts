import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UpdateMembershipProfileHandler } from './update-membership-profile.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('UpdateMembershipProfileHandler', () => {
  let handler: UpdateMembershipProfileHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  const baseMembership = {
    id: 'm-1',
    userId: 'user-1',
    organizationId: 'org-1',
    role: 'RECEPTIONIST',
    isActive: true,
    displayName: null,
    jobTitle: null,
    avatarUrl: null,
    acceptedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UpdateMembershipProfileHandler,
        {
          provide: PrismaService,
          useValue: {
            membership: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          } as unknown as PrismaService,
        },
      ],
    }).compile();
    handler = module.get(UpdateMembershipProfileHandler);
    prisma = module.get(PrismaService);
  });

  it('updates displayName/jobTitle/avatarUrl when caller owns the membership', async () => {
    prisma.membership.findUnique.mockResolvedValue({
      id: 'm-1',
      userId: 'user-1',
      isActive: true,
    });
    prisma.membership.update.mockResolvedValue({
      ...baseMembership,
      displayName: 'د. أحمد',
      jobTitle: 'استشاري',
      avatarUrl: 'https://cdn.example.com/m-1/avatar.jpg',
    });

    const out = await handler.execute({
      userId: 'user-1',
      membershipId: 'm-1',
      displayName: 'د. أحمد',
      jobTitle: 'استشاري',
      avatarUrl: 'https://cdn.example.com/m-1/avatar.jpg',
    });

    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: {
        displayName: 'د. أحمد',
        jobTitle: 'استشاري',
        avatarUrl: 'https://cdn.example.com/m-1/avatar.jpg',
      },
    });
    expect(out.displayName).toBe('د. أحمد');
    expect(out.jobTitle).toBe('استشاري');
  });

  it('translates explicit null into clearing the field', async () => {
    prisma.membership.findUnique.mockResolvedValue({
      id: 'm-1',
      userId: 'user-1',
      isActive: true,
    });
    prisma.membership.update.mockResolvedValue({ ...baseMembership });

    await handler.execute({
      userId: 'user-1',
      membershipId: 'm-1',
      displayName: null,
    });

    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { displayName: null },
    });
  });

  it('throws NotFoundException when membership is missing', async () => {
    prisma.membership.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ userId: 'user-1', membershipId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when caller is not the owner', async () => {
    prisma.membership.findUnique.mockResolvedValue({
      id: 'm-1',
      userId: 'someone-else',
      isActive: true,
    });
    await expect(
      handler.execute({ userId: 'user-1', membershipId: 'm-1', displayName: 'x' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when membership is inactive', async () => {
    prisma.membership.findUnique.mockResolvedValue({
      id: 'm-1',
      userId: 'user-1',
      isActive: false,
    });
    await expect(
      handler.execute({ userId: 'user-1', membershipId: 'm-1', displayName: 'x' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
