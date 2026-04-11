import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserHandler } from './create-user.handler';
import { DeactivateUserHandler } from './deactivate-user.handler';
import { ListUsersHandler } from './list-users.handler';
import { PasswordService } from '../shared/password.service';
import { PrismaService } from '../../../infrastructure/database';

describe('Users handlers', () => {
  let createHandler: CreateUserHandler;
  let deactivateHandler: DeactivateUserHandler;
  let listHandler: ListUsersHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateUserHandler,
        DeactivateUserHandler,
        ListUsersHandler,
        { provide: PasswordService, useValue: { hash: jest.fn().mockResolvedValue('hashed') } },
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
          },
        },
      ],
    }).compile();

    createHandler = module.get(CreateUserHandler);
    deactivateHandler = module.get(DeactivateUserHandler);
    listHandler = module.get(ListUsersHandler);
    prisma = module.get(PrismaService);
  });

  describe('CreateUserHandler', () => {
    it('creates user with hashed password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      const result = await createHandler.execute({
        tenantId: 'tenant-1', email: 'a@b.com', password: 'pass123', name: 'Ali', role: 'RECEPTIONIST' as never,
      });
      expect(result.id).toBe('u1');
    });

    it('throws ConflictException when email already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        createHandler.execute({ tenantId: 'tenant-1', email: 'a@b.com', password: 'pass', name: 'Ali', role: 'RECEPTIONIST' as never }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('DeactivateUserHandler', () => {
    it('deactivates user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, tenantId: 'tenant-1' });
      prisma.user.update.mockResolvedValue({ id: 'u1', isActive: false });
      await deactivateHandler.execute({ userId: 'u1', tenantId: 'tenant-1' });
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(deactivateHandler.execute({ userId: 'u1', tenantId: 'tenant-1' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('ListUsersHandler', () => {
    it('returns paginated users', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      prisma.user.count.mockResolvedValue(1);
      const result = await listHandler.execute({ tenantId: 'tenant-1', page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
