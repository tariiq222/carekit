import { Injectable, Logger } from '@nestjs/common';
import { BookingSettings } from '@prisma/client';
import { CacheService } from '../../common/services/cache.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { UpdateBookingSettingsDto } from './dto/update-booking-settings.dto.js';

const CACHE_KEY = 'booking:settings';
const CACHE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class BookingSettingsService {
  private readonly logger = new Logger(BookingSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async get(): Promise<BookingSettings> {
    const cached = await this.cacheService.get<BookingSettings>(CACHE_KEY);
    if (cached) return cached;

    const settings = await this.prisma.bookingSettings.findFirst();
    if (!settings) {
      this.logger.warn('No BookingSettings found, creating defaults');
      const created = await this.prisma.bookingSettings.create({ data: {} });
      await this.cacheService.set(CACHE_KEY, created, CACHE_TTL_SECONDS);
      return created;
    }

    await this.cacheService.set(CACHE_KEY, settings, CACHE_TTL_SECONDS);
    return settings;
  }

  async update(dto: UpdateBookingSettingsDto): Promise<BookingSettings> {
    const current = await this.prisma.bookingSettings.findFirst();
    if (!current) {
      const created = await this.prisma.bookingSettings.create({
        data: { ...dto },
      });
      await this.cacheService.del(CACHE_KEY);
      return created;
    }

    const updated = await this.prisma.bookingSettings.update({
      where: { id: current.id },
      data: { ...dto },
    });

    await this.cacheService.del(CACHE_KEY);
    return updated;
  }
}
