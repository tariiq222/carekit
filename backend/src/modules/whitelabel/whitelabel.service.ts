import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { UpdateConfigDto } from './dto/update-config.dto.js';
import { WhiteLabelConfig } from '@prisma/client';

@Injectable()
export class WhitelabelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET ALL — Return all configs ordered by key
  // ═══════════════════════════════════════════════════════════════

  private static readonly PUBLIC_KEYS = [
    'clinic_name', 'clinic_name_en', 'logo_url', 'favicon_url',
    'primary_color', 'secondary_color', 'contact_phone', 'contact_email',
    'app_name', 'app_name_en',
  ];

  async getPublicBranding(): Promise<Record<string, string>> {
    const cached = await this.cache.get<Record<string, string>>(
      CACHE_KEYS.WHITELABEL_BRANDING,
    );
    if (cached) return cached;

    const configs = await this.prisma.whiteLabelConfig.findMany({
      where: { key: { in: WhitelabelService.PUBLIC_KEYS } },
      select: { key: true, value: true },
    });
    const result = configs.reduce<Record<string, string>>((acc, c) => {
      acc[c.key] = c.value;
      return acc;
    }, {});

    await this.cache.set(
      CACHE_KEYS.WHITELABEL_BRANDING,
      result,
      CACHE_TTL.WHITELABEL_CONFIG,
    );
    return result;
  }

  async getConfig(): Promise<WhiteLabelConfig[]> {
    const cached = await this.cache.get<WhiteLabelConfig[]>(
      CACHE_KEYS.WHITELABEL_CONFIG,
    );
    if (cached) return cached;

    const configs = await this.prisma.whiteLabelConfig.findMany({
      orderBy: { key: 'asc' },
    });

    await this.cache.set(
      CACHE_KEYS.WHITELABEL_CONFIG,
      configs,
      CACHE_TTL.WHITELABEL_CONFIG,
    );
    return configs;
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET MAP — Return configs as { key: value } object
  // ═══════════════════════════════════════════════════════════════

  async getConfigMap(): Promise<Record<string, string>> {
    const configs = await this.getConfig();

    return configs.reduce<Record<string, string>>((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {});
  }

  // ═══════════════════════════════════════════════════════════════
  //  UPSERT — Create or update each config item
  // ═══════════════════════════════════════════════════════════════

  async updateConfig(dto: UpdateConfigDto): Promise<WhiteLabelConfig[]> {
    await Promise.all(
      dto.configs.map((item) =>
        this.prisma.whiteLabelConfig.upsert({
          where: { key: item.key },
          create: {
            key: item.key,
            value: item.value,
            type: item.type ?? 'string',
            description: item.description,
          },
          update: {
            value: item.value,
            ...(item.type !== undefined && { type: item.type }),
            ...(item.description !== undefined && { description: item.description }),
          },
        }),
      ),
    );

    await this.invalidateCache();
    return this.getConfig();
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET BY KEY — Return single config item
  // ═══════════════════════════════════════════════════════════════

  async getConfigByKey(key: string): Promise<WhiteLabelConfig> {
    const config = await this.prisma.whiteLabelConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Config key '${key}' not found`,
        error: 'NOT_FOUND',
      });
    }

    return config;
  }

  // ═══════════════════════════════════════════════════════════════
  //  DELETE — Delete config by key
  // ═══════════════════════════════════════════════════════════════

  async deleteConfig(key: string): Promise<WhiteLabelConfig> {
    const config = await this.prisma.whiteLabelConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Config key '${key}' not found`,
        error: 'NOT_FOUND',
      });
    }

    const deleted = await this.prisma.whiteLabelConfig.delete({
      where: { key },
    });

    await this.invalidateCache();
    return deleted;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CACHE INVALIDATION
  // ═══════════════════════════════════════════════════════════════

  private async invalidateCache(): Promise<void> {
    await Promise.all([
      this.cache.del(CACHE_KEYS.WHITELABEL_CONFIG),
      this.cache.del(CACHE_KEYS.WHITELABEL_BRANDING),
    ]);
  }
}
