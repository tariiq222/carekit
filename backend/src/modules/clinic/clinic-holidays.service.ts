import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClinicHoliday } from '@prisma/client';
import { CacheService } from '../../common/services/cache.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateHolidayDto } from './dto/create-holiday.dto.js';

const CACHE_KEY_PREFIX = 'clinic:holidays';
const CACHE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class ClinicHolidaysService {
  private readonly logger = new Logger(ClinicHolidaysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async findAll(year?: number): Promise<ClinicHoliday[]> {
    const cacheKey = year
      ? `${CACHE_KEY_PREFIX}:${year}`
      : `${CACHE_KEY_PREFIX}:all`;

    const cached = await this.cacheService.get<ClinicHoliday[]>(cacheKey);
    if (cached) return cached;

    const where = year
      ? {
          date: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1)),
          },
        }
      : {};

    const holidays = await this.prisma.clinicHoliday.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    await this.cacheService.set(cacheKey, holidays, CACHE_TTL_SECONDS);
    return holidays;
  }

  async create(dto: CreateHolidayDto): Promise<ClinicHoliday> {
    const holiday = await this.prisma.clinicHoliday.create({
      data: {
        date: new Date(dto.date),
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        isRecurring: dto.isRecurring ?? false,
      },
    });

    await this.invalidateCache();
    return holiday;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.clinicHoliday.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Holiday not found',
        error: 'NOT_FOUND',
      });
    }

    await this.prisma.clinicHoliday.delete({ where: { id } });
    await this.invalidateCache();
  }

  /**
   * Check if a given date falls on a holiday (exact match or recurring match).
   */
  async isHoliday(date: Date): Promise<boolean> {
    const holidays = await this.findAll();
    const normalizedDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );

    return holidays.some((h) => {
      const hDate = new Date(h.date);
      if (h.isRecurring) {
        return (
          hDate.getUTCMonth() === normalizedDate.getUTCMonth() &&
          hDate.getUTCDate() === normalizedDate.getUTCDate()
        );
      }
      const hNorm = new Date(
        Date.UTC(hDate.getFullYear(), hDate.getMonth(), hDate.getDate()),
      );
      return hNorm.getTime() === normalizedDate.getTime();
    });
  }

  // --- Private helpers ---

  private async invalidateCache(): Promise<void> {
    await this.cacheService.delPattern(`${CACHE_KEY_PREFIX}:*`);
  }
}
