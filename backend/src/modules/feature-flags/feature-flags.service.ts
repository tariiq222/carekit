import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { FeatureFlag } from '@prisma/client';

const CACHE_KEY = 'feature_flags:all';
const MAP_CACHE_KEY = 'feature_flags:map';
const TTL = 5 * 60; // 5 minutes

@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll(): Promise<FeatureFlag[]> {
    const cached = await this.cache.get<FeatureFlag[]>(CACHE_KEY);
    if (cached) return cached;

    const flags = await this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });

    await this.cache.set(CACHE_KEY, flags, TTL);
    return flags;
  }

  async getMap(): Promise<Record<string, boolean>> {
    const cached = await this.cache.get<Record<string, boolean>>(MAP_CACHE_KEY);
    if (cached) return cached;

    const flags = await this.prisma.featureFlag.findMany({
      select: { key: true, enabled: true },
    });

    const map = flags.reduce<Record<string, boolean>>((acc, f) => {
      acc[f.key] = f.enabled;
      return acc;
    }, {});

    await this.cache.set(MAP_CACHE_KEY, map, TTL);
    return map;
  }

  async toggle(key: string, enabled: boolean): Promise<FeatureFlag> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });

    if (!flag) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Feature flag '${key}' not found`,
        error: 'NOT_FOUND',
      });
    }

    const updated = await this.prisma.featureFlag.update({
      where: { key },
      data: { enabled },
    });

    await this.invalidate();
    return updated;
  }

  async isEnabled(key: string): Promise<boolean> {
    const map = await this.getMap();
    return map[key] ?? false;
  }

  private async invalidate(): Promise<void> {
    await this.cache.del(CACHE_KEY);
    await this.cache.del(MAP_CACHE_KEY);
  }
}
