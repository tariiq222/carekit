import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpsertSeedServiceCategoryHandler } from './upsert-seed-service-category.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TemplateFamily } from '@prisma/client';

const mockVertical = {
  id: 'v1',
  slug: 'medical',
  nameAr: 'طبي',
  nameEn: 'Medical',
  templateFamily: TemplateFamily.MEDICAL,
  descriptionAr: null,
  descriptionEn: null,
  iconUrl: null,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSeedCategory = {
  id: 'sc1',
  verticalId: 'v1',
  departmentId: null,
  nameAr: 'خدمات الطوارئ',
  nameEn: 'Emergency Services',
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UpsertSeedServiceCategoryHandler', () => {
  let handler: UpsertSeedServiceCategoryHandler;
  let prisma: {
    vertical: { findUnique: jest.Mock };
    verticalSeedServiceCategory: { create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      vertical: { findUnique: jest.fn().mockResolvedValue(mockVertical) },
      verticalSeedServiceCategory: {
        create: jest.fn().mockResolvedValue(mockSeedCategory),
        update: jest.fn().mockResolvedValue({ ...mockSeedCategory, nameEn: 'Updated Category' }),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        UpsertSeedServiceCategoryHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(UpsertSeedServiceCategoryHandler);
  });

  it('creates a new seed category when no id is provided', async () => {
    const result = await handler.execute({
      verticalId: 'v1',
      nameAr: 'خدمات الطوارئ',
      nameEn: 'Emergency Services',
    });
    expect(result).toEqual(mockSeedCategory);
    expect(prisma.verticalSeedServiceCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        verticalId: 'v1',
        nameAr: 'خدمات الطوارئ',
        nameEn: 'Emergency Services',
        sortOrder: 0,
      }),
    });
    expect(prisma.verticalSeedServiceCategory.update).not.toHaveBeenCalled();
  });

  it('updates an existing seed category when id is provided', async () => {
    await handler.execute({
      id: 'sc1',
      verticalId: 'v1',
      nameAr: 'خدمات الطوارئ',
      nameEn: 'Updated Category',
    });
    expect(prisma.verticalSeedServiceCategory.update).toHaveBeenCalledWith({
      where: { id: 'sc1' },
      data: expect.objectContaining({ nameAr: 'خدمات الطوارئ', nameEn: 'Updated Category', sortOrder: 0 }),
    });
    expect(prisma.verticalSeedServiceCategory.create).not.toHaveBeenCalled();
  });

  it('includes departmentId when provided on create', async () => {
    await handler.execute({
      verticalId: 'v1',
      nameAr: 'خدمات',
      nameEn: 'Services',
      departmentId: 'dept1',
    });
    const callData = prisma.verticalSeedServiceCategory.create.mock.calls[0][0].data;
    expect(callData.departmentId).toBe('dept1');
  });

  it('includes departmentId when provided on update', async () => {
    await handler.execute({
      id: 'sc1',
      verticalId: 'v1',
      nameAr: 'خدمات',
      nameEn: 'Services',
      departmentId: 'dept1',
    });
    const callData = prisma.verticalSeedServiceCategory.update.mock.calls[0][0].data;
    expect(callData.departmentId).toBe('dept1');
  });

  it('throws NotFoundException when vertical does not exist', async () => {
    prisma.vertical.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ verticalId: 'nonexistent', nameAr: 'فئة', nameEn: 'Cat' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when updating a non-existent seed category', async () => {
    const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
    prisma.verticalSeedServiceCategory.update.mockRejectedValue(p2025);
    await expect(
      handler.execute({ id: 'bad-id', verticalId: 'v1', nameAr: 'فئة', nameEn: 'Cat' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('defaults sortOrder to 0 when not provided', async () => {
    await handler.execute({ verticalId: 'v1', nameAr: 'فئة', nameEn: 'Cat' });
    const callData = prisma.verticalSeedServiceCategory.create.mock.calls[0][0].data;
    expect(callData.sortOrder).toBe(0);
  });
});
