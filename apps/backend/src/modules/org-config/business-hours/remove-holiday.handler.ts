import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
export type RemoveHolidayCommand = { tenantId: string; holidayId: string };

@Injectable()
export class RemoveHolidayHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: RemoveHolidayCommand) {
    const holiday = await this.prisma.holiday.findFirst({
      where: { id: dto.holidayId, tenantId: dto.tenantId },
    });
    if (!holiday) throw new NotFoundException('Holiday not found');

    await this.prisma.holiday.delete({ where: { id: dto.holidayId } });
    return { deleted: true };
  }
}
