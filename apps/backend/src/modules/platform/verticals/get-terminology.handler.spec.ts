import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetTerminologyHandler } from './get-terminology.handler';
import { PrismaService } from '../../../infrastructure/database';
import { BASE_PACKS } from '@deqah/shared/terminology';

const mockVerticalBase = {
  id: 'v1',
  slug: 'medical',
  nameAr: 'طبي',
  nameEn: 'Medical',
  templateFamily: 'MEDICAL' as const,
  descriptionAr: null,
  descriptionEn: null,
  iconUrl: null,
  sortOrder: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  terminologyOverrides: [],
};

describe('GetTerminologyHandler', () => {
  let handler: GetTerminologyHandler;
  let prisma: { vertical: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      vertical: { findFirst: jest.fn().mockResolvedValue(mockVerticalBase) },
    };
    const module = await Test.createTestingModule({
      providers: [
        GetTerminologyHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(GetTerminologyHandler);
  });

  it('returns the base pack untouched when no overrides exist', async () => {
    const result = await handler.execute({ verticalSlug: 'medical' });
    expect(result).toEqual(BASE_PACKS['MEDICAL']);
  });

  it('overrides replace base tokens for matching keys', async () => {
    const override = {
      id: 'o1',
      verticalId: 'v1',
      tokenKey: 'client.singular',
      valueAr: 'زبون',
      valueEn: 'Client',
    };
    prisma.vertical.findFirst.mockResolvedValue({
      ...mockVerticalBase,
      terminologyOverrides: [override],
    });
    const result = await handler.execute({ verticalSlug: 'medical' });
    expect(result['client.singular']).toEqual({ ar: 'زبون', en: 'Client' });
  });

  it('preserves unrelated keys from base pack when overrides are applied', async () => {
    const override = {
      id: 'o1',
      verticalId: 'v1',
      tokenKey: 'client.singular',
      valueAr: 'زبون',
      valueEn: 'Client',
    };
    prisma.vertical.findFirst.mockResolvedValue({
      ...mockVerticalBase,
      terminologyOverrides: [override],
    });
    const result = await handler.execute({ verticalSlug: 'medical' });
    // Other keys from the base pack should remain unchanged
    expect(result['employee.singular']).toEqual(BASE_PACKS['MEDICAL']['employee.singular']);
    expect(result['branch.singular']).toEqual(BASE_PACKS['MEDICAL']['branch.singular']);
  });

  it('throws NotFoundException when slug does not exist', async () => {
    prisma.vertical.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ verticalSlug: 'nonexistent' })).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException with descriptive message when slug not found', async () => {
    prisma.vertical.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ verticalSlug: 'ghost' })).rejects.toThrow(
      "Vertical 'ghost' not found",
    );
  });
});
