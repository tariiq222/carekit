import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { ListPublicEmployeesHandler } from './list-public-employees.handler';
import { GetPublicEmployeeHandler } from './get-public-employee.handler';

describe('Public employees handlers', () => {
  let listHandler: ListPublicEmployeesHandler;
  let getHandler: GetPublicEmployeeHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListPublicEmployeesHandler,
        GetPublicEmployeeHandler,
        {
          provide: PrismaService,
          useValue: { employee: { findMany: jest.fn(), findFirst: jest.fn() } },
        },
      ],
    }).compile();

    listHandler = module.get(ListPublicEmployeesHandler);
    getHandler = module.get(GetPublicEmployeeHandler);
    prisma = module.get(PrismaService);
  });

  it('lists only public + active employees', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e1', slug: 'ahmed', nameAr: 'أحمد', nameEn: 'Ahmed', title: null, specialty: null, specialtyAr: null, publicBioAr: null, publicBioEn: null, publicImageUrl: null },
    ]);
    const result = await listHandler.execute();
    expect(result).toHaveLength(1);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublic: true, isActive: true } }),
    );
  });

  it('returns single employee by slug', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1', slug: 'ahmed', nameAr: 'أحمد', nameEn: 'Ahmed', title: null, specialty: null, specialtyAr: null, publicBioAr: null, publicBioEn: null, publicImageUrl: null });
    const result = await getHandler.execute('ahmed');
    expect(result.slug).toBe('ahmed');
  });

  it('throws NotFound when slug missing or not public', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(getHandler.execute('missing')).rejects.toThrow(NotFoundException);
  });
});
