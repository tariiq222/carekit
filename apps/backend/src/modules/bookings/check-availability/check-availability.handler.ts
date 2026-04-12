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

function parseHHmm(hhmm: string, anchor: Date): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(anchor);
  d.setHours(h, m, 0, 0);
  return d;
}

function intersectWindows(
  a: [Date, Date],
  b: [Date, Date],
): [Date, Date] | null {
  const start = a[0] > b[0] ? a[0] : b[0];
  const end = a[1] < b[1] ? a[1] : b[1];
  return start < end ? [start, end] : null;
}

@Injectable()
export class CheckAvailabilityHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: CheckAvailabilityQuery): Promise<AvailableSlot[]> {
    const dateOnly = new Date(query.date);
    dateOnly.setHours(0, 0, 0, 0);
    const dayOfWeek = dateOnly.getDay();

    const [businessHour, holiday, shifts, exception] = await Promise.all([
      this.prisma.businessHour.findUnique({
        where: { branchId_dayOfWeek: { branchId: query.branchId, dayOfWeek } },
      }),
      this.prisma.holiday.findFirst({
        where: { branchId: query.branchId, date: dateOnly },
      }),
      this.prisma.employeeAvailability.findMany({
        where: { employeeId: query.employeeId, dayOfWeek, isActive: true },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.employeeAvailabilityException.findFirst({
        where: {
          employeeId: query.employeeId,
          startDate: { lte: dateOnly },
          endDate: { gte: dateOnly },
        },
      }),
    ]);

    if (!businessHour || !businessHour.isOpen) return [];
    if (holiday) return [];
    if (exception) return [];
    if (shifts.length === 0) return [];

    const branchWindow: [Date, Date] = [
      parseHHmm(businessHour.startTime, dateOnly),
      parseHHmm(businessHour.endTime, dateOnly),
    ];

    const windows: [Date, Date][] = [];
    for (const shift of shifts) {
      const shiftWindow: [Date, Date] = [
        parseHHmm(shift.startTime, dateOnly),
        parseHHmm(shift.endTime, dateOnly),
      ];
      const intersection = intersectWindows(shiftWindow, branchWindow);
      if (intersection) windows.push(intersection);
    }

    if (windows.length === 0) return [];

    const earliestStart = windows[0][0];
    const latestEnd = windows[windows.length - 1][1];

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        tenantId: query.tenantId,
        employeeId: query.employeeId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { gte: earliestStart, lt: latestEnd },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const now = new Date();
    const slots: AvailableSlot[] = [];

    for (const [windowStart, windowEnd] of windows) {
      let cursor = new Date(windowStart);
      while (cursor.getTime() + query.durationMins * 60_000 <= windowEnd.getTime()) {
        const slotEnd = new Date(cursor.getTime() + query.durationMins * 60_000);

        const hasConflict = existingBookings.some((b) => {
          const bEnd = new Date(b.scheduledAt.getTime() + b.durationMins * 60_000);
          return b.scheduledAt < slotEnd && bEnd > cursor;
        });

        if (!hasConflict && cursor > now) {
          slots.push({ startTime: new Date(cursor), endTime: slotEnd });
        }

        cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MINS * 60_000);
      }
    }

    return slots;
  }
}
