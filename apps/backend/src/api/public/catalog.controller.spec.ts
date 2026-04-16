import { PublicCatalogController } from './catalog.controller';

interface PrismaStub {
  department: { findMany: jest.Mock };
  serviceCategory: { findMany: jest.Mock };
  service: { findMany: jest.Mock };
}

function buildController() {
  const prisma: PrismaStub = {
    department: { findMany: jest.fn() },
    serviceCategory: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
  };
  const controller = new PublicCatalogController(prisma as never);
  return { controller, prisma };
}

describe('PublicCatalogController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getCatalog', () => {
    it('queries departments, categories, and services', async () => {
      const { controller, prisma } = buildController();
      const departments = [{ id: 'd-1', nameAr: 'Dept 1' }];
      const categories = [{ id: 'c-1', nameAr: 'Cat 1' }];
      const services = [{ id: 's-1', nameAr: 'Service 1' }];

      (prisma.department.findMany as jest.Mock).mockResolvedValue(departments);
      (prisma.serviceCategory.findMany as jest.Mock).mockResolvedValue(categories);
      (prisma.service.findMany as jest.Mock).mockResolvedValue(services);

      const result = await controller.getCatalog();

      expect(prisma.department.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { isActive: true, archivedAt: null },
        include: {
          durationOptions: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { nameAr: 'asc' },
      });
      expect(result).toEqual({ departments, categories, services });
    });

    it('returns empty arrays when no data exists', async () => {
      const { controller, prisma } = buildController();
      (prisma.department.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.serviceCategory.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.service.findMany as jest.Mock).mockResolvedValue([]);

      const result = await controller.getCatalog();

      expect(result).toEqual({ departments: [], categories: [], services: [] });
    });
  });
});
