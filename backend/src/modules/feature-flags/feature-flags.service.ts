import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { LicenseService } from '../license/license.service.js';
import type { FeatureFlag } from '@prisma/client';

@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly licenseService: LicenseService,
  ) {}

  async findAll(): Promise<FeatureFlag[]> {
    const cached = await this.cache.get<FeatureFlag[]>(
      CACHE_KEYS.FEATURE_FLAGS_ALL,
    );
    if (cached) return cached;

    const flags = await this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
    await this.cache.set(
      CACHE_KEYS.FEATURE_FLAGS_ALL,
      flags,
      CACHE_TTL.FEATURE_FLAGS,
    );
    return flags;
  }

  async getMap(): Promise<Record<string, boolean>> {
    const cached = await this.cache.get<Record<string, boolean>>(
      CACHE_KEYS.FEATURE_FLAGS_MAP,
    );
    if (cached) return cached;

    // Use getFeaturesWithStatus so the map reflects licensed && enabled —
    // a flag that is enabled in the DB but not licensed returns false here.
    // This is the source of truth consumed by the dashboard's useFeatureFlagMap().
    const features = await this.licenseService.getFeaturesWithStatus();

    const map = features.reduce<Record<string, boolean>>((acc, f) => {
      acc[f.key] = f.enabled; // LicenseService already computes licensed && enabled
      return acc;
    }, {});

    await this.cache.set(
      CACHE_KEYS.FEATURE_FLAGS_MAP,
      map,
      CACHE_TTL.FEATURE_FLAGS,
    );
    return map;
  }

  async toggle(key: string, enabled: boolean): Promise<FeatureFlag> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) {
      throw new NotFoundException(`Feature flag '${key}' not found`);
    }

    if (enabled) {
      const licensed = await this.licenseService.isFeatureLicensed(key);
      if (!licensed) {
        throw new ForbiddenException(
          `Feature '${key}' is not available in your license. Contact CareKit support.`,
        );
      }
    }

    const updated = await this.prisma.featureFlag.update({
      where: { key },
      data: { enabled },
    });

    await this.invalidate();
    return updated;
  }

  async isEnabled(key: string): Promise<boolean> {
    const [map, licensed] = await Promise.all([
      this.getMap(),
      this.licenseService.isFeatureLicensed(key),
    ]);
    return licensed && (map[key] ?? false);
  }

  private async invalidate(): Promise<void> {
    await this.cache.del(CACHE_KEYS.FEATURE_FLAGS_ALL);
    await this.cache.del(CACHE_KEYS.FEATURE_FLAGS_MAP);
  }
}
