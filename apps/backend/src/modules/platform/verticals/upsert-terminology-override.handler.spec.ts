import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpsertTerminologyOverrideHandler } from './upsert-terminology-override.handler';
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

const mockOverride = {
  id: 'o1',
  verticalId: 'v1',
  tokenKey: 'client',
  valueAr: 'مريض',
  valueEn: 'Patient',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UpsertTerminologyOverrideHandler', () => {
  let handler: UpsertTerminologyOverrideHandler;
  let prisma: {
    vertical: { findUnique: jest.Mock };
    verticalTerminologyOverride: { upsert: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      vertical: { findUnique: jest.fn().mockResolvedValue(mockVertical) },
      verticalTerminologyOverride: { upsert: jest.fn().mockResolvedValue(mockOverride) },
    };
    const module = await Test.createTestingModule({
      providers: [
        UpsertTerminologyOverrideHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(UpsertTerminologyOverrideHandler);
  });

  it('upserts a terminology override and returns the row', async () => {
    const result = await handler.execute({
      verticalId: 'v1',
      tokenKey: 'client',
      valueAr: 'مريض',
      valueEn: 'Patient',
    });
    expect(result).toEqual(mockOverride);
    expect(prisma.verticalTerminologyOverride.upsert).toHaveBeenCalledWith({
      where: { verticalId_tokenKey: { verticalId: 'v1', tokenKey: 'client' } },
      create: { verticalId: 'v1', tokenKey: 'client', valueAr: 'مريض', valueEn: 'Patient' },
      update: { valueAr: 'مريض', valueEn: 'Patient' },
    });
  });

  it('verifies the vertical exists before upserting', async () => {
    await handler.execute({ verticalId: 'v1', tokenKey: 'client', valueAr: 'مريض', valueEn: 'Patient' });
    expect(prisma.vertical.findUnique).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  it('throws NotFoundException when vertical does not exist', async () => {
    prisma.vertical.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ verticalId: 'nonexistent', tokenKey: 'client', valueAr: 'مريض', valueEn: 'Patient' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not call upsert when vertical is not found', async () => {
    prisma.vertical.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ verticalId: 'nonexistent', tokenKey: 'client', valueAr: 'مريض', valueEn: 'Patient' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.verticalTerminologyOverride.upsert).not.toHaveBeenCalled();
  });
});
