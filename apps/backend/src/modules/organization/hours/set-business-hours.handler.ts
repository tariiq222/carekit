import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { SetBusinessHoursDto } from './hours.dto';

@Injectable()
export class SetBusinessHoursHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: SetBusinessHoursDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId: dto.tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    for (const slot of dto.schedule) {
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        throw new BadRequestException(`Invalid dayOfWeek: ${slot.dayOfWeek}`);
      }
    }

    // Upsert each day in a transaction
    await this.prisma.$transaction(
      dto.schedule.map((slot) =>
        this.prisma.businessHour.upsert({
          where: { branchId_dayOfWeek: { branchId: dto.branchId, dayOfWeek: slot.dayOfWeek } },
          create: {
            tenantId: dto.tenantId,
            branchId: dto.branchId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isOpen: slot.isOpen,
          },
          update: {
            startTime: slot.startTime,
            endTime: slot.endTime,
            isOpen: slot.isOpen,
          },
        }),
      ),
    );

    return this.prisma.businessHour.findMany({
      where: { branchId: dto.branchId, tenantId: dto.tenantId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }
}
