import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientGender, ClientSource } from '@prisma/client';
import { CreateClientHandler } from './create-client.handler';
import { UpdateClientHandler } from './update-client.handler';
import { ListClientsHandler } from './list-clients.handler';
import { GetClientHandler } from './get-client.handler';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';

const mockClient = {
  id: 'c1',
  tenantId: 'tenant-1',
  userId: null,
  name: 'أحمد محمد',
  phone: '0501234567',
  email: 'ahmed@example.com',
  gender: ClientGender.MALE,
  dateOfBirth: new Date('1990-01-01'),
  avatarUrl: null,
  notes: null,
  source: ClientSource.WALK_IN,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Clients handlers', () => {
  let createHandler: CreateClientHandler;
  let updateHandler: UpdateClientHandler;
  let listHandler: ListClientsHandler;
  let getHandler: GetClientHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateClientHandler,
        UpdateClientHandler,
        ListClientsHandler,
        GetClientHandler,
        {
          provide: PrismaService,
          useValue: {
            client: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        { provide: EventBusService, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    createHandler = module.get(CreateClientHandler);
    updateHandler = module.get(UpdateClientHandler);
    listHandler = module.get(ListClientsHandler);
    getHandler = module.get(GetClientHandler);
    prisma = module.get(PrismaService);
  });

  describe('CreateClientHandler', () => {
    it('creates a client successfully', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue(mockClient);

      const result = await createHandler.execute({
        tenantId: 'tenant-1',
        name: 'أحمد محمد',
        phone: '0501234567',
        gender: ClientGender.MALE,
      });

      expect(result.id).toBe('c1');
      expect(prisma.client.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1', name: 'أحمد محمد' }) }),
      );
    });

    it('creates a walk-in client without phone (no uniqueness check)', async () => {
      prisma.client.create.mockResolvedValue({ ...mockClient, phone: null });

      const result = await createHandler.execute({ tenantId: 'tenant-1', name: 'زبون عابر' });

      expect(result.phone).toBeNull();
      expect(prisma.client.findUnique).not.toHaveBeenCalled();
    });

    it('throws ConflictException when phone already registered', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);

      await expect(
        createHandler.execute({ tenantId: 'tenant-1', name: 'آخر', phone: '0501234567' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('UpdateClientHandler', () => {
    it('updates client fields', async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.client.update.mockResolvedValue({ ...mockClient, name: 'محمد أحمد' });

      const result = await updateHandler.execute({ clientId: 'c1', tenantId: 'tenant-1', name: 'محمد أحمد' });

      expect(result.name).toBe('محمد أحمد');
      expect(prisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c1' }, data: expect.objectContaining({ name: 'محمد أحمد' }) }),
      );
    });

    it('throws NotFoundException when client not found', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(updateHandler.execute({ clientId: 'c1', tenantId: 'tenant-1', name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when client belongs to different tenant', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(updateHandler.execute({ clientId: 'c1', tenantId: 'tenant-1' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('ListClientsHandler', () => {
    it('returns paginated clients', async () => {
      prisma.client.findMany.mockResolvedValue([mockClient]);
      prisma.client.count.mockResolvedValue(1);

      const result = await listHandler.execute({ tenantId: 'tenant-1', page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });

    it('applies search filter', async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.count.mockResolvedValue(0);

      await listHandler.execute({ tenantId: 'tenant-1', page: 1, limit: 10, search: 'أحمد' });

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
      );
    });
  });

  describe('GetClientHandler', () => {
    it('returns client by id', async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);

      const result = await getHandler.execute({ clientId: 'c1', tenantId: 'tenant-1' });

      expect(result.id).toBe('c1');
    });

    it('throws NotFoundException when not found', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(getHandler.execute({ clientId: 'c1', tenantId: 'tenant-1' })).rejects.toThrow(NotFoundException);
    });
  });
});
