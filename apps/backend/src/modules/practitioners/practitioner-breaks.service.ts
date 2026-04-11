import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SetBreaksDto } from './dto/set-breaks.dto.js';
import { checkOwnership } from '../../common/helpers/ownership.helper.js';
import { ensurePractitionerExists } from '../../common/helpers/practitioner.helper.js';
import { timeSlotsOverlap } from '../../common/helpers/booking-time.helper.js';

const TIME_REGEX = /^\d{2}:\d{2}$/;

@Injectable()
export class PractitionerBreaksService {
  constructor(private readonly prisma: PrismaService) {}

  async getBreaks(practitionerId: string) {
    await ensurePractitionerExists(this.prisma, practitionerId);

    return this.prisma.practitionerBreak.findMany({
      where: { practitionerId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async setBreaks(
    practitionerId: string,
    dto: SetBreaksDto,
    currentUserId?: string,
  ) {
    const practitioner = await ensurePractitionerExists(
      this.prisma,
      practitionerId,
    );

    if (currentUserId) {
      await checkOwnership(this.prisma, practitioner.userId, currentUserId);
    }

    this.validateBreakSlots(dto.breaks);
    this.checkOverlappingBreaks(dto.breaks);
    await this.validateBreaksInsideAvailability(practitionerId, dto.breaks);

    // Atomically replace: delete all then create new ones
    return this.prisma.$transaction(async (tx) => {
      await tx.practitionerBreak.deleteMany({ where: { practitionerId } });

      if (dto.breaks.length === 0) return [];

      await tx.practitionerBreak.createMany({
        data: dto.breaks.map((b) => ({
          practitionerId,
          dayOfWeek: b.dayOfWeek,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      });

      return tx.practitionerBreak.findMany({
        where: { practitionerId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });
  }

  // --- Private helpers ---

  private async validateBreaksInsideAvailability(
    practitionerId: string,
    breaks: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ) {
    const availabilities = await this.prisma.practitionerAvailability.findMany({
      where: { practitionerId, isActive: true },
    });

    for (const brk of breaks) {
      const dayWindows = availabilities.filter(
        (a) => a.dayOfWeek === brk.dayOfWeek,
      );
      const insideWindow = dayWindows.some(
        (a) => a.startTime <= brk.startTime && a.endTime >= brk.endTime,
      );
      if (!insideWindow) {
        throw new BadRequestException({
          statusCode: 400,
          message: `Break ${brk.startTime}–${brk.endTime} on day ${brk.dayOfWeek} is outside working hours`,
          error: 'BREAK_OUTSIDE_AVAILABILITY',
        });
      }
    }
  }

  private validateBreakSlots(
    breaks: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ) {
    for (const slot of breaks) {
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'dayOfWeek must be between 0 and 6',
          error: 'VALIDATION_ERROR',
        });
      }

      if (!TIME_REGEX.test(slot.startTime) || !TIME_REGEX.test(slot.endTime)) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Time must be in HH:mm format',
          error: 'VALIDATION_ERROR',
        });
      }

      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'startTime must be before endTime',
          error: 'VALIDATION_ERROR',
        });
      }
    }
  }

  private checkOverlappingBreaks(
    breaks: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ) {
    const byDay = new Map<
      number,
      Array<{ startTime: string; endTime: string }>
    >();
    for (const slot of breaks) {
      const daySlots = byDay.get(slot.dayOfWeek) ?? [];
      for (const existing of daySlots) {
        if (
          timeSlotsOverlap(
            slot.startTime,
            slot.endTime,
            existing.startTime,
            existing.endTime,
          )
        ) {
          throw new BadRequestException({
            statusCode: 400,
            message: 'Overlapping break periods on the same day',
            error: 'VALIDATION_ERROR',
          });
        }
      }
      daySlots.push({ startTime: slot.startTime, endTime: slot.endTime });
      byDay.set(slot.dayOfWeek, daySlots);
    }
  }
}
