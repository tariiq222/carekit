import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SeedOrganizationFromVerticalHandler } from './seed-organization-from-vertical.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TemplateFamily } from '@prisma/client';

const mockSeedDepts = [
  { id: 'sd1', verticalId: 'v1', nameAr: 'قسم 1', nameEn: 'Dept 1', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sd2', verticalId: 'v1', nameAr: 'قسم 2', nameEn: 'Dept 2', sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
];

const mockSeedCats = [
  { id: 'sc1', verticalId: 'v1', departmentId: null, nameAr: 'فئة 1', nameEn: 'Cat 1', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sc2', verticalId: 'v1', departmentId: null, nameAr: 'فئة 2', nameEn: 'Cat 2', sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
];

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
  seedDepartments: mockSeedDepts,
  seedServiceCategories: mockSeedCats,
};

describe('SeedOrganizationFromVerticalHandler', () => {
  let handler: SeedOrganizationFromVerticalHandler;
  let prisma: {
    vertical: { findFirst: jest.Mock };
    department: { count: jest.Mock };
    $transaction: jest.Mock;
  };
  let txMock: {
    department: { create: jest.Mock };
    serviceCategory: { create: jest.Mock };
    organization: { update: jest.Mock };
  };

  beforeEach(async () => {
    txMock = {
      department: { create: jest.fn().mockResolvedValue({}) },
      serviceCategory: { create: jest.fn().mockResolvedValue({}) },
      organization: { update: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      vertical: { findFirst: jest.fn().mockResolvedValue(mockVertical) },
      department: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
    };

    const module = await Test.createTestingModule({
      providers: [
        SeedOrganizationFromVerticalHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(SeedOrganizationFromVerticalHandler);
  });

  describe('happy path', () => {
    it('returns verticalId, seededDepartments, and seededCategories', async () => {
      const result = await handler.execute({ organizationId: 'org1', verticalSlug: 'medical' });
      expect(result).toEqual({
        verticalId: 'v1',
        seededDepartments: 2,
        seededCategories: 2,
      });
    });

    it('calls tx.department.create twice with explicit organizationId (Lesson 11)', async () => {
      await handler.execute({ organizationId: 'org1', verticalSlug: 'medical' });
      expect(txMock.department.create).toHaveBeenCalledTimes(2);
      for (const call of txMock.department.create.mock.calls) {
        expect(call[0].data).toHaveProperty('organizationId', 'org1');
      }
    });

    it('calls tx.serviceCategory.create twice with explicit organizationId (Lesson 11)', async () => {
      await handler.execute({ organizationId: 'org1', verticalSlug: 'medical' });
      expect(txMock.serviceCategory.create).toHaveBeenCalledTimes(2);
      for (const call of txMock.serviceCategory.create.mock.calls) {
        expect(call[0].data).toHaveProperty('organizationId', 'org1');
      }
    });

    it('calls tx.organization.update once with verticalId', async () => {
      await handler.execute({ organizationId: 'org1', verticalSlug: 'medical' });
      expect(txMock.organization.update).toHaveBeenCalledTimes(1);
      expect(txMock.organization.update).toHaveBeenCalledWith({
        where: { id: 'org1' },
        data: { verticalId: 'v1' },
      });
    });

    it('seeds departments with correct field values from seed rows', async () => {
      await handler.execute({ organizationId: 'org1', verticalSlug: 'medical' });
      expect(txMock.department.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({ nameAr: 'قسم 1', nameEn: 'Dept 1', sortOrder: 0 }),
      });
      expect(txMock.department.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({ nameAr: 'قسم 2', nameEn: 'Dept 2', sortOrder: 1 }),
      });
    });

    it('seeds categories with correct field values from seed rows', async () => {
      await handler.execute({ organizationId: 'org1', verticalSlug: 'medical' });
      expect(txMock.serviceCategory.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({ nameAr: 'فئة 1', nameEn: 'Cat 1', sortOrder: 0 }),
      });
      expect(txMock.serviceCategory.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({ nameAr: 'فئة 2', nameEn: 'Cat 2', sortOrder: 1 }),
      });
    });
  });

  describe('idempotency', () => {
    it('returns { skipped: true, reason: "already-seeded" } when org already has departments', async () => {
      prisma.department.count.mockResolvedValue(3);
      const result = await handler.execute({ organizationId: 'org1', verticalSlug: 'medical' });
      expect(result).toEqual({ skipped: true, reason: 'already-seeded' });
    });

    it('does not run the transaction when departments already exist', async () => {
      prisma.department.count.mockResolvedValue(1);
      await handler.execute({ organizationId: 'org1', verticalSlug: 'medical' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('not found', () => {
    it('throws NotFoundException when vertical slug does not exist or is inactive', async () => {
      prisma.vertical.findFirst.mockResolvedValue(null);
      await expect(
        handler.execute({ organizationId: 'org1', verticalSlug: 'unknown' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('includes the slug in the NotFoundException message', async () => {
      prisma.vertical.findFirst.mockResolvedValue(null);
      await expect(
        handler.execute({ organizationId: 'org1', verticalSlug: 'unknown' }),
      ).rejects.toThrow("Vertical 'unknown' not found");
    });

    it('does not check department count when vertical is not found', async () => {
      prisma.vertical.findFirst.mockResolvedValue(null);
      await expect(
        handler.execute({ organizationId: 'org1', verticalSlug: 'unknown' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.department.count).not.toHaveBeenCalled();
    });
  });

  describe('Lesson-11 explicit organizationId assertion', () => {
    it('every tx.department.create call data object contains organizationId field', async () => {
      await handler.execute({ organizationId: 'org-abc', verticalSlug: 'medical' });
      for (const call of txMock.department.create.mock.calls) {
        const data: Record<string, unknown> = call[0].data;
        expect(data).toHaveProperty('organizationId');
        expect(data['organizationId']).toBe('org-abc');
      }
    });

    it('every tx.serviceCategory.create call data object contains organizationId field', async () => {
      await handler.execute({ organizationId: 'org-abc', verticalSlug: 'medical' });
      for (const call of txMock.serviceCategory.create.mock.calls) {
        const data: Record<string, unknown> = call[0].data;
        expect(data).toHaveProperty('organizationId');
        expect(data['organizationId']).toBe('org-abc');
      }
    });
  });
});
