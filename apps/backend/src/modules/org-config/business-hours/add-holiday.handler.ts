import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { AddHolidayDto } from './hours.dto';

@Injectable()
export class AddHolidayHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: AddHolidayDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId: dto.tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const date = new Date(dto.date);
    const existing = await this.prisma.holiday.findUnique({
      where: { branchId_date: { branchId: dto.branchId, date } },
    });
    if (existing) throw new ConflictException('Holiday already exists for this date');

    return this.prisma.holiday.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        date,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
      },
    });
  }
}
