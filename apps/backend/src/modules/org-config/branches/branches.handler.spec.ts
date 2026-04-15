import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateBranchHandler } from './create-branch.handler';
import { UpdateBranchHandler } from './update-branch.handler';
import { ListBranchesHandler } from './list-branches.handler';
import { GetBranchHandler } from './get-branch.handler';

const mockBranch = {
  id: 'branch-1',
  tenantId: 'tenant-1',
  nameAr: 'الفرع الرئيسي',
  nameEn: 'Main Branch',
  phone: null,
  addressAr: null,
  addressEn: null,
  city: null,
  country: 'SA',
  latitude: null,
  longitude: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  businessHours: [],
  holidays: [],
};

const buildPrisma = (overrides: Record<string, unknown> = {}) => {
  const branchMethods = {
    findFirst: jest.fn(),
    create: jest.fn().mockResolvedValue(mockBranch),
    update: jest.fn().mockResolvedValue(mockBranch),
    findMany: jest.fn().mockResolvedValue([mockBranch]),
    count: jest.fn().mockResolvedValue(1),
  };
  return {
    branch: branchMethods,
    // Supports both array form (list/count) and interactive callback form (create/update)
    $transaction: jest.fn((opsOrFn: unknown) => {
      if (typeof opsOrFn === 'function') {
        // Interactive transaction: call callback with a tx proxy that delegates to branchMethods
        const tx = { branch: branchMethods };
        return opsOrFn(tx);
      }
      return Promise.all(opsOrFn as Promise<unknown>[]);
    }),
    ...overrides,
  };
};

describe('CreateBranchHandler', () => {
  it('creates branch when name is unique', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new CreateBranchHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', nameAr: 'الفرع الرئيسي' });
    expect(result.id).toBe('branch-1');
  });

  it('throws ConflictException when name already exists', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(mockBranch);
    const handler = new CreateBranchHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-1', nameAr: 'الفرع الرئيسي' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('UpdateBranchHandler', () => {
  it('updates branch when found', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(mockBranch);
    const handler = new UpdateBranchHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1', city: 'Riyadh' });
    expect(result).toEqual(mockBranch);
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new UpdateBranchHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-1', branchId: 'missing', city: 'Riyadh' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ListBranchesHandler', () => {
  it('returns paginated branches', async () => {
    const prisma = buildPrisma();
    const handler = new ListBranchesHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1' });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});

describe('GetBranchHandler', () => {
  it('returns branch with hours and holidays', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(mockBranch);
    const handler = new GetBranchHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });
    expect(result.id).toBe('branch-1');
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new GetBranchHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-1', branchId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });
});
