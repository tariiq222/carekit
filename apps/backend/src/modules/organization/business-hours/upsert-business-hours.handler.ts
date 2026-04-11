import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UpsertBusinessHoursCommand {
  tenantId: string;
  branchId: string;
  hours: { dayOfWeek: number; startTime: string; endTime: string; isOpen: boolean }[];
}

const TIME_RE = /^\d{2}:\d{2}$/;

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class UpsertBusinessHoursHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertBusinessHoursCommand) {
    const seen = new Set<number>();
    for (const h of cmd.hours) {
      if (h.dayOfWeek < 0 || h.dayOfWeek > 6) {
        throw new BadRequestException(`Invalid dayOfWeek: ${h.dayOfWeek}`);
      }
      if (!TIME_RE.test(h.startTime) || !TIME_RE.test(h.endTime)) {
        throw new BadRequestException('startTime and endTime must match HH:mm');
      }
      if (h.isOpen && toMinutes(h.startTime) >= toMinutes(h.endTime)) {
        throw new BadRequestException('startTime must be before endTime when isOpen is true');
      }
      if (seen.has(h.dayOfWeek)) {
        throw new BadRequestException(`Duplicate dayOfWeek: ${h.dayOfWeek}`);
      }
      seen.add(h.dayOfWeek);
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: cmd.branchId, tenantId: cmd.tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.businessHour.deleteMany({ where: { branchId: cmd.branchId } });
      await tx.businessHour.createMany({
        data: cmd.hours.map((h) => ({
          tenantId: cmd.tenantId,
          branchId: cmd.branchId,
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
          isOpen: h.isOpen,
        })),
      });
    });

    return this.prisma.businessHour.findMany({
      where: { branchId: cmd.branchId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }
}
