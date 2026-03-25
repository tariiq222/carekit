import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ClinicWorkingHours } from '@prisma/client';
import { CacheService } from '../../common/services/cache.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { SetWorkingHoursDto } from './dto/set-working-hours.dto.js';

const CACHE_KEY = 'clinic:working-hours';
const CACHE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class ClinicHoursService {
  private readonly logger = new Logger(ClinicHoursService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async getAll(): Promise<ClinicWorkingHours[]> {
    const cached = await this.cacheService.get<ClinicWorkingHours[]>(CACHE_KEY);
    if (cached) return cached;

    const hours = await this.prisma.clinicWorkingHours.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });

    await this.cacheService.set(CACHE_KEY, hours, CACHE_TTL_SECONDS);
    return hours;
  }

  async setHours(dto: SetWorkingHoursDto): Promise<ClinicWorkingHours[]> {
    this.validateSlots(dto.hours);

    // Replace all hours atomically
    await this.prisma.$transaction([
      this.prisma.clinicWorkingHours.deleteMany(),
      this.prisma.clinicWorkingHours.createMany({
        data: dto.hours.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: slot.isActive,
        })),
      }),
    ]);

    await this.cacheService.del(CACHE_KEY);

    return this.prisma.clinicWorkingHours.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async getForDay(dayOfWeek: number): Promise<ClinicWorkingHours | null> {
    return this.prisma.clinicWorkingHours.findUnique({
      where: { dayOfWeek },
    });
  }

  /**
   * Check if the clinic is open during a given time window on a given day.
   */
  isClinicOpen(
    clinicHours: ClinicWorkingHours[],
    dayOfWeek: number,
    startTime: string,
    endTime: string,
  ): boolean {
    const dayHours = clinicHours.filter(
      (h) => h.dayOfWeek === dayOfWeek && h.isActive,
    );

    if (dayHours.length === 0) return false;

    const startMin = this.toMinutes(startTime);
    const endMin = this.toMinutes(endTime);

    return dayHours.some(
      (h) =>
        this.toMinutes(h.startTime) <= startMin &&
        this.toMinutes(h.endTime) >= endMin,
    );
  }

  // --- Private helpers ---

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private validateSlots(
    slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ): void {
    for (const slot of slots) {
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'startTime must be before endTime',
          error: 'VALIDATION_ERROR',
        });
      }
    }
  }
}
