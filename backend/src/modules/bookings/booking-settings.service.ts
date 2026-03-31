import { Injectable, Logger } from '@nestjs/common';
import { BookingSettings } from '@prisma/client';
import { CacheService } from '../../common/services/cache.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { UpdateBookingSettingsDto } from './dto/update-booking-settings.dto.js';

const GLOBAL_CACHE_KEY = 'booking:settings:global';
const BRANCH_CACHE_KEY = (branchId: string) => `booking:settings:branch:${branchId}`;
const CACHE_TTL_SECONDS = 3600; // 1 hour — settings rarely change; explicit invalidation on update

@Injectable()
export class BookingSettingsService {
  private readonly logger = new Logger(BookingSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /** Returns global settings (branchId = null). Creates defaults if missing. */
  async get(): Promise<BookingSettings> {
    const cached = await this.cacheService.get<BookingSettings>(GLOBAL_CACHE_KEY);
    if (cached) return cached;

    const settings = await this.prisma.bookingSettings.findFirst({
      where: { branchId: null },
    });

    if (!settings) {
      this.logger.warn('No global BookingSettings found — creating defaults');
      const created = await this.prisma.bookingSettings.create({ data: {} });
      await this.cacheService.set(GLOBAL_CACHE_KEY, created, CACHE_TTL_SECONDS);
      return created;
    }

    await this.cacheService.set(GLOBAL_CACHE_KEY, settings, CACHE_TTL_SECONDS);
    return settings;
  }

  /**
   * Returns branch-specific settings if a branch row exists, otherwise falls back to global.
   * Used by availability engine and booking service when branchId is provided.
   */
  async getForBranch(branchId?: string): Promise<BookingSettings> {
    if (!branchId) return this.get();

    const cacheKey = BRANCH_CACHE_KEY(branchId);
    const cached = await this.cacheService.get<BookingSettings>(cacheKey);
    if (cached) return cached;

    const branchSettings = await this.prisma.bookingSettings.findFirst({
      where: { branchId },
    });

    if (branchSettings) {
      await this.cacheService.set(cacheKey, branchSettings, CACHE_TTL_SECONDS);
      return branchSettings;
    }

    // Fall back to global row — cache under the branch key too (negative cache)
    const global = await this.get();
    await this.cacheService.set(cacheKey, global, CACHE_TTL_SECONDS);
    return global;
  }

  async update(dto: UpdateBookingSettingsDto): Promise<BookingSettings> {
    const branchId = (dto as Record<string, unknown>).branchId as string | undefined;
    const { branchId: _ignored, ...data } = dto as Record<string, unknown>;
    void _ignored;

    const current = await this.prisma.bookingSettings.findFirst({
      where: { branchId: branchId ?? null },
    });

    const updated = current
      ? await this.prisma.bookingSettings.update({ where: { id: current.id }, data })
      : await this.prisma.bookingSettings.create({ data: { ...data, branchId: branchId ?? null } });

    // Invalidate both global and branch cache
    await this.cacheService.del(GLOBAL_CACHE_KEY);
    if (branchId) await this.cacheService.del(BRANCH_CACHE_KEY(branchId));

    return updated;
  }
}
