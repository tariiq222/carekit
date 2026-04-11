import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface CheckAvailabilityQuery {
  tenantId: string;
  employeeId: string;
  branchId: string;
  date: Date;
  durationMins: number;
}

export interface AvailableSlot {
  startTime: Date;
  endTime: Date;
}

const SLOT_INTERVAL_MINS = 30;

@Injectable()
export class CheckAvailabilityHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: CheckAvailabilityQuery): Promise<AvailableSlot[]> {
    const date = new Date(query.date);
    const dayOfWeek = date.getDay();

    const businessHour = await this.prisma.businessHour.findUnique({
      where: { branchId_dayOfWeek: { branchId: query.branchId, dayOfWeek } },
    });

    if (!businessHour || !businessHour.isOpen) return [];

    const [openH, openM] = businessHour.startTime.split(':').map(Number);
    const [closeH, closeM] = businessHour.endTime.split(':').map(Number);

    const dayStart = new Date(date);
    dayStart.setHours(openH, openM, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(closeH, closeM, 0, 0);

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        tenantId: query.tenantId,
        employeeId: query.employeeId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const slots: AvailableSlot[] = [];
    let cursor = new Date(dayStart);

    while (cursor.getTime() + query.durationMins * 60_000 <= dayEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + query.durationMins * 60_000);

      const hasConflict = existingBookings.some((b) => {
        const bEnd = new Date(b.scheduledAt.getTime() + b.durationMins * 60_000);
        return b.scheduledAt < slotEnd && bEnd > cursor;
      });

      if (!hasConflict && cursor > new Date()) {
        slots.push({ startTime: new Date(cursor), endTime: slotEnd });
      }

      cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MINS * 60_000);
    }

    return slots;
  }
}
