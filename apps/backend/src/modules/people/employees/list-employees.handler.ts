import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListEmployeesDto } from './list-employees.dto';

export type ListEmployeesQuery = ListEmployeesDto & {
  tenantId: string;
  page: number;
  limit: number;
};

@Injectable()
export class ListEmployeesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListEmployeesQuery) {
    const where = {
      tenantId: query.tenantId,
      isActive: query.isActive,
      gender: query.gender,
      employmentType: query.employmentType,
      onboardingStatus: query.onboardingStatus,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.specialtyId ? { specialties: { some: { specialtyId: query.specialtyId } } } : {}),
      ...(query.branchId ? { branches: { some: { branchId: query.branchId } } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          specialties: true,
          branches: true,
          services: true,
          availability: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }
}
