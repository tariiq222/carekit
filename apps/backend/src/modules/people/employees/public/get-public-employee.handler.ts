import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import type { PublicEmployeeItem } from './list-public-employees.handler';

@Injectable()
export class GetPublicEmployeeHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(slug: string): Promise<PublicEmployeeItem> {
    const row = await this.prisma.employee.findFirst({
      where: { slug, isPublic: true, isActive: true },
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
    if (!row) throw new NotFoundException('Employee not found');
    return row;
  }
}
