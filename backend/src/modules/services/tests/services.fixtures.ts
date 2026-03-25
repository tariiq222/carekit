/**
 * Shared fixtures and mock factory for ServicesService test suites.
 */

export const mockCategory = {
  id: 'category-uuid-1',
  nameEn: 'General Medicine',
  nameAr: 'الطب العام',
  sortOrder: 1,
  isActive: true,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
};

export const mockCategory2 = {
  id: 'category-uuid-2',
  nameEn: 'Specialized Care',
  nameAr: 'الرعاية المتخصصة',
  sortOrder: 2,
  isActive: true,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
};

export const mockClinicService = {
  id: 'service-uuid-1',
  nameEn: 'General Consultation',
  nameAr: 'استشارة عامة',
  descriptionEn: 'General medical consultation',
  descriptionAr: 'استشارة طبية عامة',
  categoryId: mockCategory.id,
  price: 15000,
  duration: 30,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
  category: mockCategory,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockPrisma(): any {
  return {
    service: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    serviceCategory: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(createMockPrisma())),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockCache(): any {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delPattern: jest.fn().mockResolvedValue(undefined),
  };
}
