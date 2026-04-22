import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpsertSeedDepartmentHandler } from './upsert-seed-department.handler';
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

const mockSeedDepartment = {
  id: 'sd1',
  verticalId: 'v1',
  nameAr: 'قسم الطوارئ',
  nameEn: 'Emergency Department',
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UpsertSeedDepartmentHandler', () => {
  let handler: UpsertSeedDepartmentHandler;
  let prisma: {
    vertical: { findUnique: jest.Mock };
    verticalSeedDepartment: { create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      vertical: { findUnique: jest.fn().mockResolvedValue(mockVertical) },
      verticalSeedDepartment: {
        create: jest.fn().mockResolvedValue(mockSeedDepartment),
        update: jest.fn().mockResolvedValue({ ...mockSeedDepartment, nameEn: 'Updated Dept' }),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        UpsertSeedDepartmentHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(UpsertSeedDepartmentHandler);
  });

  it('creates a new seed department when no id is provided', async () => {
    const result = await handler.execute({
      verticalId: 'v1',
      nameAr: 'قسم الطوارئ',
      nameEn: 'Emergency Department',
    });
    expect(result).toEqual(mockSeedDepartment);
    expect(prisma.verticalSeedDepartment.create).toHaveBeenCalledWith({
      data: {
        verticalId: 'v1',
        nameAr: 'قسم الطوارئ',
        nameEn: 'Emergency Department',
        sortOrder: 0,
      },
    });
    expect(prisma.verticalSeedDepartment.update).not.toHaveBeenCalled();
  });

  it('updates an existing seed department when id is provided', async () => {
    await handler.execute({
      id: 'sd1',
      verticalId: 'v1',
      nameAr: 'قسم الطوارئ',
      nameEn: 'Updated Dept',
    });
    expect(prisma.verticalSeedDepartment.update).toHaveBeenCalledWith({
      where: { id: 'sd1' },
      data: { nameAr: 'قسم الطوارئ', nameEn: 'Updated Dept', sortOrder: 0 },
    });
    expect(prisma.verticalSeedDepartment.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when vertical does not exist', async () => {
    prisma.vertical.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ verticalId: 'nonexistent', nameAr: 'قسم', nameEn: 'Dept' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when updating a non-existent seed department', async () => {
    const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
    prisma.verticalSeedDepartment.update.mockRejectedValue(p2025);
    await expect(
      handler.execute({ id: 'bad-id', verticalId: 'v1', nameAr: 'قسم', nameEn: 'Dept' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('defaults sortOrder to 0 when not provided', async () => {
    await handler.execute({ verticalId: 'v1', nameAr: 'قسم', nameEn: 'Dept' });
    const callData = prisma.verticalSeedDepartment.create.mock.calls[0][0].data;
    expect(callData.sortOrder).toBe(0);
  });
});
