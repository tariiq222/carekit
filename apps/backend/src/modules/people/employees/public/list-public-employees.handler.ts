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
    return rows;
  }
}
