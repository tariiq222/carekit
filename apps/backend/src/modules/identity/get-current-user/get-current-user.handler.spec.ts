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
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
      ],
    }).compile();
    handler = module.get(GetCurrentUserHandler);
    prisma = module.get(PrismaService);
  });

  it('returns user when found', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.id).toBe('u1');
  });

  it('throws NotFoundException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'u1' })).rejects.toThrow(NotFoundException);
  });
});
