import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface PublicEmployeeItem {
  id: string;
  slug: string | null;
  nameAr: string | null;
  nameEn: string | null;
  title: string | null;
  specialty: string | null;
  specialtyAr: string | null;
  publicBioAr: string | null;
  publicBioEn: string | null;
  publicImageUrl: string | null;
  ratingAverage: number | null;
  ratingCount: number;
}

@Injectable()
export class ListPublicEmployeesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<PublicEmployeeItem[]> {
    const rows = await this.prisma.employee.findMany({
      where: { isPublic: true, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        nameAr: true,
        nameEn: true,
        title: true,
        specialty: true,
        specialtyAr: true,
        publicBioAr: true,
        publicBioEn: true,
        publicImageUrl: true,
      },
    });

    if (rows.length === 0) return [];

    const ratings = await this.prisma.rating.groupBy({
      by: ['employeeId'],
      where: { employeeId: { in: rows.map((r) => r.id) }, isPublic: true },
      _avg: { score: true },
      _count: { _all: true },
    });
    const byEmployee = new Map(
      ratings.map((r) => [r.employeeId, { avg: r._avg.score ?? null, count: r._count._all }]),
    );

    return rows.map((r) => {
      const stat = byEmployee.get(r.id);
      return {
        ...r,
        ratingAverage: stat?.avg ?? null,
        ratingCount: stat?.count ?? 0,
      };
    });
  }
}
